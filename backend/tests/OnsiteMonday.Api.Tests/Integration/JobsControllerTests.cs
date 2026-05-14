using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using OnsiteMonday.Api.DTOs.Jobs;
using OnsiteMonday.Api.Tests.Infrastructure;

namespace OnsiteMonday.Api.Tests.Integration;

public class JobsControllerTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public JobsControllerTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateAuthenticatedClient();
    }

    public async Task InitializeAsync()
    {
        // Seed the test user and ensure KYC is verified (reset between tests)
        await _factory.SeedAsync(async db =>
        {
            var existing = db.Users.FirstOrDefault(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
            if (existing == null)
            {
                db.Users.Add(TestBuilders.MakeUser());
            }
            else
            {
                existing.MangopayKycStatus = "verified";
            }
            await db.SaveChangesAsync();
        });
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private static CreateJobRequest MakeValidJobRequest() => new()
    {
        Title = "Bricklayer needed",
        Trade = "Bricklayer",
        Location = "London",
        Postcode = "EC1A 1BB",
        Duration = 3,
        Days = new List<string> { "Monday", "Tuesday" },
        StartDate = new DateOnly(2026, 6, 1),
        EndDate = new DateOnly(2026, 6, 3),
        StartTime = "08:00",
        EndTime = "17:00",
        DayRate = 300,
        PaymentTerms = "30 days",
    };

    [Fact]
    public async Task CreateJob_WhenKycNotVerified_Returns403()
    {
        await _factory.SeedAsync(async db =>
        {
            var user = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
            user.MangopayKycStatus = "pending"; // submitted but not verified
            await db.SaveChangesAsync();
        });

        var response = await _client.PostAsJsonAsync("/api/jobs", MakeValidJobRequest());

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task CreateJob_WhenKycVerified_Returns201()
    {
        await _factory.SeedAsync(async db =>
        {
            var user = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
            user.MangopayKycStatus = "verified";
            await db.SaveChangesAsync();
        });

        var response = await _client.PostAsJsonAsync("/api/jobs", MakeValidJobRequest());

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task ToggleInterest_WhenKycNotVerified_Returns403()
    {
        Guid otherJobId = Guid.Empty;
        await _factory.SeedAsync(async db =>
        {
            // Set calling user KYC to pending (not verified)
            var caller = db.Users.First(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid);
            caller.MangopayKycStatus = "pending";

            var poster = TestBuilders.MakeUser("uid-poster-kyc-check", "poster-kyc-check@test.com");
            db.Users.Add(poster);
            await db.SaveChangesAsync();

            var job = TestBuilders.MakeJob(poster.Id);
            db.Jobs.Add(job);
            await db.SaveChangesAsync();
            otherJobId = job.Id;
        });

        var response = await _client.PostAsync($"/api/jobs/{otherJobId}/interest", null);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetJobs_Returns200WithJsonArray()
    {
        var response = await _client.GetAsync("/api/jobs");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var jobs = await response.Content.ReadFromJsonAsync<List<JobDto>>();
        jobs.Should().NotBeNull();
    }

    [Fact]
    public async Task GetMyPostedJobs_Returns200WithList()
    {
        // Create a job first so there's something to return
        await _client.PostAsJsonAsync("/api/jobs", MakeValidJobRequest());

        var response = await _client.GetAsync("/api/jobs/my/posted");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var jobs = await response.Content.ReadFromJsonAsync<List<JobDto>>();
        jobs.Should().NotBeNull();
    }

    [Fact]
    public async Task CreateJob_WithValidRequest_Returns201WithLocationHeader()
    {
        var response = await _client.PostAsJsonAsync("/api/jobs", MakeValidJobRequest());

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        response.Headers.Location.Should().NotBeNull();
        var job = await response.Content.ReadFromJsonAsync<JobDto>();
        job.Should().NotBeNull();
        job!.Status.Should().Be("open");
    }

    [Fact]
    public async Task CreateJob_WithInvalidDayRate_Returns400()
    {
        var request = MakeValidJobRequest();
        request.DayRate = 0; // fails validation

        var response = await _client.PostAsJsonAsync("/api/jobs", request);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetById_WhenJobExists_Returns200()
    {
        // Create a job first
        var createResponse = await _client.PostAsJsonAsync("/api/jobs", MakeValidJobRequest());
        var created = await createResponse.Content.ReadFromJsonAsync<JobDto>();

        var response = await _client.GetAsync($"/api/jobs/{created!.Id}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetById_WhenJobNotFound_Returns404()
    {
        var response = await _client.GetAsync($"/api/jobs/{Guid.NewGuid()}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ToggleInterest_Returns200()
    {
        // Must be a different user's job — you cannot apply to your own
        Guid otherJobId = Guid.Empty;
        await _factory.SeedAsync(async db =>
        {
            var poster = TestBuilders.MakeUser("uid-poster-toggle", "poster-toggle@test.com");
            db.Users.Add(poster);
            await db.SaveChangesAsync();

            var job = TestBuilders.MakeJob(poster.Id);
            db.Jobs.Add(job);
            await db.SaveChangesAsync();
            otherJobId = job.Id;
        });

        var response = await _client.PostAsync($"/api/jobs/{otherJobId}/interest", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task CompleteJob_WhenNotPoster_Returns403()
    {
        // Seed a job posted by a different user
        Guid otherJobId = Guid.Empty;
        await _factory.SeedAsync(async db =>
        {
            var otherUser = TestBuilders.MakeUser("uid-other", "other@test.com");
            db.Users.Add(otherUser);
            await db.SaveChangesAsync();

            var job = TestBuilders.MakeJob(otherUser.Id, "accepted");
            db.Jobs.Add(job);
            await db.SaveChangesAsync();
            otherJobId = job.Id;
        });

        var response = await _client.PutAsync($"/api/jobs/{otherJobId}/complete", null);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
