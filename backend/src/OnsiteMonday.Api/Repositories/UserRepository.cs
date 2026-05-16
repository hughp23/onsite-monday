using Microsoft.EntityFrameworkCore;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Domain;

namespace OnsiteMonday.Api.Repositories;

public class UserRepository : IUserRepository
{
    private readonly AppDbContext _db;
    private readonly IDbContextFactory<AppDbContext> _dbFactory;

    public UserRepository(AppDbContext db, IDbContextFactory<AppDbContext> dbFactory)
    {
        _db = db;
        _dbFactory = dbFactory;
    }

    public Task<User?> GetByIdAsync(Guid id) =>
        _db.Users.Include(u => u.Subscriptions).FirstOrDefaultAsync(u => u.Id == id);

    public Task<User?> GetByCognitoSubAsync(string cognitoSub) =>
        _db.Users.Include(u => u.Subscriptions).FirstOrDefaultAsync(u => u.CognitoSub == cognitoSub);

    public async Task<User> GetOrCreateByCognitoSubAsync(string cognitoSub, string email)
    {
        var user = await GetByCognitoSubAsync(cognitoSub);
        if (user != null) return user;

        user = new User
        {
            Id = Guid.NewGuid(),
            CognitoSub = cognitoSub,
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
            _db.ChangeTracker.Clear();
            for (var attempt = 0; attempt < 3; attempt++)
            {
                if (attempt > 0)
                    await Task.Delay(TimeSpan.FromMilliseconds(50 * attempt));

                await using var freshDb = await _dbFactory.CreateDbContextAsync();
                var found = await freshDb.Users
                    .Include(u => u.Subscriptions)
                    .FirstOrDefaultAsync(u => u.CognitoSub == cognitoSub);

                if (found != null) return found;
            }

            throw new InvalidOperationException("User creation conflict could not be resolved.");
        }
    }

    public async Task<List<User>> GetTradespeopleAsync(string? trade, string? location)
    {
        try
        {
            var query = _db.Users
            .Include(u => u.Subscriptions)
            .Where(u => u.Trade != null);

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
