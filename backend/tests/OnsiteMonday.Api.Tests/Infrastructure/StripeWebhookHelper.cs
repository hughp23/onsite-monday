using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace OnsiteMonday.Api.Tests.Infrastructure;

public static class StripeWebhookHelper
{
    public const string TestWebhookSecret = "whsec_testsecret1234567890abcdefghij";

    // Stripe.net uses the full webhook secret (including "whsec_" prefix) as the raw UTF-8 HMAC key.
    private static readonly byte[] HmacKey =
        Encoding.UTF8.GetBytes(TestWebhookSecret);

    // Stripe.net uses the "object" field as a type discriminator when deserialising event data.
    // Without this field, ConstructEvent cannot cast data.object to the correct type.
    private static readonly Dictionary<string, string> ObjectTypeByEvent = new()
    {
        { "checkout.session.completed", "checkout.session" },
        { "customer.subscription.updated", "subscription" },
        { "customer.subscription.deleted", "subscription" },
        { "invoice.payment_failed", "invoice" },
        { "account.updated", "account" },
    };

    private static readonly JsonSerializerOptions SnakeCase = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    public static HttpContent BuildWebhookRequest(string eventType, object eventDataObject, string? objectId = null)
    {
        var id = objectId ?? "evt_" + Guid.NewGuid().ToString("N")[..12];

        // Serialise the data object, then inject the Stripe "object" type discriminator
        // that Stripe.net needs to cast data.object to the correct domain type.
        var dataNode = JsonSerializer.SerializeToNode(eventDataObject, SnakeCase)!.AsObject();
        if (ObjectTypeByEvent.TryGetValue(eventType, out var objectType) && !dataNode.ContainsKey("object"))
        {
            // Build a new object with "object" first (order matters for readability; Stripe.net doesn't care)
            var withDiscriminator = new JsonObject { ["object"] = objectType };
            foreach (var prop in dataNode)
                withDiscriminator[prop.Key] = prop.Value?.DeepClone();
            dataNode = withDiscriminator;
        }

        var envelope = new
        {
            id,
            type = eventType,
            data = new { @object = dataNode },
            livemode = false,
            api_version = "2026-03-25.dahlia",  // must match Stripe.net 51.x expected version
        };

        var payload = JsonSerializer.Serialize(envelope, SnakeCase);

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
