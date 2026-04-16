using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using OnsiteMonday.Api.DTOs.Notifications;
using OnsiteMonday.Api.Tests.Infrastructure;

namespace OnsiteMonday.Api.Tests.Integration;

public class NotificationsControllerTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private readonly HttpClient _client;
    private Guid _userId;
    private Guid _notificationId;

    public NotificationsControllerTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    public async Task InitializeAsync()
    {
        await _factory.SeedAsync(async db =>
        {
            // Seed the test user
            var user = TestBuilders.MakeUser();
            if (!db.Users.Any(u => u.FirebaseUid == FakeAuthHandler.TestFirebaseUid))
            {
                db.Users.Add(user);
                await db.SaveChangesAsync();
            }
            else
            {
                user = db.Users.First(u => u.FirebaseUid == FakeAuthHandler.TestFirebaseUid);
            }

            _userId = user.Id;

            // Seed two notifications
            var n1 = TestBuilders.MakeNotification(user.Id, isRead: false);
            var n2 = TestBuilders.MakeNotification(user.Id, isRead: false);
            db.Notifications.AddRange(n1, n2);
            await db.SaveChangesAsync();
            _notificationId = n1.Id;
        });
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task GetNotifications_Returns200WithList()
    {
        var response = await _client.GetAsync("/api/notifications");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var notifications = await response.Content.ReadFromJsonAsync<List<NotificationDto>>();
        notifications.Should().NotBeNull();
        notifications!.Count.Should().BeGreaterThanOrEqualTo(2);
    }

    [Fact]
    public async Task MarkRead_Returns204()
    {
        var response = await _client.PutAsync($"/api/notifications/{_notificationId}/read", null);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task MarkAllRead_Returns204()
    {
        var response = await _client.PutAsync("/api/notifications/read-all", null);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }
}
