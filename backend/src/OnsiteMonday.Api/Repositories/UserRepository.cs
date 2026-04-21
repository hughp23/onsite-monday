using Microsoft.EntityFrameworkCore;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Domain;

namespace OnsiteMonday.Api.Repositories;

public class UserRepository : IUserRepository
{
    private readonly AppDbContext _db;

    public UserRepository(AppDbContext db) => _db = db;

    public Task<User?> GetByIdAsync(Guid id) =>
        _db.Users.Include(u => u.Subscriptions).FirstOrDefaultAsync(u => u.Id == id);

    public Task<User?> GetByFirebaseUidAsync(string firebaseUid) =>
        _db.Users.Include(u => u.Subscriptions).FirstOrDefaultAsync(u => u.FirebaseUid == firebaseUid);

    public async Task<User> GetOrCreateByFirebaseUidAsync(string firebaseUid, string email)
    {
        var user = await GetByFirebaseUidAsync(firebaseUid);
        if (user != null) return user;

        user = new User
        {
            Id = Guid.NewGuid(),
            FirebaseUid = firebaseUid,
            Email = email,
            FirstName = string.Empty,
            LastName = string.Empty,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };

        _db.Users.Add(user);
        try
        {
            await _db.SaveChangesAsync();
            return user;
        }
        catch (DbUpdateException)
        {
            // A concurrent request already created this user — fetch theirs
            _db.ChangeTracker.Clear();
            return await GetByFirebaseUidAsync(firebaseUid)
                ?? throw new InvalidOperationException("User creation conflict could not be resolved.");
        }
    }

    public async Task<List<User>> GetTradespeopleAsync(string? trade, string? location)
    {
        try
        {
            var query = _db.Users
            .Include(u => u.Subscriptions)
            .Where(u => u.Trade != null && u.IsOnboarded);

        if (!string.IsNullOrWhiteSpace(trade))
            query = query.Where(u => u.Trade == trade);

        if (!string.IsNullOrWhiteSpace(location))
            query = query.Where(u => u.Location != null &&
                u.Location.ToLower().Contains(location.ToLower()));

        return await query.ToListAsync();
        }
        catch (Exception ex)
        {
            // Log the exception (not implemented here)
            throw new Exception("An error occurred while retrieving tradespeople.", ex);
        }
        
    }

    public async Task UpdateAsync(User user)
    {
        user.UpdatedAt = DateTimeOffset.UtcNow;
        _db.Users.Update(user);
        await _db.SaveChangesAsync();
    }
}
