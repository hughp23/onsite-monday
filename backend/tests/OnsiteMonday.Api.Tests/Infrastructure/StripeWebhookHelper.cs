using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace OnsiteMonday.Api.Tests.Infrastructure;

public static class StripeWebhookHelper
{
    public const string TestWebhookSecret = "whsec_testsecret1234567890abcdefghij";

    private static readonly byte[] HmacKey =
        Encoding.UTF8.GetBytes(TestWebhookSecret.Replace("whsec_", ""));

    public static HttpContent BuildWebhookRequest(string eventType, object eventDataObject, string? objectId = null)
    {
        var id = objectId ?? "evt_" + Guid.NewGuid().ToString("N")[..12];
        var envelope = new
        {
            id,
            type = eventType,
            data = new { @object = eventDataObject },
            livemode = false,
            api_version = "2023-10-16",
        };

        var payload = JsonSerializer.Serialize(envelope, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        });

        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var signed = $"{timestamp}.{payload}";
        using var hmac = new HMACSHA256(HmacKey);
        var sigBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(signed));
        var sigHex = Convert.ToHexString(sigBytes).ToLower();
        var stripeSignature = $"t={timestamp},v1={sigHex}";

        var content = new StringContent(payload, Encoding.UTF8, "application/json");
        content.Headers.Add("Stripe-Signature", stripeSignature);
        return content;
    }
}
