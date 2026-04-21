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
    private static (AppDbContext db, Mock<IMangopayService> mangopay, Mock<IStripeBillingService> stripe, SubscriptionService sut) CreateSut()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();
        // Disable FK enforcement so tests that don't seed a User can still insert Subscriptions
        using (var pragma = connection.CreateCommand())
        {
            pragma.CommandText = "PRAGMA foreign_keys=OFF";
            pragma.ExecuteNonQuery();
        }
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(connection)
            .Options;
        var db = new AppDbContext(options);
        db.Database.EnsureCreated();

        var mangopay = new Mock<IMangopayService>();
        mangopay.Setup(m => m.EnsureUserAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync("stub_mango_user");
        mangopay.Setup(m => m.EnsureWalletAsync(It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync("stub_wallet");

        var stripe = new Mock<IStripeBillingService>();
        stripe.Setup(s => s.EnsureCustomerAsync(It.IsAny<Guid>(), It.IsAny<string>()))
            .ReturnsAsync("cus_stub");
        stripe.Setup(s => s.CreateSubscriptionCheckoutAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(("sub_stub", "https://checkout.stripe.com/stub"));
        stripe.Setup(s => s.CancelSubscriptionAsync(It.IsAny<string>()))
            .Returns(Task.CompletedTask);

        var sut = new SubscriptionService(db, mangopay.Object, stripe.Object);
        return (db, mangopay, stripe, sut);
    }

    [Fact]
    public async Task UpdateSubscription_Bronze_SetsPayoutDays30()
    {
        var (_, _, _, sut) = CreateSut();
        var userId = Guid.NewGuid();

        var result = await sut.UpdateSubscriptionAsync(userId, "bronze");

        result.Subscription.Tier.Should().Be("bronze");
        result.Subscription.PayoutDays.Should().Be(30);
    }

    [Fact]
    public async Task UpdateSubscription_Silver_SetsPayoutDays14()
    {
        var (_, _, _, sut) = CreateSut();
        var userId = Guid.NewGuid();

        var result = await sut.UpdateSubscriptionAsync(userId, "silver");

        result.Subscription.Tier.Should().Be("silver");
        result.Subscription.PayoutDays.Should().Be(14);
    }

    [Fact]
    public async Task UpdateSubscription_Gold_SetsPayoutDays7()
    {
        var (_, _, _, sut) = CreateSut();
        var userId = Guid.NewGuid();

        var result = await sut.UpdateSubscriptionAsync(userId, "gold");

        result.Subscription.Tier.Should().Be("gold");
        result.Subscription.PayoutDays.Should().Be(7);
    }

    [Fact]
    public async Task UpdateSubscription_IsCaseInsensitive()
    {
        var (_, _, _, sut) = CreateSut();
        var userId = Guid.NewGuid();

        var result = await sut.UpdateSubscriptionAsync(userId, "GOLD");

        result.Subscription.Tier.Should().Be("gold");
        result.Subscription.PayoutDays.Should().Be(7);
    }

    [Fact]
    public async Task UpdateSubscription_InvalidTier_ThrowsArgumentException()
    {
        var (_, _, _, sut) = CreateSut();

        var act = () => sut.UpdateSubscriptionAsync(Guid.NewGuid(), "platinum");

        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Invalid tier*");
    }

    [Fact]
    public async Task UpdateSubscription_DeactivatesPreviousSubscription()
    {
        var (db, _, _, sut) = CreateSut();
        var userId = Guid.NewGuid();

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

        // ExecuteUpdateAsync bypasses the change tracker; reload from DB
        await db.Entry(oldSub).ReloadAsync();
        oldSub.IsActive.Should().BeFalse();
        oldSub.CancelledAt.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateSubscription_ProvisionsMangopayWallet_WhenUserExists()
    {
        var (db, mangopay, _, sut) = CreateSut();
        var userId = Guid.NewGuid();

        var user = new User
        {
            Id = userId,
            FirebaseUid = "uid-test",
            FirstName = "Bob",
            LastName = "Smith",
            Email = "bob@test.com",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        await sut.UpdateSubscriptionAsync(userId, "gold");

        mangopay.Verify(m => m.EnsureUserAsync(userId, user.Email, user.FirstName, user.LastName), Times.Once);
        mangopay.Verify(m => m.EnsureWalletAsync("stub_mango_user", It.IsAny<string>()), Times.Once);

        var updatedUser = await db.Users.FindAsync(userId);
        updatedUser!.MangopayUserId.Should().Be("stub_mango_user");
        updatedUser.MangopayWalletId.Should().Be("stub_wallet");
    }

    [Fact]
    public async Task UpdateSubscription_CallsStripeCreateSubscriptionCheckout_WhenUserExists()
    {
        var (db, _, stripe, sut) = CreateSut();
        var userId = Guid.NewGuid();

        var user = new User
        {
            Id = userId,
            FirebaseUid = "uid-stripe-test",
            FirstName = "Jane",
            LastName = "Doe",
            Email = "jane@test.com",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var result = await sut.UpdateSubscriptionAsync(userId, "silver");

        stripe.Verify(s => s.EnsureCustomerAsync(userId, user.Email), Times.Once);
        stripe.Verify(s => s.CreateSubscriptionCheckoutAsync("cus_stub", "silver", It.IsAny<string>(), It.IsAny<string>()), Times.Once);
        result.CheckoutUrl.Should().Be("https://checkout.stripe.com/stub");
    }

    [Fact]
    public async Task UpdateSubscription_CancelsPreviousStripeSubscription_WhenOneExists()
    {
        var (db, _, stripe, sut) = CreateSut();
        var userId = Guid.NewGuid();

        var oldSub = new Subscription
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Tier = "bronze",
            PayoutDays = 30,
            IsActive = true,
            StartedAt = DateTimeOffset.UtcNow.AddMonths(-1),
            StripeSubscriptionId = "sub_old_123",
        };
        db.Subscriptions.Add(oldSub);
        await db.SaveChangesAsync();

        await sut.UpdateSubscriptionAsync(userId, "gold");

        stripe.Verify(s => s.CancelSubscriptionAsync("sub_old_123"), Times.Once);
    }

    [Fact]
    public async Task UpdateSubscription_DoesNotCancelStripe_WhenNoPreviousSubscription()
    {
        var (_, _, stripe, sut) = CreateSut();

        await sut.UpdateSubscriptionAsync(Guid.NewGuid(), "gold");

        stripe.Verify(s => s.CancelSubscriptionAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task GetCurrent_WhenNoActiveSubscription_ReturnsNull()
    {
        var (_, _, _, sut) = CreateSut();

        var result = await sut.GetCurrentAsync(Guid.NewGuid());

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetCurrent_WhenActiveSubscriptionExists_ReturnsDto()
    {
        var (db, _, _, sut) = CreateSut();
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
