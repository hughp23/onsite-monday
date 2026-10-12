using OnsiteMonday.Api.DTOs.Subscriptions;

namespace OnsiteMonday.Api.Services;

public interface IUsageService
{
    Task<UsageDto> GetUsageAsync(Guid userId);
    Task EnsureCanPostAsync(Guid userId);
    Task EnsureCanApplyAsync(Guid userId);
}
