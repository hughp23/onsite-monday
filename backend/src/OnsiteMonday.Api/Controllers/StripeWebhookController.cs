using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Services;
using Stripe;
using StripeCheckoutSession = Stripe.Checkout.Session;
using DomainSubscription = OnsiteMonday.Api.Domain.Subscription;

namespace OnsiteMonday.Api.Controllers;

[ApiController]
[Route("api/webhooks/stripe")]
public class StripeWebhookController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly StripeOptions _options;
    private readonly ILogger<StripeWebhookController> _logger;

    public StripeWebhookController(AppDbContext db, IOptions<StripeOptions> options, ILogger<StripeWebhookController> logger)
    {
        _db = db;
        _options = options.Value;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> Handle()
    {
        var json = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync();

        Event stripeEvent;
        try
        {
            stripeEvent = EventUtility.ConstructEvent(
                json,
                Request.Headers["Stripe-Signature"],
                _options.WebhookSecret);
        }
        catch (StripeException ex)
        {
            _logger.LogWarning("Stripe webhook signature validation failed: {Message}", ex.Message);
            return BadRequest();
        }

        _logger.LogInformation("Stripe webhook received: {EventType} {EventId}", stripeEvent.Type, stripeEvent.Id);

        switch (stripeEvent.Type)
        {
            case "checkout.session.completed":
                await HandleCheckoutSessionCompleted((StripeCheckoutSession)stripeEvent.Data.Object);
                break;

            case "customer.subscription.updated":
                _logger.LogInformation("Stripe subscription updated: {SubscriptionId}", ((Stripe.Subscription)stripeEvent.Data.Object).Id);
                break;

            case "customer.subscription.deleted":
                await HandleSubscriptionDeleted((Stripe.Subscription)stripeEvent.Data.Object);
                break;

            case "invoice.payment_failed":
                _logger.LogWarning("Stripe invoice payment failed for customer {CustomerId}", ((Invoice)stripeEvent.Data.Object).CustomerId);
                break;

            default:
                _logger.LogDebug("Unhandled Stripe event type: {EventType}", stripeEvent.Type);
                break;
        }

        return Ok();
    }

    private async Task HandleCheckoutSessionCompleted(StripeCheckoutSession session)
    {
        if (string.IsNullOrEmpty(session.SubscriptionId)) return;

        // Find the active subscription for the Stripe customer
        var sub = await _db.Subscriptions
            .Join(_db.Users, s => s.UserId, u => u.Id, (s, u) => new { Sub = s, User = u })
            .Where(x => x.User.StripeCustomerId == session.CustomerId && x.Sub.IsActive)
            .Select(x => x.Sub)
            .FirstOrDefaultAsync();

        if (sub == null)
        {
            _logger.LogWarning("Stripe checkout completed but no active subscription found for customer {CustomerId}", session.CustomerId);
            return;
        }

        sub.StripeSubscriptionId = session.SubscriptionId;
        await _db.SaveChangesAsync();
        _logger.LogInformation("Stripe: Set StripeSubscriptionId={SubId} on subscription {LocalSubId}", session.SubscriptionId, sub.Id);
    }

    private async Task HandleSubscriptionDeleted(Stripe.Subscription stripeSub)
    {
        var sub = await _db.Subscriptions
            .FirstOrDefaultAsync(s => s.StripeSubscriptionId == stripeSub.Id);

        if (sub == null) return;

        sub.IsActive = false;
        sub.CancelledAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        _logger.LogInformation("Stripe: Deactivated subscription {LocalSubId} (Stripe {StripSubId})", sub.Id, stripeSub.Id);
    }
}
