using OnsiteMonday.Api.DTOs.Subscriptions;

namespace OnsiteMonday.Api.Services;

public interface ISubscriptionService
{
    Task<SubscriptionDto?> GetCurrentAsync(Guid userId);
    Task<SubscriptionDto> UpdateSubscriptionAsync(Guid userId, string tier);
}
