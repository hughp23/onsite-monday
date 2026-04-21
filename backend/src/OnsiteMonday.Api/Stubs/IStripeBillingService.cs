namespace OnsiteMonday.Api.Stubs;

public interface IStripeBillingService
{
    Task<string> EnsureCustomerAsync(Guid userId, string email);
    Task<(string SubscriptionId, string CheckoutUrl)> CreateSubscriptionCheckoutAsync(
        string stripeCustomerId, string tier, string successUrl, string cancelUrl);
    Task CancelSubscriptionAsync(string stripeSubscriptionId);
}
