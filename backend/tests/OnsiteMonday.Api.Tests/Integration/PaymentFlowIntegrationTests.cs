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

    public PaymentFlowIntegrationTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _posterClient = factory.CreateAuthenticatedClient();
        _webhookClient = factory.CreateUnauthenticatedClient();
    }

    // Unique suffix per test instance so concurrent/parallel tests don't collide on CognitoSub
    private readonly string _uniqueSuffix = Guid.NewGuid().ToString("N")[..8];

    public async Task InitializeAsync()
    {
        await _factory.SeedAsync(async db =>
        {
            // Poster is the authenticated user (maps to FakeAuthHandler.TestFirebaseUid).
            // Guard to avoid duplicate inserts when multiple test instances share the factory.
            if (!db.Users.Any(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid))
            {
                var poster = TestBuilders.MakeUserWithMangopay(
                    FakeAuthHandler.TestFirebaseUid,
                    FakeAuthHandler.TestEmail,
                    "mango_poster_001",
                    "wallet_poster_001");
                db.Users.Add(poster);
                await db.SaveChangesAsync();
                _posterId = poster.Id;
            }
            else
            {
                _posterId = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid).Id;
            }

            // Tradesperson is a separate user — use unique CognitoSub per test instance
            // so parallel xUnit test runs don't collide on the UNIQUE constraint.
            var tradespersonSub = $"uid-tradesperson-{_uniqueSuffix}";
            var tradesperson = TestBuilders.MakeUserWithMangopay(
                tradespersonSub,
                $"tradesperson-{_uniqueSuffix}@test.com",
                "mango_trade_001",
                "wallet_trade_001");
            db.Users.Add(tradesperson);
            await db.SaveChangesAsync();
            _tradespersonId = tradesperson.Id;

            // Job in "accepted" state with an accepted application
            var job = TestBuilders.MakeJob(
                _posterId,
                status: "accepted",
                id: Guid.NewGuid());
            db.Jobs.Add(job);
            await db.SaveChangesAsync();
            _jobId = job.Id;

            var application = new JobApplication
            {
                Id = Guid.NewGuid(),
                JobId = _jobId,
                ApplicantId = _tradespersonId,
                Status = "accepted",
                AppliedAt = DateTimeOffset.UtcNow,
                AcceptedAt = DateTimeOffset.UtcNow,
            };
            db.JobApplications.Add(application);
            await db.SaveChangesAsync();
        });
    }

    public Task DisposeAsync() => Task.CompletedTask;

    // ──────────────────────────────────────────────────────────────────────────
    // Test 1: StartJob returns redirect URL and sets payin_pending
    // ──────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task StartJob_Returns_PayInRedirectUrl_And_Sets_PayinPending()
    {
        var response = await _posterClient.PutAsync($"/api/jobs/{_jobId}/start", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<JobStartResponse>();
        result.Should().NotBeNull();
        result!.PayInRedirectUrl.Should().NotBeNullOrEmpty();
        result.Job.Status.Should().Be("in_progress");

        // Verify DB state
        await _factory.SeedAsync(async db =>
        {
            var job = await db.Jobs.FindAsync(_jobId);
            job.Should().NotBeNull();
            job!.PaymentStatus.Should().Be("payin_pending");
            job.EscrowPayInId.Should().NotBeNullOrEmpty();
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 2: Webhook PayInSucceeded sets escrowed
    // ──────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Webhook_PayInSucceeded_Sets_Escrowed()
    {
        // Seed a job in payin_pending state
        var jobId = Guid.NewGuid();
        const string payInId = "stub_payin_webhook_001";
        await _factory.SeedAsync(async db =>
        {
            var poster = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
            var job = TestBuilders.MakeJob(
                poster.Id,
                status: "in_progress",
                id: jobId,
                paymentStatus: "payin_pending",
                escrowPayInId: payInId);
            db.Jobs.Add(job);
            await db.SaveChangesAsync();
        });

        var response = await _webhookClient.PostAsync(
            $"/api/webhooks/mangopay?EventType=PAYIN_NORMAL_SUCCEEDED&RessourceId={payInId}",
            null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        await _factory.SeedAsync(async db =>
        {
            var job = await db.Jobs.FindAsync(jobId);
            job.Should().NotBeNull();
            job!.PaymentStatus.Should().Be("escrowed");
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 3: Webhook PayInFailed resets job to accepted
    // ──────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Webhook_PayInFailed_Resets_Job_To_Accepted()
    {
        var jobId = Guid.NewGuid();
        const string payInId = "stub_payin_fail_001";
        await _factory.SeedAsync(async db =>
        {
            var poster = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
            var job = TestBuilders.MakeJob(
                poster.Id,
                status: "in_progress",
                id: jobId,
                paymentStatus: "payin_pending",
                escrowPayInId: payInId);
            db.Jobs.Add(job);
            await db.SaveChangesAsync();
        });

        var response = await _webhookClient.PostAsync(
            $"/api/webhooks/mangopay?EventType=PAYIN_NORMAL_FAILED&RessourceId={payInId}",
            null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        await _factory.SeedAsync(async db =>
        {
            var job = await db.Jobs.FindAsync(jobId);
            job.Should().NotBeNull();
            job!.Status.Should().Be("accepted");
            job.PaymentStatus.Should().Be("none");
            job.EscrowPayInId.Should().BeNull();
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 4: CompleteJob sets completed+escrowed and does NOT schedule Hangfire
    // ──────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task CompleteJob_Sets_Completed_Escrowed_And_Does_Not_Schedule_Hangfire()
    {
        // Seed a self-contained job + application so we control the entire flow
        var jobId = Guid.NewGuid();
        var tradespersonId = _tradespersonId; // capture before entering lambda
        await _factory.SeedAsync(async db =>
        {
            var poster = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);

            var job = TestBuilders.MakeJob(
                poster.Id,
                status: "in_progress",
                id: jobId,
                paymentStatus: "escrowed",
                escrowPayInId: "stub_payin_complete_001");
            db.Jobs.Add(job);
            await db.SaveChangesAsync();

            db.JobApplications.Add(new JobApplication
            {
                Id = Guid.NewGuid(),
                JobId = jobId,
                ApplicantId = tradespersonId,
                Status = "accepted",
                AppliedAt = DateTimeOffset.UtcNow,
                AcceptedAt = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync();
        });

        var response = await _posterClient.PutAsync($"/api/jobs/{jobId}/complete", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        await _factory.SeedAsync(async db =>
        {
            var job = await db.Jobs.FindAsync(jobId);
            job.Should().NotBeNull();
            job!.Status.Should().Be("completed");
            job.PaymentStatus.Should().Be("escrowed");
            job.HangfireJobId.Should().BeNull();
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 5: SubmitReview on completed+escrowed job schedules payout
    // ──────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task SubmitReview_On_CompletedEscrowedJob_Schedules_Payout()
    {
        var jobId = Guid.NewGuid();
        var tradespersonId = _tradespersonId;
        await _factory.SeedAsync(async db =>
        {
            var poster = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);

            var job = TestBuilders.MakeJob(
                poster.Id,
                status: "completed",
                id: jobId,
                paymentStatus: "escrowed",
                escrowPayInId: "stub_payin_review_001");
            db.Jobs.Add(job);
            await db.SaveChangesAsync();

            db.JobApplications.Add(new JobApplication
            {
                Id = Guid.NewGuid(),
                JobId = jobId,
                ApplicantId = tradespersonId,
                Status = "accepted",
                AppliedAt = DateTimeOffset.UtcNow,
                AcceptedAt = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync();
        });

        // The authenticated user (poster) submits a review for the tradesperson
        var reviewRequest = new
        {
            JobId = jobId,
            Rating = 5,
            Text = "Great work, highly recommend!"
        };

        var response = await _posterClient.PostAsJsonAsync(
            $"/api/users/{_tradespersonId}/reviews",
            reviewRequest);

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        await _factory.SeedAsync(async db =>
        {
            var job = await db.Jobs.FindAsync(jobId);
            job.Should().NotBeNull();
            job!.PaymentStatus.Should().Be("payout_pending");
            // HangfireJobId is set to "fake-hangfire-job-id" by the mock IBackgroundJobClient
            job.HangfireJobId.Should().NotBeNull();
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 6: PayoutReleaseJob transfers funds and sets paid
    // ──────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task PayoutReleaseJob_Transfers_Funds_And_Sets_Paid()
    {
        var jobId = Guid.NewGuid();
        var tradespersonId = _tradespersonId;
        await _factory.SeedAsync(async db =>
        {
            var poster = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);

            var job = TestBuilders.MakeJob(
                poster.Id,
                status: "completed",
                id: jobId,
                paymentStatus: "payout_pending",
                escrowPayInId: "stub_payin_payout_001");
            job.HangfireJobId = "fake-hangfire-job-id";
            db.Jobs.Add(job);
            await db.SaveChangesAsync();

            db.JobApplications.Add(new JobApplication
            {
                Id = Guid.NewGuid(),
                JobId = jobId,
                ApplicantId = tradespersonId,
                Status = "accepted",
                AppliedAt = DateTimeOffset.UtcNow,
                AcceptedAt = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync();
        });

        // Resolve and execute the PayoutReleaseJob directly from DI
        using var scope = _factory.Services.CreateScope();
        var payoutJob = scope.ServiceProvider.GetRequiredService<IPayoutReleaseJob>();
        await payoutJob.ExecuteAsync(jobId);

        await _factory.SeedAsync(async db =>
        {
            var job = await db.Jobs.FindAsync(jobId);
            job.Should().NotBeNull();
            job!.PaymentStatus.Should().Be("paid");
            job.EscrowTransferId.Should().NotBeNullOrEmpty();
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 7: Webhook TransferSucceeded returns 200
    // ──────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Webhook_TransferSucceeded_Returns200()
    {
        var response = await _webhookClient.PostAsync(
            "/api/webhooks/mangopay?EventType=TRANSFER_NORMAL_SUCCEEDED&RessourceId=stub_transfer_001",
            null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 8: Webhook PayoutSucceeded returns 200
    // ──────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Webhook_PayoutSucceeded_Returns200()
    {
        var response = await _webhookClient.PostAsync(
            "/api/webhooks/mangopay?EventType=PAYOUT_NORMAL_SUCCEEDED&RessourceId=stub_payout_001",
            null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 9: Webhook KYC_SUCCEEDED sets MangopayKycStatus to "verified"
    // ──────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Webhook_KycSucceeded_Sets_KycVerified()
    {
        string kycDocId = $"stub_kyc_doc_001_{_uniqueSuffix}";
        await _factory.SeedAsync(async db =>
        {
            var user = db.Users.Find(_posterId);
            user!.MangopayKycStatus = "pending";
            user.MangopayKycDocumentId = kycDocId;
            await db.SaveChangesAsync();
        });

        var response = await _webhookClient.PostAsync(
            $"/api/webhooks/mangopay?EventType=KYC_SUCCEEDED&RessourceId={kycDocId}", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        await _factory.SeedAsync(async db =>
        {
            var user = db.Users.Find(_posterId);
            user!.MangopayKycStatus.Should().Be("verified");
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 10: Webhook KYC_FAILED sets MangopayKycStatus to "failed"
    // ──────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Webhook_KycFailed_Sets_KycFailed()
    {
        string kycDocId = $"stub_kyc_doc_002_{_uniqueSuffix}";
        await _factory.SeedAsync(async db =>
        {
            var user = db.Users.Find(_posterId);
            user!.MangopayKycStatus = "pending";
            user.MangopayKycDocumentId = kycDocId;
            await db.SaveChangesAsync();
        });

        var response = await _webhookClient.PostAsync(
            $"/api/webhooks/mangopay?EventType=KYC_FAILED&RessourceId={kycDocId}", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        await _factory.SeedAsync(async db =>
        {
            var user = db.Users.Find(_posterId);
            user!.MangopayKycStatus.Should().Be("failed");
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 11: PayoutReleaseJob with AutoWithdraw=true completes and sets paid
    // ──────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task PayoutReleaseJob_WithAutoWithdrawEnabled_CompletesSuccessfully()
    {
        var jobId = Guid.NewGuid();
        var tradespersonId = _tradespersonId;
        await _factory.SeedAsync(async db =>
        {
            var tp = db.Users.Find(tradespersonId);
            tp!.MangopayKycStatus = "verified";
            tp.MangopayBankAccountId = "stub_bank_001";
            tp.AutoWithdraw = true;
            await db.SaveChangesAsync();

            var poster = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
            var job = TestBuilders.MakeJob(
                poster.Id,
                status: "completed",
                id: jobId,
                paymentStatus: "payout_pending",
                escrowPayInId: "stub_payin_autowithdraw_001");
            job.HangfireJobId = "fake-hangfire-job-id";
            db.Jobs.Add(job);
            await db.SaveChangesAsync();

            db.JobApplications.Add(new JobApplication
            {
                Id = Guid.NewGuid(),
                JobId = jobId,
                ApplicantId = tradespersonId,
                Status = "accepted",
                AppliedAt = DateTimeOffset.UtcNow,
                AcceptedAt = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync();
        });

        using var scope = _factory.Services.CreateScope();
        var payoutJob = scope.ServiceProvider.GetRequiredService<IPayoutReleaseJob>();

        // Should complete without exception
        await payoutJob.ExecuteAsync(jobId);

        await _factory.SeedAsync(async db =>
        {
            var job = await db.Jobs.FindAsync(jobId);
            job!.PaymentStatus.Should().Be("paid");
        });
    }
}
