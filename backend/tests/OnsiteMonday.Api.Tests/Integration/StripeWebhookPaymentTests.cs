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
    public async Task Webhook_CheckoutSessionCompleted_WhenAlreadyProgressed_DoesNotRegressPaymentStatus()
    {
        var jobId = Guid.NewGuid();
        const string sessionId = "cs_test_idempotent_001";
        await _factory.SeedAsync(async db =>
        {
            var job = TestBuilders.MakeJob(_posterId, status: "completed", id: jobId,
                paymentStatus: "payout_pending",   // already past escrowed
                stripeCheckoutSessionId: sessionId);
            db.Jobs.Add(job);
            await db.SaveChangesAsync();
        });

        var eventPayload = new
        {
            id = sessionId,
            mode = "payment",
            payment_status = "paid",
            payment_intent = "pi_redelivered_001",
            metadata = new Dictionary<string, string> { ["jobId"] = jobId.ToString() },
        };
        var content = StripeWebhookHelper.BuildWebhookRequest(
            "checkout.session.completed", eventPayload, sessionId);

        var response = await _webhookClient.PostAsync("/api/webhooks/stripe", content);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        await _factory.SeedAsync(async db =>
        {
            var job = await db.Jobs.FindAsync(jobId);
            job!.PaymentStatus.Should().Be("payout_pending"); // must NOT have regressed to "escrowed"
        });
    }

    [Fact]
    public async Task Webhook_CheckoutSessionCompleted_Payment_StoresPaymentIntentId()
    {
        var jobId = Guid.NewGuid();
        const string sessionId = "cs_test_pi_capture_001";
        const string paymentIntentId = "pi_captured_001";

        await _factory.SeedAsync(async db =>
        {
            var job = TestBuilders.MakeJob(_posterId, status: "in_progress", id: jobId,
                paymentStatus: "payin_pending",
                stripeCheckoutSessionId: sessionId);
            db.Jobs.Add(job);
            await db.SaveChangesAsync();
        });

        var eventPayload = new
        {
            id = sessionId,
            mode = "payment",
            payment_status = "paid",
            payment_intent = paymentIntentId,
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
            job.StripePaymentIntentId.Should().Be(paymentIntentId);
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

    private static object SubscriptionUpdatedPayload(string stripeSubId, string priceId, string? nickname = null) => new
    {
        id = stripeSubId,
        status = "active",
        items = new
        {
            @object = "list",
            data = new[]
            {
                new
                {
                    id = "si_" + stripeSubId,
                    @object = "subscription_item",
                    price = new { id = priceId, @object = "price", nickname },
                },
            },
        },
    };

    private async Task<Guid> SeedBronzeSubscriptionAsync(string stripeSubId)
    {
        var localSubId = Guid.NewGuid();
        await _factory.SeedAsync(async db =>
        {
            var user = TestBuilders.MakeUser($"uid-sub-{stripeSubId}", $"{stripeSubId}@test.com");
            db.Users.Add(user);
            db.Subscriptions.Add(new OnsiteMonday.Api.Domain.Subscription
            {
                Id = localSubId, UserId = user.Id, Tier = "bronze", PayoutDays = 30,
                IsActive = true, StartedAt = DateTimeOffset.UtcNow, StripeSubscriptionId = stripeSubId,
            });
            await db.SaveChangesAsync();
        });
        return localSubId;
    }

    [Fact]
    public async Task Webhook_SubscriptionUpdated_ConfiguredPrice_SyncsTierAndPayoutDays()
    {
        var stripeSubId = $"sub_upgrade_{_uniqueSuffix}";
        var localSubId = await SeedBronzeSubscriptionAsync(stripeSubId);

        // Nickname deliberately says nothing about the tier: the price ID decides.
        var content = StripeWebhookHelper.BuildWebhookRequest(
            "customer.subscription.updated",
            SubscriptionUpdatedPayload(stripeSubId, TestPriceIds.Gold, nickname: "Monthly plan"),
            stripeSubId);

        var response = await _webhookClient.PostAsync("/api/webhooks/stripe", content);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        await _factory.SeedAsync(async db =>
        {
            var sub = await db.Subscriptions.AsNoTracking().FirstAsync(s => s.Id == localSubId);
            sub.Tier.Should().Be("gold");
            sub.PayoutDays.Should().Be(7);
        });
    }

    [Fact]
    public async Task Webhook_SubscriptionUpdated_UnrecognisedPrice_LeavesTierUnchanged()
    {
        var stripeSubId = $"sub_unknown_{_uniqueSuffix}";
        var localSubId = await SeedBronzeSubscriptionAsync(stripeSubId);

        // A nickname containing a tier name used to be enough; it no longer is.
        var content = StripeWebhookHelper.BuildWebhookRequest(
            "customer.subscription.updated",
            SubscriptionUpdatedPayload(stripeSubId, "price_not_configured", nickname: "Gold monthly"),
            stripeSubId);

        var response = await _webhookClient.PostAsync("/api/webhooks/stripe", content);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        await _factory.SeedAsync(async db =>
        {
            var sub = await db.Subscriptions.AsNoTracking().FirstAsync(s => s.Id == localSubId);
            sub.Tier.Should().Be("bronze");
            sub.PayoutDays.Should().Be(30);
        });
    }
}
