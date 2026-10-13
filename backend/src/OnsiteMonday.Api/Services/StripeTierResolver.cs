using Stripe;

namespace OnsiteMonday.Api.Services;

/// <summary>
/// Works out which tier a Stripe price represents. The configured Stripe:Prices IDs
/// are authoritative, because checkout and in-place upgrades use exactly those IDs.
/// A price's metadata["tier"] is the fallback, for a price swapped in the Stripe
/// dashboard without updating config. Nicknames are never used.
/// </summary>
public static class StripeTierResolver
{
    public static string? Resolve(Price? price, IReadOnlyDictionary<string, string> configuredPrices)
    {
        if (price == null) return null;

        if (!string.IsNullOrEmpty(price.Id))
        {
            foreach (var (tierKey, priceId) in configuredPrices)
            {
                if (!string.IsNullOrEmpty(priceId) && priceId == price.Id)
                    return Known(tierKey);
            }
        }

        if (price.Metadata != null && price.Metadata.TryGetValue("tier", out var metadataTier))
            return Known(metadataTier);

        return null;
    }

    private static string? Known(string? tier)
    {
        var normalised = tier?.Trim().ToLowerInvariant();
        return normalised != null && Domain.TierLimits.TryGetPayoutDays(normalised, out _) ? normalised : null;
    }
}
