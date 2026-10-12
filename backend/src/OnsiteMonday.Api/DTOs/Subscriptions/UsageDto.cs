namespace OnsiteMonday.Api.DTOs.Subscriptions;

public class UsageDto
{
    public string Tier { get; set; } = "bronze";
    public int PostsUsed { get; set; }
    public int? PostsLimit { get; set; }          // null = unlimited
    public int ApplicationsUsed { get; set; }
    public int? ApplicationsLimit { get; set; }   // null = unlimited
    public DateTimeOffset PeriodStart { get; set; }
    public DateTimeOffset PeriodEnd { get; set; }
}
