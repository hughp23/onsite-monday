using OnsiteMonday.Api.Domain;

namespace OnsiteMonday.Api.Repositories;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id);
    Task<User?> GetByCognitoSubAsync(string cognitoSub);
    Task<User> GetOrCreateByCognitoSubAsync(string cognitoSub, string email);
    Task<List<User>> GetTradespeopleAsync(string? trade, string? location);
    Task UpdateAsync(User user);
}
