using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.Services;
using OnsiteMonday.Api.Stubs;

namespace OnsiteMonday.Api.Tests.Unit.Services;

public class SubscriptionServiceTests
{
    // EF InMemory doesn't support ExecuteUpdateAsync (it's a relational bulk-update).
    // Use SQLite :memory: with a kept-open connection so each test gets an isolated database.
    private static (AppDbContext db, Mock<IStripeService> stripe, SubscriptionService sut) CreateSut()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(connection)
            .Options;
        var db = new AppDbContext(options);
        db.Database.EnsureCreated();
        var stripe = new Mock<IStripeService>();
        var sut = new SubscriptionService(db, stripe.Object);
        return (db, stripe, sut);
    }

    [Fact]
    public async Task UpdateSubscription_Bronze_SetsPayoutDays30()
    {
        var (_, _, sut) = CreateSut();
        var userId = Guid.NewGuid();

        var result = await sut.UpdateSubscriptionAsync(userId, "bronze");

        result.Tier.Should().Be("bronze");
        result.PayoutDays.Should().Be(30);
    }

    [Fact]
    public async Task UpdateSubscription_Silver_SetsPayoutDays14()
    {
        var (_, _, sut) = CreateSut();
        var userId = Guid.NewGuid();

        var result = await sut.UpdateSubscriptionAsync(userId, "silver");

        result.Tier.Should().Be("silver");
        result.PayoutDays.Should().Be(14);
    }

    [Fact]
    public async Task UpdateSubscription_Gold_SetsPayoutDays7()
    {
        var (_, _, sut) = CreateSut();
        var userId = Guid.NewGuid();

        var result = await sut.UpdateSubscriptionAsync(userId, "gold");

        result.Tier.Should().Be("gold");
        result.PayoutDays.Should().Be(7);
    }

    [Fact]
    public async Task UpdateSubscription_IsCaseInsensitive()
    {
        var (_, _, sut) = CreateSut();
        var userId = Guid.NewGuid();

        var result = await sut.UpdateSubscriptionAsync(userId, "GOLD");

        result.Tier.Should().Be("gold");
        result.PayoutDays.Should().Be(7);
    }

    [Fact]
    public async Task UpdateSubscription_InvalidTier_ThrowsArgumentException()
    {
        var (_, _, sut) = CreateSut();

        var act = () => sut.UpdateSubscriptionAsync(Guid.NewGuid(), "platinum");

        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Invalid tier*");
    }

    [Fact]
    public async Task UpdateSubscription_DeactivatesPreviousSubscription()
    {
        var (db, _, sut) = CreateSut();
        var userId = Guid.NewGuid();

        // Seed an existing active subscription
        var oldSub = new Subscription
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Tier = "bronze",
            PayoutDays = 30,
            IsActive = true,
            StartedAt = DateTimeOffset.UtcNow.AddMonths(-1),
        };
        db.Subscriptions.Add(oldSub);
        await db.SaveChangesAsync();

        await sut.UpdateSubscriptionAsync(userId, "silver");

        var deactivated = await db.Subscriptions.FindAsync(oldSub.Id);
        deactivated!.IsActive.Should().BeFalse();
        deactivated.CancelledAt.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateSubscription_CallsStripeCreateConnectAccount()
    {
        var (_, stripe, sut) = CreateSut();
        stripe
            .Setup(s => s.CreateConnectAccountAsync(It.IsAny<string>()))
            .ReturnsAsync("acct_test");

        var userId = Guid.NewGuid();
        await sut.UpdateSubscriptionAsync(userId, "gold");

        stripe.Verify(s => s.CreateConnectAccountAsync(userId.ToString()), Times.Once);
    }

    [Fact]
    public async Task GetCurrent_WhenNoActiveSubscription_ReturnsNull()
    {
        var (_, _, sut) = CreateSut();

        var result = await sut.GetCurrentAsync(Guid.NewGuid());

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetCurrent_WhenActiveSubscriptionExists_ReturnsDto()
    {
        var (db, _, sut) = CreateSut();
        var userId = Guid.NewGuid();
        var sub = new Subscription
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Tier = "silver",
            PayoutDays = 14,
            IsActive = true,
            StartedAt = DateTimeOffset.UtcNow,
        };
        db.Subscriptions.Add(sub);
        await db.SaveChangesAsync();

        var result = await sut.GetCurrentAsync(userId);

        result.Should().NotBeNull();
        result!.Tier.Should().Be("silver");
        result.PayoutDays.Should().Be(14);
    }
}
