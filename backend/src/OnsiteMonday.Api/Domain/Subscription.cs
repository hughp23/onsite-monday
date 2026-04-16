namespace OnsiteMonday.Api.Domain;

public class Subscription
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string Tier { get; set; } = "bronze"; // bronze | silver | gold
    public bool IsActive { get; set; } = true;
    public int PayoutDays { get; set; } = 30;    // 30 | 14 | 7 — set from tier at creation time
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }
    public string? StripeSubscriptionId { get; set; } // Phase 2 — Stripe integration
}
