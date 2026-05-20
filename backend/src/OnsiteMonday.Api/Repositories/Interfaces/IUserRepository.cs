using OnsiteMonday.Api.Domain;

namespace OnsiteMonday.Api.Repositories;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id);
    Task<User?> GetByCognitoSubAsync(string cognitoSub);
    Task<User> GetOrCreateByCognitoSubAsync(string cognitoSub, string email, string? firstName = null, string? lastName = null, string? profileImageUrl = null);
    Task<List<User>> GetTradespeopleAsync(string? trade, string? location);
    Task UpdateAsync(User user);
}
