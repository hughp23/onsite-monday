using Microsoft.EntityFrameworkCore;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Stubs;
using System.Text;
using System.Text.Json;

namespace OnsiteMonday.Api.Services;

// Sends push notifications via Expo's push service (https://expo.dev/notifications)
// Tokens are Expo push tokens registered from the mobile app.
public class FcmNotificationPushService : INotificationPushService
{
    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<FcmNotificationPushService> _logger;

    private static readonly Uri ExpoPushEndpoint = new("https://exp.host/--/api/v2/push/send");

    public FcmNotificationPushService(
        AppDbContext db,
        IHttpClientFactory httpClientFactory,
        ILogger<FcmNotificationPushService> logger)
    {
        _db = db;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task SendPushAsync(string userId, string title, string body, Dictionary<string, string>? data = null)
    {
        if (!Guid.TryParse(userId, out var userGuid))
            return;

        var tokens = await _db.DeviceTokens
            .Where(d => d.UserId == userGuid)
            .Select(d => d.Token)
            .ToListAsync();

        if (tokens.Count == 0)
            return;

        var client = _httpClientFactory.CreateClient("expo-push");
        var messages = tokens.Select(token => new
        {
            to = token,
            title,
            body,
            data = data ?? new Dictionary<string, string>(),
        });

        var json = JsonSerializer.Serialize(messages);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");

        try
        {
            var response = await client.PostAsync(ExpoPushEndpoint, content);
            if (!response.IsSuccessStatusCode)
                _logger.LogWarning("Expo push returned {Status}", response.StatusCode);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Expo push request failed");
        }
    }
}
