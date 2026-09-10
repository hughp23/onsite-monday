using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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
[EnableRateLimiting("public")]
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
                await HandleSubscriptionUpdated((Stripe.Subscription)stripeEvent.Data.Object);
                break;

            case "customer.subscription.deleted":
                await HandleSubscriptionDeleted((Stripe.Subscription)stripeEvent.Data.Object);
                break;

            case "invoice.payment_failed":
                _logger.LogWarning("Stripe invoice payment failed for customer {CustomerId}", ((Invoice)stripeEvent.Data.Object).CustomerId);
                break;

            case "account.updated":
                await HandleAccountUpdatedAsync((Stripe.Account)stripeEvent.Data.Object);
                break;

            default:
                _logger.LogDebug("Unhandled Stripe event type: {EventType}", stripeEvent.Type);
                break;
        }

        return Ok();
    }

    private async Task HandleCheckoutSessionCompleted(StripeCheckoutSession session)
    {
        if (session.Mode == "subscription")
        {
            await HandleSubscriptionCheckoutCompletedAsync(session);
        }
        else if (session.Mode == "payment")
        {
            await HandleJobPaymentCheckoutCompletedAsync(session);
        }
    }

    private async Task HandleSubscriptionCheckoutCompletedAsync(StripeCheckoutSession session)
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

    private async Task HandleJobPaymentCheckoutCompletedAsync(StripeCheckoutSession session)
    {
        var job = await _db.Jobs.FirstOrDefaultAsync(j => j.StripeCheckoutSessionId == session.Id);
        if (job == null)
        {
            _logger.LogWarning("Stripe job payment: no job found for session {SessionId}", session.Id);
            return;
        }

        job.PaymentStatus = "escrowed";
        await _db.SaveChangesAsync();
        _logger.LogInformation("Job {JobId} payment status updated to escrowed via session {SessionId}", job.Id, session.Id);
    }

    private async Task HandleAccountUpdatedAsync(Stripe.Account account)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.StripeConnectAccountId == account.Id);
        if (user == null)
        {
            _logger.LogDebug("Stripe account.updated: no user found for account {AccountId}", account.Id);
            return;
        }

        var complete = account.ChargesEnabled && account.PayoutsEnabled;
        if (user.StripeConnectOnboardingComplete != complete)
        {
            user.StripeConnectOnboardingComplete = complete;
            await _db.SaveChangesAsync();
            _logger.LogInformation(
                "Stripe Connect: OnboardingComplete={Complete} for user {UserId} (account {AccountId})",
                complete, user.Id, account.Id);
        }
    }

    private static readonly Dictionary<string, string> TierByPayoutDays = new()
    {
        { "price_bronze", "bronze" },
        { "price_silver", "silver" },
        { "price_gold",   "gold"   },
    };

    private async Task HandleSubscriptionUpdated(Stripe.Subscription stripeSub)
    {
        var sub = await _db.Subscriptions
            .FirstOrDefaultAsync(s => s.StripeSubscriptionId == stripeSub.Id && s.IsActive);

        if (sub == null) return;

        // Derive tier from the price nickname/metadata on the subscription item
        var priceId = stripeSub.Items?.Data?.FirstOrDefault()?.Price?.Id ?? string.Empty;
        var nickname = (stripeSub.Items?.Data?.FirstOrDefault()?.Price?.Nickname ?? string.Empty).ToLowerInvariant();

        string? tier = nickname switch
        {
            var n when n.Contains("bronze") => "bronze",
            var n when n.Contains("silver") => "silver",
            var n when n.Contains("gold")   => "gold",
            _ => null,
        };

        if (tier == null)
        {
            _logger.LogWarning("Stripe: subscription.updated for {SubId} — could not determine tier from price {PriceId}", stripeSub.Id, priceId);
            return;
        }

        var payoutDays = tier switch { "silver" => 14, "gold" => 7, _ => 30 };
        sub.Tier = tier;
        sub.PayoutDays = payoutDays;
        await _db.SaveChangesAsync();
        _logger.LogInformation("Stripe: Synced subscription {LocalSubId} to tier={Tier}", sub.Id, tier);
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
