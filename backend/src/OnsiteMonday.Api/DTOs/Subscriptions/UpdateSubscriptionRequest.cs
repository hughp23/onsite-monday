namespace OnsiteMonday.Api.DTOs.Subscriptions;

public class UpdateSubscriptionRequest
{
    public string Tier { get; set; } = null!; // bronze | silver | gold
    // When true, forces a new Checkout Session (so the user can enter a new card).
    // When false (default) and an existing Stripe subscription exists, updates in-place.
    public bool UpdateCardAndUpgrade { get; set; } = false;
}
