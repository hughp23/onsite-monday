using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.DTOs.Jobs;
using OnsiteMonday.Api.Jobs;
using OnsiteMonday.Api.Tests.Infrastructure;

namespace OnsiteMonday.Api.Tests.Integration;

public class PaymentFlowIntegrationTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private readonly HttpClient _posterClient;
    private readonly HttpClient _webhookClient;

    private Guid _posterId;
    private Guid _tradespersonId;
    private Guid _jobId;

    private readonly string _uniqueSuffix = Guid.NewGuid().ToString("N")[..8];

    public PaymentFlowIntegrationTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _posterClient = factory.CreateAuthenticatedClient();
        _webhookClient = factory.CreateUnauthenticatedClient();
    }

    public async Task InitializeAsync()
    {
        await _factory.SeedAsync(async db =>
        {
            if (!db.Users.Any(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid))
            {
                var poster = TestBuilders.MakeUser(FakeAuthHandler.TestFirebaseUid, FakeAuthHandler.TestEmail);
                db.Users.Add(poster);
                await db.SaveChangesAsync();
                _posterId = poster.Id;
            }
            else
            {
                _posterId = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid).Id;
            }

            var tradesperson = TestBuilders.MakeUserWithStripeConnect(
                $"uid-tradesperson-{_uniqueSuffix}",
                $"tradesperson-{_uniqueSuffix}@test.com",
                $"acct_{_uniqueSuffix}",
                onboardingComplete: true);
            db.Users.Add(tradesperson);
            await db.SaveChangesAsync();
            _tradespersonId = tradesperson.Id;

            var job = TestBuilders.MakeJob(_posterId, status: "accepted", id: Guid.NewGuid());
            db.Jobs.Add(job);
            await db.SaveChangesAsync();
            _jobId = job.Id;

            db.JobApplications.Add(new JobApplication
            {
                Id = Guid.NewGuid(), JobId = _jobId, ApplicantId = _tradespersonId,
                Status = "accepted", AppliedAt = DateTimeOffset.UtcNow,
                AcceptedAt = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync();
        });
    }

    public Task DisposeAsync() => Task.CompletedTask;

    // ── Test 1: StartJob returns Stripe checkout URL and sets payin_pending ──

    [Fact]
    public async Task StartJob_Returns_CheckoutUrl_And_Sets_PayinPending()
    {
        var response = await _posterClient.PutAsync($"/api/jobs/{_jobId}/start", null);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<JobStartResponse>();
        result!.CheckoutUrl.Should().NotBeNullOrEmpty();
        result.Job.Status.Should().Be("in_progress");

        await _factory.SeedAsync(async db =>
        {
            var job = await db.Jobs.FindAsync(_jobId);
            job!.PaymentStatus.Should().Be("payin_pending");
            job.StripeCheckoutSessionId.Should().NotBeNullOrEmpty();
        });
    }

    // ── Test 2: Stripe webhook checkout.session.completed sets escrowed ──

    [Fact]
    public async Task Webhook_CheckoutCompleted_Sets_Escrowed()
    {
        var jobId = Guid.NewGuid();
        const string sessionId = "cs_test_webhook_escrowed";
        await _factory.SeedAsync(async db =>
        {
            var poster = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
            var job = TestBuilders.MakeJob(poster.Id, status: "in_progress", id: jobId,
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

    // ── Test 3: CompleteJob sets completed, leaves PaymentStatus as escrowed ──

    [Fact]
    public async Task CompleteJob_Sets_Completed_And_Does_Not_Move_PaymentStatus()
    {
        var jobId = Guid.NewGuid();
        var tradespersonId = _tradespersonId;
        await _factory.SeedAsync(async db =>
        {
            var poster = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
            var job = TestBuilders.MakeJob(poster.Id, status: "in_progress", id: jobId,
                paymentStatus: "escrowed", stripeCheckoutSessionId: "cs_test_complete_001");
            db.Jobs.Add(job);
            await db.SaveChangesAsync();

            db.JobApplications.Add(new JobApplication
            {
                Id = Guid.NewGuid(), JobId = jobId, ApplicantId = tradespersonId,
                Status = "accepted", AppliedAt = DateTimeOffset.UtcNow, AcceptedAt = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync();
        });

        var response = await _posterClient.PutAsync($"/api/jobs/{jobId}/complete", null);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        await _factory.SeedAsync(async db =>
        {
            var job = await db.Jobs.FindAsync(jobId);
            job!.Status.Should().Be("completed");
            job.PaymentStatus.Should().Be("escrowed");
            job.HangfireJobId.Should().BeNull();
        });
    }

    // ── Test 4: SubmitReview on completed+escrowed job schedules payout ──

    [Fact]
    public async Task SubmitReview_On_CompletedEscrowedJob_Schedules_Payout()
    {
        var jobId = Guid.NewGuid();
        var tradespersonId = _tradespersonId;
        await _factory.SeedAsync(async db =>
        {
            var poster = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
            var job = TestBuilders.MakeJob(poster.Id, status: "completed", id: jobId,
                paymentStatus: "escrowed", stripeCheckoutSessionId: "cs_test_review_001");
            db.Jobs.Add(job);
            await db.SaveChangesAsync();

            db.JobApplications.Add(new JobApplication
            {
                Id = Guid.NewGuid(), JobId = jobId, ApplicantId = tradespersonId,
                Status = "accepted", AppliedAt = DateTimeOffset.UtcNow, AcceptedAt = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync();
        });

        var reviewRequest = new
        {
            JobId = jobId,
            Rating = 5,
            Text = "Great work, highly recommend!"
        };
        var response = await _posterClient.PostAsJsonAsync(
            $"/api/users/{_tradespersonId}/reviews", reviewRequest);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        await _factory.SeedAsync(async db =>
        {
            var job = await db.Jobs.FindAsync(jobId);
            job!.PaymentStatus.Should().Be("payout_pending");
            job.HangfireJobId.Should().NotBeNull();
        });
    }

    // ── Test 5: PayoutReleaseJob transfers funds and sets payout_complete ──

    [Fact]
    public async Task PayoutReleaseJob_Transfers_Funds_And_Sets_PayoutComplete()
    {
        var jobId = Guid.NewGuid();
        var tradespersonId = _tradespersonId;
        await _factory.SeedAsync(async db =>
        {
            var poster = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
            var job = TestBuilders.MakeJob(poster.Id, status: "completed", id: jobId,
                paymentStatus: "payout_pending", stripeCheckoutSessionId: "cs_test_payout_001");
            job.HangfireJobId = "fake-hangfire-job-id";
            db.Jobs.Add(job);
            await db.SaveChangesAsync();

            db.JobApplications.Add(new JobApplication
            {
                Id = Guid.NewGuid(), JobId = jobId, ApplicantId = tradespersonId,
                Status = "accepted", AppliedAt = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync();
        });

        using var scope = _factory.Services.CreateScope();
        var payoutJob = scope.ServiceProvider.GetRequiredService<IPayoutReleaseJob>();
        await payoutJob.ExecuteAsync(jobId);

        await _factory.SeedAsync(async db =>
        {
            var job = await db.Jobs.FindAsync(jobId);
            job!.PaymentStatus.Should().Be("payout_complete");
            job.StripeTransferId.Should().NotBeNullOrEmpty();
        });
    }

    // ── Test 6: PayoutReleaseJob is idempotent — skips if already payout_complete ──

    [Fact]
    public async Task PayoutReleaseJob_IsIdempotent_When_Already_PayoutComplete()
    {
        var jobId = Guid.NewGuid();
        var tradespersonId = _tradespersonId;
        await _factory.SeedAsync(async db =>
        {
            var poster = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
            var job = TestBuilders.MakeJob(poster.Id, status: "completed", id: jobId,
                paymentStatus: "payout_complete"); // already paid out
            db.Jobs.Add(job);
            await db.SaveChangesAsync();

            db.JobApplications.Add(new JobApplication
            {
                Id = Guid.NewGuid(), JobId = jobId, ApplicantId = tradespersonId,
                Status = "accepted", AppliedAt = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync();
        });

        using var scope = _factory.Services.CreateScope();
        var payoutJob = scope.ServiceProvider.GetRequiredService<IPayoutReleaseJob>();
        // Must not throw — guard on PaymentStatus != "payout_pending" prevents double-transfer
        await payoutJob.ExecuteAsync(jobId);

        await _factory.SeedAsync(async db =>
        {
            var job = await db.Jobs.FindAsync(jobId);
            job!.PaymentStatus.Should().Be("payout_complete");
            job.StripeTransferId.Should().BeNull(); // no transfer was made
        });
    }
}
