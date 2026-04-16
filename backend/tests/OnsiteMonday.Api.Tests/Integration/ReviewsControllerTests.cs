using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
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
        _client = factory.CreateClient();
    }

    public async Task InitializeAsync()
    {
        await _factory.SeedAsync(async db =>
        {
            // Seed the current (reviewer) user if not already present
            if (!db.Users.Any(u => u.FirebaseUid == FakeAuthHandler.TestFirebaseUid))
            {
                db.Users.Add(TestBuilders.MakeUser());
                await db.SaveChangesAsync();
            }

            // Seed the reviewee user if not already present (unique per test class lifetime)
            var reviewee = db.Users.FirstOrDefault(u => u.FirebaseUid == "uid-reviewee");
            if (reviewee == null)
            {
                reviewee = TestBuilders.MakeUser("uid-reviewee", "reviewee@test.com");
                db.Users.Add(reviewee);
                await db.SaveChangesAsync();
            }
            _revieweeId = reviewee.Id;

            // Each test gets a fresh job so reviews don't collide across tests
            var poster = db.Users.First(u => u.FirebaseUid == FakeAuthHandler.TestFirebaseUid);
            var job = TestBuilders.MakeJob(poster.Id, "completed");
            db.Jobs.Add(job);
            await db.SaveChangesAsync();
            _jobId = job.Id;
        });
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task SubmitReview_WithValidRequest_Returns201()
    {
        var request = new SubmitReviewRequest { JobId = _jobId, Rating = 5, Text = "Excellent work." };

        var response = await _client.PostAsJsonAsync($"/api/users/{_revieweeId}/reviews", request);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = await response.Content.ReadFromJsonAsync<ReviewDto>();
        dto!.Rating.Should().Be(5);
    }

    [Fact]
    public async Task SubmitReview_WithInvalidRating_Returns400()
    {
        var request = new SubmitReviewRequest { JobId = Guid.NewGuid(), Rating = 0 };

        var response = await _client.PostAsJsonAsync($"/api/users/{_revieweeId}/reviews", request);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task SubmitReview_DuplicateJob_Returns400()
    {
        var jobId = Guid.NewGuid();
        // Seed a pre-existing review for this job
        await _factory.SeedAsync(async db =>
        {
            var reviewer = db.Users.First(u => u.FirebaseUid == FakeAuthHandler.TestFirebaseUid);
            var job = TestBuilders.MakeJob(reviewer.Id, "completed", id: jobId);
            db.Jobs.Add(job);
            var existingReview = TestBuilders.MakeReview(_revieweeId, reviewer.Id, jobId);
            db.Reviews.Add(existingReview);
            await db.SaveChangesAsync();
        });

        var request = new SubmitReviewRequest { JobId = jobId, Rating = 4 };
        var response = await _client.PostAsJsonAsync($"/api/users/{_revieweeId}/reviews", request);

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
