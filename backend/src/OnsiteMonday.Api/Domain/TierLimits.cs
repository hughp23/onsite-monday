namespace OnsiteMonday.Api.Domain;

/// <summary>
/// Single source of truth for per-tier rules: monthly usage limits and payout delay.
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

    private static readonly Dictionary<string, int> PayoutDaysByTier = new()
    {
        ["bronze"] = 30,
        ["silver"] = 14,
        ["gold"]   = 7,
    };

    /// <summary>Payout delay for a known tier (lower-case). False for an unknown tier.</summary>
    public static bool TryGetPayoutDays(string tier, out int payoutDays) =>
        PayoutDaysByTier.TryGetValue(tier, out payoutDays);

    /// <summary>
    /// The tier whose limits apply to a subscription. A paid tier only counts once Stripe has
    /// confirmed checkout (checkout.session.completed sets StripeSubscriptionId); an abandoned
    /// checkout leaves the row unconfirmed, so it falls back to bronze.
    /// </summary>
    public static string LimitTier(Subscription? subscription, bool requireStripeConfirmation)
    {
        if (subscription == null) return "bronze";
        if (requireStripeConfirmation && string.IsNullOrEmpty(subscription.StripeSubscriptionId)) return "bronze";
        return subscription.Tier;
    }

    public static DateTimeOffset CurrentPeriodStart(DateTimeOffset now)
    {
        var utc = now.ToUniversalTime();
        return new DateTimeOffset(utc.Year, utc.Month, 1, 0, 0, 0, TimeSpan.Zero);
    }
}
