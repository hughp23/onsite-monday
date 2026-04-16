namespace OnsiteMonday.Api.DTOs.Subscriptions;

public class SubscriptionDto
{
    public Guid Id { get; set; }
    public string Tier { get; set; } = null!;
    public int PayoutDays { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset StartedAt { get; set; }
}
