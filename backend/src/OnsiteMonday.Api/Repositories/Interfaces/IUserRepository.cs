using OnsiteMonday.Api.Domain;

namespace OnsiteMonday.Api.Repositories;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id);
    Task<User?> GetByFirebaseUidAsync(string firebaseUid);
    Task<User> GetOrCreateByFirebaseUidAsync(string firebaseUid, string email);
    Task<List<User>> GetTradespeopleAsync(string? trade, string? location);
    Task UpdateAsync(User user);
}
