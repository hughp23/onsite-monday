using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.DTOs.Subscriptions;
using OnsiteMonday.Api.Repositories;

namespace OnsiteMonday.Api.Services;

public class UsageService : IUsageService
{
    private readonly IJobRepository _jobRepo;
    private readonly IUserRepository _userRepo;
    private readonly bool _requireStripeConfirmation;

    /// <param name="requireStripeConfirmation">
    /// When true (live payments), a subscription's tier only counts once Stripe has confirmed
    /// checkout. Pass false only where billing is stubbed and no webhook can ever confirm it.
    /// </param>
    public UsageService(IJobRepository jobRepo, IUserRepository userRepo, bool requireStripeConfirmation = true)
    {
        _jobRepo = jobRepo;
        _userRepo = userRepo;
        _requireStripeConfirmation = requireStripeConfirmation;
    }

    public async Task<UsageDto> GetUsageAsync(Guid userId)
    {
        var user = await _userRepo.GetByIdAsync(userId)
            ?? throw new KeyNotFoundException("User not found.");
        var tier = TierLimits.LimitTier(user.ActiveSubscription, _requireStripeConfirmation);
        var periodStart = TierLimits.CurrentPeriodStart(DateTimeOffset.UtcNow);

        return new UsageDto
        {
            Tier = tier,
            PostsUsed = await _jobRepo.CountJobsPostedSinceAsync(userId, periodStart),
            PostsLimit = TierLimits.PostsPerMonth(tier),
            ApplicationsUsed = await _jobRepo.CountApplicationsSinceAsync(userId, periodStart),
            ApplicationsLimit = TierLimits.ApplicationsPerMonth(tier),
            PeriodStart = periodStart,
            PeriodEnd = periodStart.AddMonths(1),
        };
    }

    public async Task EnsureCanPostAsync(Guid userId)
    {
        var usage = await GetUsageAsync(userId);
        if (usage.PostsLimit is int limit && usage.PostsUsed >= limit)
            throw new TierLimitExceededException(
                $"You've used all {limit} job posts on your {Capitalise(usage.Tier)} plan this month. Upgrade to post more.");
    }

    public async Task EnsureCanApplyAsync(Guid userId)
    {
        var usage = await GetUsageAsync(userId);
        if (usage.ApplicationsLimit is int limit && usage.ApplicationsUsed >= limit)
            throw new TierLimitExceededException(
                $"You've used all {limit} applications on your {Capitalise(usage.Tier)} plan this month. Upgrade to apply for more jobs.");
    }

    private static string Capitalise(string s) => char.ToUpperInvariant(s[0]) + s[1..];
}
