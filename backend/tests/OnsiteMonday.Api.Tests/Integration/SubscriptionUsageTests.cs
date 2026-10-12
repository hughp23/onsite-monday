using System.Net;
using System.Text.Json;
using FluentAssertions;
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.Tests.Infrastructure;

namespace OnsiteMonday.Api.Tests.Integration;

public class SubscriptionUsageTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public SubscriptionUsageTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateAuthenticatedClient();
    }

    public async Task InitializeAsync()
    {
        // The seeded user has no subscriptions, so usage resolves to the Bronze tier.
        await _factory.SeedAsync(async db =>
        {
            if (!db.Users.Any(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid))
            {
                db.Users.Add(TestBuilders.MakeUser());
                await db.SaveChangesAsync();
            }
        });
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task GetUsage_ReturnsCamelCaseContract()
    {
        var response = await _client.GetAsync("/api/subscriptions/usage");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = doc.RootElement;

        foreach (var key in new[]
                 {
                     "tier", "postsUsed", "postsLimit", "applicationsUsed",
                     "applicationsLimit", "periodStart", "periodEnd",
                 })
        {
            root.TryGetProperty(key, out _).Should().BeTrue($"response should contain camelCase key '{key}'");
        }

        root.GetProperty("postsUsed").GetInt32().Should().BeGreaterThanOrEqualTo(0);
        DateTimeOffset.Parse(root.GetProperty("periodEnd").GetString()!)
            .Should().BeAfter(DateTimeOffset.Parse(root.GetProperty("periodStart").GetString()!));
    }

    [Fact]
    public async Task GetUsage_NoSubscription_ReturnsBronzeLimits()
    {
        var response = await _client.GetAsync("/api/subscriptions/usage");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = doc.RootElement;

        root.GetProperty("tier").GetString().Should().Be("bronze");
        root.GetProperty("postsLimit").GetInt32().Should().Be(TierLimits.PostsPerMonth("bronze"));
        root.GetProperty("applicationsLimit").GetInt32().Should().Be(TierLimits.ApplicationsPerMonth("bronze"));
    }
}
