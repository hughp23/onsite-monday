namespace OnsiteMonday.Api.DTOs.Subscriptions;

public class SubscriptionCheckoutResponse
{
    public SubscriptionDto Subscription { get; set; } = null!;
    public string? CheckoutUrl { get; set; }
}
