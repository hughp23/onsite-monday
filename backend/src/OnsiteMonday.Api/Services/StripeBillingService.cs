using Microsoft.Extensions.Options;
using OnsiteMonday.Api.Stubs;
using Stripe;
using Stripe.Checkout;

namespace OnsiteMonday.Api.Services;

public class StripeOptions
{
    public string SecretKey { get; set; } = "";
    public string WebhookSecret { get; set; } = "";
    public Dictionary<string, string> Prices { get; set; } = new();
}

public class StripeBillingService : IStripeBillingService
{
    private readonly StripeOptions _options;
    private readonly ILogger<StripeBillingService> _logger;

    public StripeBillingService(IOptions<StripeOptions> options, ILogger<StripeBillingService> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task<string> EnsureCustomerAsync(Guid userId, string email)
    {
        var service = new CustomerService();
        var customer = await service.CreateAsync(new CustomerCreateOptions
        {
            Email = email,
            Metadata = new Dictionary<string, string> { ["userId"] = userId.ToString() },
        });
        _logger.LogInformation("Stripe: Created Customer {CustomerId} for user {UserId}", customer.Id, userId);
        return customer.Id;
    }

    public async Task<(string SubscriptionId, string CheckoutUrl)> CreateSubscriptionCheckoutAsync(
        string stripeCustomerId, string tier, string successUrl, string cancelUrl)
    {
        var tierKey = char.ToUpper(tier[0]) + tier[1..].ToLower();
        if (!_options.Prices.TryGetValue(tierKey, out var priceId) || string.IsNullOrEmpty(priceId))
            throw new ArgumentException($"No Stripe Price ID configured for tier '{tier}'.");

        var sessionService = new SessionService();
        var session = await sessionService.CreateAsync(new SessionCreateOptions
        {
            Customer = stripeCustomerId,
            Mode = "subscription",
            LineItems = new List<SessionLineItemOptions>
            {
                new() { Price = priceId, Quantity = 1 },
            },
            SuccessUrl = successUrl,
            CancelUrl = cancelUrl,
        });

        _logger.LogInformation("Stripe: Created Checkout Session {SessionId} for customer {CustomerId} tier={Tier}",
            session.Id, stripeCustomerId, tier);

        // SubscriptionId is null at session creation — populated by webhook after checkout
        return (session.SubscriptionId ?? string.Empty, session.Url);
    }

    public async Task CancelSubscriptionAsync(string stripeSubscriptionId)
    {
        var subscriptionService = new Stripe.SubscriptionService();
        await subscriptionService.CancelAsync(stripeSubscriptionId, new SubscriptionCancelOptions());
        _logger.LogInformation("Stripe: Cancelled subscription {SubscriptionId}", stripeSubscriptionId);
    }
}
