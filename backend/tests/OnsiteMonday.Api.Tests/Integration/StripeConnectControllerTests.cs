using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using OnsiteMonday.Api.Tests.Infrastructure;

namespace OnsiteMonday.Api.Tests.Integration;

public class StripeConnectControllerTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private readonly HttpClient _client;
    private readonly HttpClient _unauthenticated;

    public StripeConnectControllerTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateAuthenticatedClient();
        _unauthenticated = factory.CreateUnauthenticatedClient();
    }

    public async Task InitializeAsync()
    {
        await _factory.SeedAsync(async db =>
        {
            if (!db.Users.Any(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid))
            {
                db.Users.Add(TestBuilders.MakeUser());
                await db.SaveChangesAsync();
            }
            else
            {
                var user = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
                user.StripeConnectAccountId = null;
                user.StripeConnectOnboardingComplete = false;
                await db.SaveChangesAsync();
            }
        });
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task GetAccountStatus_Returns_OnboardingIncomplete_WhenNoAccount()
    {
        var response = await _client.GetAsync("/api/stripe-connect/account-status");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<AccountStatusResponse>();
        body!.OnboardingComplete.Should().BeFalse();
        body.AccountId.Should().BeNull();
    }

    [Fact]
    public async Task GetAccountStatus_Returns_OnboardingComplete_WhenConnected()
    {
        await _factory.SeedAsync(async db =>
        {
            var user = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
            user.StripeConnectAccountId = "stub_acct_test";
            user.StripeConnectOnboardingComplete = true;
            await db.SaveChangesAsync();
        });

        var response = await _client.GetAsync("/api/stripe-connect/account-status");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<AccountStatusResponse>();
        body!.OnboardingComplete.Should().BeTrue();
        body.AccountId.Should().Be("stub_acct_test");
    }

    [Fact]
    public async Task GetAccountStatus_Unauthenticated_Returns401()
    {
        var response = await _unauthenticated.GetAsync("/api/stripe-connect/account-status");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CreateOnboardingLink_Returns_Url()
    {
        var response = await _client.PostAsync("/api/stripe-connect/onboarding-link", null);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<OnboardingLinkResponse>();
        body!.OnboardingUrl.Should().StartWith("https://");
    }

    [Fact]
    public async Task CreateOnboardingLink_Unauthenticated_Returns401()
    {
        var response = await _unauthenticated.PostAsync("/api/stripe-connect/onboarding-link", null);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CreateOnboardingLink_SetsStripeConnectAccountId_OnUser()
    {
        var response = await _client.PostAsync("/api/stripe-connect/onboarding-link", null);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        await _factory.SeedAsync(async db =>
        {
            var user = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
            user.StripeConnectAccountId.Should().NotBeNullOrEmpty();
            await Task.CompletedTask;
        });
    }
}

public record AccountStatusResponse(bool OnboardingComplete, string? AccountId);
public record OnboardingLinkResponse(string OnboardingUrl);
