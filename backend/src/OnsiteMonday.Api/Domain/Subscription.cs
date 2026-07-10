namespace OnsiteMonday.Api.Domain;

public class Subscription
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string Tier { get; set; } = "bronze"; // bronze | silver | gold
    public bool IsActive { get; set; } = true;
    public int PayoutDays { get; set; } = 30;
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }
    public string? StripeSubscriptionId { get; set; }
    public bool CancelAtPeriodEnd { get; set; } = false;
    public DateTimeOffset? CurrentPeriodEnd { get; set; }
}
