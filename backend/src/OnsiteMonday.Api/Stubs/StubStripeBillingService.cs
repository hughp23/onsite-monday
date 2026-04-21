namespace OnsiteMonday.Api.Stubs;

internal sealed class StubStripeBillingService : IStripeBillingService
{
    private readonly ILogger<StubStripeBillingService> _logger;

    public StubStripeBillingService(ILogger<StubStripeBillingService> logger) => _logger = logger;

    public Task<string> EnsureCustomerAsync(Guid userId, string email)
    {
        var id = $"cus_stub_{userId.ToString("N")[..8]}";
        _logger.LogInformation("[STUB] Stripe EnsureCustomer {UserId} → {CustomerId}", userId, id);
        return Task.FromResult(id);
    }

    public Task<(string SubscriptionId, string CheckoutUrl)> CreateSubscriptionCheckoutAsync(
        string stripeCustomerId, string tier, string successUrl, string cancelUrl)
    {
        var subId = $"sub_stub_{Guid.NewGuid().ToString("N")[..8]}";
        var url = $"https://checkout.stripe.com/stub?tier={tier}&customer={stripeCustomerId}";
        _logger.LogInformation("[STUB] Stripe CreateSubscriptionCheckout {CustomerId} tier={Tier} → {SubId}", stripeCustomerId, tier, subId);
        return Task.FromResult((subId, url));
    }

    public Task CancelSubscriptionAsync(string stripeSubscriptionId)
    {
        _logger.LogInformation("[STUB] Stripe CancelSubscription {SubscriptionId}", stripeSubscriptionId);
        return Task.CompletedTask;
    }
}
