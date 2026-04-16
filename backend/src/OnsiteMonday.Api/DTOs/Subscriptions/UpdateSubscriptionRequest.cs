namespace OnsiteMonday.Api.DTOs.Subscriptions;

public class UpdateSubscriptionRequest
{
    public string Tier { get; set; } = null!; // bronze | silver | gold
}
