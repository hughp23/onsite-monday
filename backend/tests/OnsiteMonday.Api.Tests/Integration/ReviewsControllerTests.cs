using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.DTOs.Reviews;
using OnsiteMonday.Api.Tests.Infrastructure;

namespace OnsiteMonday.Api.Tests.Integration;

public class ReviewsControllerTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private readonly HttpClient _client;
    private Guid _revieweeId;
    private Guid _jobId;

    public ReviewsControllerTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateAuthenticatedClient();
    }

    public async Task InitializeAsync()
    {
        await _factory.SeedAsync(async db =>
        {
            // Seed the current (reviewer) user if not already present
            if (!db.Users.Any(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid))
            {
                db.Users.Add(TestBuilders.MakeUser());
                await db.SaveChangesAsync();
            }

            // Seed the reviewee user if not already present (unique per test class lifetime)
            var reviewee = db.Users.FirstOrDefault(u => u.CognitoSub == "uid-reviewee");
            if (reviewee == null)
            {
                reviewee = TestBuilders.MakeUser("uid-reviewee", "reviewee@test.com");
                db.Users.Add(reviewee);
                await db.SaveChangesAsync();
            }
            _revieweeId = reviewee.Id;

            // Each test gets a fresh job so reviews don't collide across tests
            var poster = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
            var job = TestBuilders.MakeJob(poster.Id, "completed");
            db.Jobs.Add(job);
            db.JobApplications.Add(new JobApplication
            {
                Id = Guid.NewGuid(), JobId = job.Id, ApplicantId = reviewee.Id,
                Status = "accepted", AppliedAt = DateTimeOffset.UtcNow, AcceptedAt = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync();
            _jobId = job.Id;
        });
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task SubmitReview_WithValidRequest_Returns201ForAcceptedApplicant()
    {
        var request = new SubmitReviewRequest { Rating = 5, Text = "Excellent work." };

        var response = await _client.PostAsJsonAsync($"/api/jobs/{_jobId}/review", request);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = await response.Content.ReadFromJsonAsync<ReviewDto>();
        dto!.Rating.Should().Be(5);
        dto.RevieweeId.Should().Be(_revieweeId);
        dto.JobId.Should().Be(_jobId);
    }

    [Fact]
    public async Task SubmitReview_OnEscrowedJob_SchedulesPayoutOnTradespersonsActiveTier()
    {
        var jobId = Guid.NewGuid();
        await _factory.SeedAsync(async db =>
        {
            var poster = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
            var hired = TestBuilders.MakeUser($"uid-gold-{jobId}", $"gold-{jobId}@test.com");
            db.Users.Add(hired);
            db.Subscriptions.Add(new Subscription
            {
                Id = Guid.NewGuid(), UserId = hired.Id, Tier = "silver", PayoutDays = 14,
                IsActive = false, StartedAt = DateTimeOffset.UtcNow.AddMonths(-2),
            });
            db.Subscriptions.Add(new Subscription
            {
                Id = Guid.NewGuid(), UserId = hired.Id, Tier = "gold", PayoutDays = 7,
                IsActive = true, StartedAt = DateTimeOffset.UtcNow,
            });
            db.Jobs.Add(TestBuilders.MakeJob(poster.Id, "completed", id: jobId, paymentStatus: "escrowed"));
            db.JobApplications.Add(new JobApplication
            {
                Id = Guid.NewGuid(), JobId = jobId, ApplicantId = hired.Id,
                Status = "accepted", AppliedAt = DateTimeOffset.UtcNow, AcceptedAt = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync();
        });

        var response = await _client.PostAsJsonAsync($"/api/jobs/{jobId}/review", new SubmitReviewRequest { Rating = 5 });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = await response.Content.ReadFromJsonAsync<ReviewDto>();
        dto!.PayoutScheduledAt.Should().BeCloseTo(DateTimeOffset.UtcNow.AddDays(7), TimeSpan.FromMinutes(1));
    }

    [Fact]
    public async Task SubmitReview_ForSomeoneElsesJob_Returns403()
    {
        var otherJobId = Guid.NewGuid();
        await _factory.SeedAsync(async db =>
        {
            var otherPoster = TestBuilders.MakeUser($"uid-other-poster-{otherJobId}", $"{otherJobId}@test.com");
            db.Users.Add(otherPoster);
            db.Jobs.Add(TestBuilders.MakeJob(otherPoster.Id, "completed", id: otherJobId));
            db.JobApplications.Add(new JobApplication
            {
                Id = Guid.NewGuid(), JobId = otherJobId, ApplicantId = _revieweeId,
                Status = "accepted", AppliedAt = DateTimeOffset.UtcNow, AcceptedAt = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync();
        });

        var request = new SubmitReviewRequest { Rating = 1 };
        var response = await _client.PostAsJsonAsync($"/api/jobs/{otherJobId}/review", request);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task SubmitReview_WithInvalidRating_Returns400()
    {
        var request = new SubmitReviewRequest { Rating = 0 };

        var response = await _client.PostAsJsonAsync($"/api/jobs/{_jobId}/review", request);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task SubmitReview_DuplicateJob_Returns400()
    {
        var jobId = Guid.NewGuid();
        // Seed a pre-existing review for this job
        await _factory.SeedAsync(async db =>
        {
            var reviewer = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
            var job = TestBuilders.MakeJob(reviewer.Id, "completed", id: jobId);
            db.Jobs.Add(job);
            db.JobApplications.Add(new JobApplication
            {
                Id = Guid.NewGuid(), JobId = jobId, ApplicantId = _revieweeId,
                Status = "accepted", AppliedAt = DateTimeOffset.UtcNow, AcceptedAt = DateTimeOffset.UtcNow,
            });
            var existingReview = TestBuilders.MakeReview(_revieweeId, reviewer.Id, jobId);
            db.Reviews.Add(existingReview);
            await db.SaveChangesAsync();
        });

        var request = new SubmitReviewRequest { Rating = 4 };
        var response = await _client.PostAsJsonAsync($"/api/jobs/{jobId}/review", request);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetReviews_Returns200WithArray()
    {
        var response = await _client.GetAsync($"/api/users/{_revieweeId}/reviews");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var reviews = await response.Content.ReadFromJsonAsync<List<ReviewDto>>();
        reviews.Should().NotBeNull();
    }
}
