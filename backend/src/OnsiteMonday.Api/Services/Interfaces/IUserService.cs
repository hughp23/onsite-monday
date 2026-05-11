using OnsiteMonday.Api.DTOs.Users;

namespace OnsiteMonday.Api.Services;

public interface IUserService
{
    Task<UserDto> GetOrCreateCurrentUserAsync(string cognitoSub, string email);
    Task<UserDto> GetByIdAsync(Guid id);
    Task<UserDto> UpdateCurrentUserAsync(string cognitoSub, string email, UpdateUserRequest request);
    Task<UserDto> CompleteOnboardingAsync(string cognitoSub);
    Task<List<TradespersonDto>> GetTradespeopleAsync(string? trade, string? location);
}
