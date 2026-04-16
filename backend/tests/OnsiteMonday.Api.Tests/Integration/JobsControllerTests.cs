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
        _client = factory.CreateClient();
    }

    public async Task InitializeAsync()
    {
        // Seed the test user so GetOrCreateByFirebaseUidAsync resolves
        await _factory.SeedAsync(async db =>
        {
            if (!db.Users.Any(u => u.FirebaseUid == FakeAuthHandler.TestFirebaseUid))
            {
                db.Users.Add(TestBuilders.MakeUser());
                await db.SaveChangesAsync();
            }
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
        var createResponse = await _client.PostAsJsonAsync("/api/jobs", MakeValidJobRequest());
        var created = await createResponse.Content.ReadFromJsonAsync<JobDto>();

        var response = await _client.PostAsync($"/api/jobs/{created!.Id}/interest", null);

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
