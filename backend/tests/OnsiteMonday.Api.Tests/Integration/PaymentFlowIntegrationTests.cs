using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.DTOs.Jobs;
using OnsiteMonday.Api.Jobs;
using OnsiteMonday.Api.Tests.Infrastructure;

namespace OnsiteMonday.Api.Tests.Integration;

public class PaymentFlowIntegrationTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private readonly HttpClient _posterClient;

    private Guid _posterId;
    private Guid _tradespersonId;
    private Guid _jobId;

    public PaymentFlowIntegrationTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _posterClient = factory.CreateAuthenticatedClient();
    }

    // Unique suffix per test instance so concurrent/parallel tests don't collide on CognitoSub
    private readonly string _uniqueSuffix = Guid.NewGuid().ToString("N")[..8];

    public async Task InitializeAsync()
    {
        await _factory.SeedAsync(async db =>
        {
            // Poster is the authenticated user (maps to FakeAuthHandler.TestFirebaseUid).
            if (!db.Users.Any(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid))
            {
                var poster = TestBuilders.MakeUserWithStripeConnect(
                    FakeAuthHandler.TestFirebaseUid,
                    FakeAuthHandler.TestEmail);
                db.Users.Add(poster);
                await db.SaveChangesAsync();
                _posterId = poster.Id;
            }
            else
            {
                _posterId = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid).Id;
            }

            // Tradesperson is a separate user — use unique CognitoSub per test instance
            var tradespersonSub = $"uid-tradesperson-{_uniqueSuffix}";
            var tradesperson = TestBuilders.MakeUserWithStripeConnect(
                tradespersonSub,
                $"tradesperson-{_uniqueSuffix}@test.com");
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
    // Test 1: StartJob returns Stripe checkout URL and sets payin_pending
    // ──────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task StartJob_Returns_CheckoutUrl_And_Sets_PayinPending()
    {
        var response = await _posterClient.PutAsync($"/api/jobs/{_jobId}/start", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<JobStartResponse>();
        result.Should().NotBeNull();
        result!.CheckoutUrl.Should().NotBeNullOrEmpty();
        result.Job.Status.Should().Be("in_progress");

        // Verify DB state
        await _factory.SeedAsync(async db =>
        {
            var job = await db.Jobs.FindAsync(_jobId);
            job.Should().NotBeNull();
            job!.PaymentStatus.Should().Be("payin_pending");
            job.StripeCheckoutSessionId.Should().NotBeNullOrEmpty();
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 2: CompleteJob sets completed and does NOT schedule Hangfire
    // ──────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task CompleteJob_Sets_Completed_And_Does_Not_Schedule_Hangfire()
    {
        var jobId = Guid.NewGuid();
        var tradespersonId = _tradespersonId;
        await _factory.SeedAsync(async db =>
        {
            var poster = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);

            var job = TestBuilders.MakeJob(
                poster.Id,
                status: "in_progress",
                id: jobId,
                paymentStatus: "payin_pending");
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
            job.HangfireJobId.Should().BeNull();
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 3: SubmitReview on completed+escrowed job schedules payout
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
                paymentStatus: "escrowed");
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
    // Test 4: PayoutReleaseJob transfers funds via Stripe and sets payout_complete
    // ──────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task PayoutReleaseJob_Transfers_Funds_And_Sets_PayoutComplete()
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
                paymentStatus: "payout_pending");
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
            job!.PaymentStatus.Should().Be("payout_complete");
            job.StripeTransferId.Should().NotBeNullOrEmpty();
        });
    }
}
