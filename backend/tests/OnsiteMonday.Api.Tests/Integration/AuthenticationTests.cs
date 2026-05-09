using System.Net;
using FluentAssertions;
using OnsiteMonday.Api.Tests.Infrastructure;

namespace OnsiteMonday.Api.Tests.Integration;

public class AuthenticationTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly TestWebApplicationFactory _factory;

    public AuthenticationTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task ProtectedEndpoint_WithoutToken_Returns401()
    {
        var client = _factory.CreateUnauthenticatedClient();

        var response = await client.GetAsync("/api/users/me");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithToken_Returns200Or404()
    {
        var client = _factory.CreateAuthenticatedClient();

        var response = await client.GetAsync("/api/users/me");

        // 200 if the user exists in the test DB, 404 if not seeded — either way not 401
        response.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task HealthEndpoint_WithoutToken_Returns200()
    {
        var client = _factory.CreateUnauthenticatedClient();

        var response = await client.GetAsync("/api/health");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task StripeWebhookEndpoint_WithoutToken_IsNotBlocked()
    {
        // Webhook controllers have no [Authorize] — they use their own signature validation.
        // This confirms the endpoint is reachable without a bearer token.
        // It will return 400 (bad request / missing Stripe signature) not 401.
        var client = _factory.CreateUnauthenticatedClient();

        var response = await client.PostAsync("/api/webhooks/stripe", new StringContent("{}"));

        response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized);
    }
}
