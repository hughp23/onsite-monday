using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using OnsiteMonday.Api.DTOs.Subscriptions;
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
    public async Task GetUsage_Returns200WithLimits()
    {
        var response = await _client.GetAsync("/api/subscriptions/usage");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var usage = await response.Content.ReadFromJsonAsync<UsageDto>();
        usage!.PeriodEnd.Should().BeAfter(usage.PeriodStart);
        usage.PostsUsed.Should().BeGreaterThanOrEqualTo(0);
    }
}
