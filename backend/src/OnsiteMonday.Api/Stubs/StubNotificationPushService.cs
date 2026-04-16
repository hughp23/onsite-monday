namespace OnsiteMonday.Api.Stubs;

public class StubNotificationPushService : INotificationPushService
{
    private readonly ILogger<StubNotificationPushService> _logger;

    public StubNotificationPushService(ILogger<StubNotificationPushService> logger) => _logger = logger;

    public Task SendPushAsync(string userId, string title, string body, Dictionary<string, string>? data = null)
    {
        _logger.LogInformation("[STUB] FCM: Push to {UserId} — {Title}: {Body}", userId, title, body);
        return Task.CompletedTask;
    }
}
