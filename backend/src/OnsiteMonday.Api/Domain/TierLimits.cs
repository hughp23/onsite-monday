namespace OnsiteMonday.Api.Domain;

/// <summary>
/// Single source of truth for per-tier monthly usage limits.
/// null = unlimited. Unknown or missing tier falls back to bronze.
/// </summary>
public static class TierLimits
{
    private static readonly Dictionary<string, (int? Posts, int? Applications)> ByTier = new()
    {
        ["bronze"] = (2, 10),
        ["silver"] = (5, 30),
        ["gold"]   = (null, null),
    };

    private static (int? Posts, int? Applications) For(string? tier) =>
        tier != null && ByTier.TryGetValue(tier, out var limits) ? limits : ByTier["bronze"];

    public static int? PostsPerMonth(string? tier) => For(tier).Posts;
    public static int? ApplicationsPerMonth(string? tier) => For(tier).Applications;

    public static DateTimeOffset CurrentPeriodStart(DateTimeOffset now)
    {
        var utc = now.ToUniversalTime();
        return new DateTimeOffset(utc.Year, utc.Month, 1, 0, 0, 0, TimeSpan.Zero);
    }
}
