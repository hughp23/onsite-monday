using OnsiteMonday.Api.DTOs.Users;

namespace OnsiteMonday.Api.Services;

public interface IUserService
{
    Task<UserDto> GetOrCreateCurrentUserAsync(string firebaseUid, string email);
    Task<UserDto> GetByIdAsync(Guid id);
    Task<UserDto> UpdateCurrentUserAsync(string firebaseUid, string email, UpdateUserRequest request);
    Task<UserDto> CompleteOnboardingAsync(string firebaseUid);
    Task<List<TradespersonDto>> GetTradespeopleAsync(string? trade, string? location);
}
