using OnsiteMonday.Api.DTOs.Subscriptions;

namespace OnsiteMonday.Api.Services;

public interface ISubscriptionService
{
    Task<SubscriptionDto?> GetCurrentAsync(Guid userId);
    Task<SubscriptionCheckoutResponse> UpdateSubscriptionAsync(Guid userId, string tier);
}
