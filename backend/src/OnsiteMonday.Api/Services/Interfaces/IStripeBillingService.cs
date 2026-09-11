namespace OnsiteMonday.Api.Services.Interfaces;

public interface IStripeBillingService
{
    Task<string> EnsureCustomerAsync(Guid userId, string email);
    Task<(string SubscriptionId, string CheckoutUrl)> CreateSubscriptionCheckoutAsync(
        string stripeCustomerId, string tier, string successUrl, string cancelUrl);
    Task UpdateSubscriptionInPlaceAsync(string stripeSubscriptionId, string tier);
    Task CancelSubscriptionAsync(string stripeSubscriptionId);
    Task<DateTimeOffset> CancelSubscriptionAtPeriodEndAsync(string stripeSubscriptionId);
}
