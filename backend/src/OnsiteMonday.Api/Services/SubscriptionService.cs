using Microsoft.EntityFrameworkCore;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.DTOs.Subscriptions;
using OnsiteMonday.Api.Stubs;

namespace OnsiteMonday.Api.Services;

public class SubscriptionService : ISubscriptionService
{
    private readonly AppDbContext _db;
    private readonly IMangopayService _mangopay;
    private readonly IStripeBillingService _stripe;

    private static readonly Dictionary<string, int> PayoutDaysByTier = new()
    {
        { "bronze", 30 },
        { "silver", 14 },
        { "gold",    7 },
    };

    public SubscriptionService(AppDbContext db, IMangopayService mangopay, IStripeBillingService stripe)
    {
        _db = db;
        _mangopay = mangopay;
        _stripe = stripe;
    }

    public async Task<SubscriptionDto?> GetCurrentAsync(Guid userId)
    {
        var sub = await _db.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.IsActive);
        return sub == null ? null : ToDto(sub);
    }

    public async Task<SubscriptionCheckoutResponse> UpdateSubscriptionAsync(Guid userId, string tier)
    {
        tier = tier.ToLowerInvariant();

        if (!PayoutDaysByTier.TryGetValue(tier, out var payoutDays))
            throw new ArgumentException($"Invalid tier '{tier}'. Must be bronze, silver, or gold.");

        // Capture old Stripe subscription ID before deactivating (for cancellation)
        var oldStripeSubId = await _db.Subscriptions
            .Where(s => s.UserId == userId && s.IsActive && s.StripeSubscriptionId != null)
            .Select(s => s.StripeSubscriptionId)
            .FirstOrDefaultAsync();

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

        string? checkoutUrl = null;

        var user = await _db.Users.FindAsync(userId);
        if (user != null)
        {
            // Provision Mangopay user + wallet if not already done
            if (string.IsNullOrEmpty(user.MangopayUserId))
            {
                user.MangopayUserId = await _mangopay.EnsureUserAsync(userId, user.Email, user.FirstName, user.LastName);
                user.MangopayWalletId = await _mangopay.EnsureWalletAsync(user.MangopayUserId, $"Wallet for {user.Email}");
            }

            // Provision Stripe customer if not already done
            if (string.IsNullOrEmpty(user.StripeCustomerId))
                user.StripeCustomerId = await _stripe.EnsureCustomerAsync(userId, user.Email);

            // Create Stripe Checkout Session for the subscription
            var (_, url) = await _stripe.CreateSubscriptionCheckoutAsync(
                user.StripeCustomerId,
                tier,
                "onsitemonday://subscription/success",
                "onsitemonday://subscription/cancel");
            checkoutUrl = url;

            await _db.SaveChangesAsync();
        }

        // Cancel old Stripe subscription if one existed
        if (!string.IsNullOrEmpty(oldStripeSubId))
            await _stripe.CancelSubscriptionAsync(oldStripeSubId);

        return new SubscriptionCheckoutResponse
        {
            Subscription = ToDto(subscription),
            CheckoutUrl = checkoutUrl,
        };
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
