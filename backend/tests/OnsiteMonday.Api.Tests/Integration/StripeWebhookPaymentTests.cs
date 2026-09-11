using System.Net;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using OnsiteMonday.Api.Tests.Infrastructure;

namespace OnsiteMonday.Api.Tests.Integration;

public class StripeWebhookPaymentTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private readonly HttpClient _webhookClient;
    private Guid _posterId;
    private readonly string _uniqueSuffix = Guid.NewGuid().ToString("N")[..8];

    public StripeWebhookPaymentTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _webhookClient = factory.CreateUnauthenticatedClient();
    }

    public async Task InitializeAsync()
    {
        await _factory.SeedAsync(async db =>
        {
            if (!db.Users.Any(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid))
            {
                var poster = TestBuilders.MakeUser();
                db.Users.Add(poster);
                await db.SaveChangesAsync();
                _posterId = poster.Id;
            }
            else
            {
                _posterId = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid).Id;
            }
        });
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Webhook_CheckoutSessionCompleted_Payment_Sets_Escrowed()
    {
        var jobId = Guid.NewGuid();
        const string sessionId = "cs_test_escrowed_001";
        await _factory.SeedAsync(async db =>
        {
            var job = TestBuilders.MakeJob(_posterId, status: "in_progress", id: jobId,
                paymentStatus: "payin_pending", stripeCheckoutSessionId: sessionId);
            db.Jobs.Add(job);
            await db.SaveChangesAsync();
        });

        var eventPayload = new
        {
            id = sessionId,
            mode = "payment",
            payment_status = "paid",
            metadata = new Dictionary<string, string> { ["jobId"] = jobId.ToString() },
        };
        var content = StripeWebhookHelper.BuildWebhookRequest(
            "checkout.session.completed", eventPayload, sessionId);

        var response = await _webhookClient.PostAsync("/api/webhooks/stripe", content);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        await _factory.SeedAsync(async db =>
        {
            var job = await db.Jobs.FindAsync(jobId);
            job!.PaymentStatus.Should().Be("escrowed");
        });
    }

    [Fact]
    public async Task Webhook_AccountUpdated_Sets_OnboardingComplete()
    {
        var userId = Guid.NewGuid();
        const string accountId = "acct_onboarding_001";
        await _factory.SeedAsync(async db =>
        {
            var user = TestBuilders.MakeUserWithStripeConnect(
                $"uid-{_uniqueSuffix}", $"tp-{_uniqueSuffix}@test.com",
                accountId, onboardingComplete: false);
            user.Id = userId;
            db.Users.Add(user);
            await db.SaveChangesAsync();
        });

        var eventPayload = new
        {
            id = accountId,
            charges_enabled = true,
            payouts_enabled = true,
            details_submitted = true,
        };
        var content = StripeWebhookHelper.BuildWebhookRequest("account.updated", eventPayload, accountId);

        var response = await _webhookClient.PostAsync("/api/webhooks/stripe", content);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        await _factory.SeedAsync(async db =>
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.StripeConnectAccountId == accountId);
            user!.StripeConnectOnboardingComplete.Should().BeTrue();
        });
    }
}
