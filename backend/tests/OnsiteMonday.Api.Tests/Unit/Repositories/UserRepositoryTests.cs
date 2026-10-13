using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Repositories;

namespace OnsiteMonday.Api.Tests.Unit.Repositories;

public class UserRepositoryTests
{
    [Fact]
    public async Task GetTradespeople_WhenTheQueryFails_PropagatesTheOriginalException()
    {
        using var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options;
        var db = new AppDbContext(options);
        db.Database.EnsureCreated();
        var repo = new UserRepository(db, Mock.Of<IDbContextFactory<AppDbContext>>());
        db.Dispose();

        var act = () => repo.GetTradespeopleAsync(null, null, 1, 20);

        // Not wrapped in a generic Exception: the real type and message reach the
        // error middleware and the logs.
        await act.Should().ThrowExactlyAsync<ObjectDisposedException>();
    }
}
