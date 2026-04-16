using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.DTOs.Users;
using OnsiteMonday.Api.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace OnsiteMonday.Api.Tests.Integration;

public class UsersControllerTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public UsersControllerTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    public async Task InitializeAsync()
    {
        // Ensure the test user exists in DB before each test
        await _factory.SeedAsync(async db =>
        {
            if (!db.Users.Any(u => u.FirebaseUid == FakeAuthHandler.TestFirebaseUid))
            {
                db.Users.Add(TestBuilders.MakeUser());
                await db.SaveChangesAsync();
            }
        });
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task GetMe_WithValidAuth_Returns200WithUserDto()
    {
        var response = await _client.GetAsync("/api/users/me");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<UserDto>();
        dto.Should().NotBeNull();
        dto!.Email.Should().Be(FakeAuthHandler.TestEmail);
    }

    [Fact]
    public async Task GetById_WhenUserExists_Returns200()
    {
        // Get the test user's ID first
        var meResponse = await _client.GetAsync("/api/users/me");
        var me = await meResponse.Content.ReadFromJsonAsync<UserDto>();

        var response = await _client.GetAsync($"/api/users/{me!.Id}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetById_WhenUserNotFound_Returns404()
    {
        var response = await _client.GetAsync($"/api/users/{Guid.NewGuid()}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UpdateMe_WithValidRequest_Returns200WithUpdatedName()
    {
        var request = new UpdateUserRequest { FirstName = "Updated" };
        var response = await _client.PutAsJsonAsync("/api/users/me", request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<UserDto>();
        dto!.FirstName.Should().Be("Updated");
    }

    [Fact]
    public async Task GetTradespeople_Returns200WithList()
    {
        // Seed a tradesperson if not already present
        await _factory.SeedAsync(async db =>
        {
            if (!db.Users.Any(u => u.FirebaseUid == "uid-tp"))
            {
                var tp = TestBuilders.MakeUser("uid-tp", "tp@test.com", "Alice", "Smith");
                tp.Trade = "Plumber";
                tp.Location = "Manchester";
                tp.IsOnboarded = true;
                db.Users.Add(tp);
                await db.SaveChangesAsync();
            }
        });

        var response = await _client.GetAsync("/api/users/tradespeople");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
