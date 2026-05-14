using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using OnsiteMonday.Api.Tests.Infrastructure;

namespace OnsiteMonday.Api.Tests.Integration;

public class WalletControllerTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public WalletControllerTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateAuthenticatedClient();
    }

    public async Task InitializeAsync()
    {
        await _factory.SeedAsync(async db =>
        {
            if (!db.Users.Any(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid))
            {
                var user = TestBuilders.MakeUser();
                user.MangopayWalletId = "stub_wallet_123";
                db.Users.Add(user);
                await db.SaveChangesAsync();
            }
            else
            {
                var user = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
                user.MangopayWalletId = "stub_wallet_123";
                user.MangopayKycStatus = "none";
                user.MangopayBankAccountId = null;
                user.AutoWithdraw = false;
                await db.SaveChangesAsync();
            }
        });
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task GetWallet_Returns200_WithBalanceAndKycStatus()
    {
        var response = await _client.GetAsync("/api/wallet");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<WalletResponse>();
        body.Should().NotBeNull();
        body!.KycStatus.Should().Be("none");
        body.HasBankAccount.Should().BeFalse();
        body.AutoWithdraw.Should().BeFalse();
        body.Balance.Should().BeGreaterThanOrEqualTo(0);
    }

    [Fact]
    public async Task GetWallet_Unauthenticated_Returns401()
    {
        var client = _factory.CreateUnauthenticatedClient();
        var response = await client.GetAsync("/api/wallet");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Withdraw_WhenKycNotVerified_Returns400()
    {
        var response = await _client.PostAsync("/api/wallet/withdraw", null);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Withdraw_WhenKycVerifiedAndBankSet_Returns200()
    {
        await _factory.SeedAsync(async db =>
        {
            var user = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
            user.MangopayKycStatus = "verified";
            user.MangopayBankAccountId = "stub_bank_001";
            user.MangopayUserId = "stub_mango_user";
            user.MangopayWalletId = "stub_wallet_123";
            await db.SaveChangesAsync();
        });

        var response = await _client.PostAsync("/api/wallet/withdraw", null);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task PutAutoWithdraw_TogglesFlag()
    {
        var response = await _client.PutAsJsonAsync("/api/wallet/auto-withdraw", new { enabled = true });
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        await _factory.SeedAsync(async db =>
        {
            var user = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
            user.AutoWithdraw.Should().BeTrue();
        });
    }
}

public record WalletResponse(decimal Balance, long BalancePence, string KycStatus, bool HasBankAccount, bool AutoWithdraw);
