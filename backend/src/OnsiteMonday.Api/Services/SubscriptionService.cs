using Microsoft.EntityFrameworkCore;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.DTOs.Subscriptions;
using OnsiteMonday.Api.Stubs;

namespace OnsiteMonday.Api.Services;

public class SubscriptionService : ISubscriptionService
{
    private readonly AppDbContext _db;
    private readonly IStripeBillingService _stripe;

    private static readonly Dictionary<string, int> PayoutDaysByTier = new()
    {
        { "bronze", 30 },
        { "silver", 14 },
        { "gold",    7 },
    };

    public SubscriptionService(AppDbContext db, IStripeBillingService stripe)
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

    public async Task<SubscriptionCheckoutResponse> UpdateSubscriptionAsync(Guid userId, string tier, bool updateCardAndUpgrade = false)
    {
        tier = tier.ToLowerInvariant();

        if (!PayoutDaysByTier.TryGetValue(tier, out var payoutDays))
            throw new ArgumentException($"Invalid tier '{tier}'. Must be bronze, silver, or gold.");

        var user = await _db.Users.FindAsync(userId);

        // Existing subscriber path: update in-place without a new Checkout Session
        var existingSub = await _db.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.IsActive && s.StripeSubscriptionId != null);

        if (!updateCardAndUpgrade && existingSub?.StripeSubscriptionId != null)
        {
            await _stripe.UpdateSubscriptionInPlaceAsync(existingSub.StripeSubscriptionId, tier);

            existingSub.Tier = tier;
            existingSub.PayoutDays = payoutDays;
            await _db.SaveChangesAsync();

            return new SubscriptionCheckoutResponse
            {
                Subscription = ToDto(existingSub),
                CheckoutUrl = null,
            };
        }

        // New subscriber or "update card & upgrade" path: create a Checkout Session
        var oldStripeSubId = existingSub?.StripeSubscriptionId;

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

        string? checkoutUrl = null;

        if (user != null)
        {
            if (string.IsNullOrEmpty(user.StripeCustomerId))
                user.StripeCustomerId = await _stripe.EnsureCustomerAsync(userId, user.Email);

            var (_, url) = await _stripe.CreateSubscriptionCheckoutAsync(
                user.StripeCustomerId,
                tier,
                "onsitemonday://subscription/success",
                "onsitemonday://subscription/cancel");
            checkoutUrl = url;

            await _db.SaveChangesAsync();
        }

        if (!string.IsNullOrEmpty(oldStripeSubId))
            await _stripe.CancelSubscriptionAsync(oldStripeSubId);

        return new SubscriptionCheckoutResponse
        {
            Subscription = ToDto(subscription),
            CheckoutUrl = checkoutUrl,
        };
    }

    public async Task<SubscriptionDto> CancelCurrentAsync(Guid userId)
    {
        var sub = await _db.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.IsActive);

        if (sub == null)
            throw new InvalidOperationException("No active subscription to cancel.");

        if (sub.StripeSubscriptionId == null)
        {
            sub.IsActive = false;
            sub.CancelledAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync();
            return ToDto(sub);
        }

        var periodEnd = await _stripe.CancelSubscriptionAtPeriodEndAsync(sub.StripeSubscriptionId);
        sub.CancelAtPeriodEnd = true;
        sub.CurrentPeriodEnd = periodEnd;
        await _db.SaveChangesAsync();
        return ToDto(sub);
    }

    private static SubscriptionDto ToDto(Subscription s) => new()
    {
        Id = s.Id,
        Tier = s.Tier,
        PayoutDays = s.PayoutDays,
        IsActive = s.IsActive,
        StartedAt = s.StartedAt,
        CancelAtPeriodEnd = s.CancelAtPeriodEnd,
        CurrentPeriodEnd = s.CurrentPeriodEnd,
    };
}
