namespace OnsiteMonday.Api.Stubs;

public interface INotificationPushService
{
    Task SendPushAsync(string userId, string title, string body, Dictionary<string, string>? data = null);
}
