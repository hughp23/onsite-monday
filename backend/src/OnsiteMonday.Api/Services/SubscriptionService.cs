using Microsoft.EntityFrameworkCore;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.DTOs.Subscriptions;
using OnsiteMonday.Api.Stubs;

namespace OnsiteMonday.Api.Services;

public class SubscriptionService : ISubscriptionService
{
    private readonly AppDbContext _db;
    private readonly IStripeService _stripe;

    private static readonly Dictionary<string, int> PayoutDaysByTier = new()
    {
        { "bronze", 30 },
        { "silver", 14 },
        { "gold",    7 },
    };

    public SubscriptionService(AppDbContext db, IStripeService stripe)
    {
        _db = db;
        _stripe = stripe;
    }

    public async Task<SubscriptionDto?> GetCurrentAsync(Guid userId)
    {
        var sub = await _db.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.IsActive);
        return sub == null ? null : ToDto(sub);
    }

    public async Task<SubscriptionDto> UpdateSubscriptionAsync(Guid userId, string tier)
    {
        tier = tier.ToLowerInvariant();

        if (!PayoutDaysByTier.TryGetValue(tier, out var payoutDays))
            throw new ArgumentException($"Invalid tier '{tier}'. Must be bronze, silver, or gold.");

        // Deactivate any existing active subscription
        var now = DateTimeOffset.UtcNow;
        await _db.Subscriptions
            .Where(s => s.UserId == userId && s.IsActive)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.IsActive, false)
                .SetProperty(x => x.CancelledAt, now));

        var subscription = new Subscription
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Tier = tier,
            PayoutDays = payoutDays,
            IsActive = true,
            StartedAt = DateTimeOffset.UtcNow,
        };

        _db.Subscriptions.Add(subscription);
        await _db.SaveChangesAsync();

        // Phase 2: wire up real Stripe billing here
        await _stripe.CreateConnectAccountAsync(userId.ToString());

        return ToDto(subscription);
    }

    private static SubscriptionDto ToDto(Subscription s) => new()
    {
        Id = s.Id,
        Tier = s.Tier,
        PayoutDays = s.PayoutDays,
        IsActive = s.IsActive,
        StartedAt = s.StartedAt,
    };
}
