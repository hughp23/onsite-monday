using AutoMapper;
using FluentAssertions;
using Hangfire;
using HangfireJob = Hangfire.Common.Job;
using Moq;
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.DTOs.Jobs;
using OnsiteMonday.Api.Jobs;
using OnsiteMonday.Api.Mapping;
using OnsiteMonday.Api.Repositories;
using OnsiteMonday.Api.Services;
using OnsiteMonday.Api.Stubs;
using OnsiteMonday.Api.Tests.Infrastructure;

namespace OnsiteMonday.Api.Tests.Unit.Services;

public class JobServiceTests
{
    private readonly Mock<IJobRepository> _jobRepoMock = new();
    private readonly Mock<IUserRepository> _userRepoMock = new();
    private readonly Mock<INotificationRepository> _notificationRepoMock = new();
    private readonly Mock<IMangopayService> _mangopayMock = new();
    private readonly Mock<IBackgroundJobClient> _backgroundJobsMock = new();
    private readonly IMapper _mapper;
    private readonly JobService _sut;

    public JobServiceTests()
    {
        var config = new MapperConfiguration(cfg => cfg.AddProfile<MappingProfile>());
        _mapper = config.CreateMapper();
        _notificationRepoMock.Setup(r => r.CreateAsync(It.IsAny<Notification>())).ReturnsAsync(new Notification());
        _mangopayMock.Setup(s => s.EnsureUserAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync("stub_mango_user");
        _mangopayMock.Setup(s => s.EnsureWalletAsync(It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync("stub_wallet");
        _mangopayMock.Setup(s => s.CreateWebPayInAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<decimal>(), It.IsAny<string>()))
            .ReturnsAsync(("stub_payin", "https://stub-checkout.mangopay.com/pay"));
        _backgroundJobsMock
            .Setup(b => b.Create(It.IsAny<HangfireJob>(), It.IsAny<Hangfire.States.IState>()))
            .Returns("stub_hangfire_job_id");
        _sut = new JobService(_jobRepoMock.Object, _userRepoMock.Object, _notificationRepoMock.Object, _mangopayMock.Object, _backgroundJobsMock.Object, _mapper);
    }

    [Fact]
    public async Task GetJobs_ReturnsMappedListWithCorrectIsInterested()
    {
        var userId = Guid.NewGuid();
        var job1 = TestBuilders.MakeJob(userId);
        var job2 = TestBuilders.MakeJob(userId);

        var jobs = new List<Job> { job1, job2 };
        var isInterested = new Dictionary<Guid, bool> { [job1.Id] = true, [job2.Id] = false };
        var counts = new Dictionary<Guid, int> { [job1.Id] = 3, [job2.Id] = 0 };

        _jobRepoMock
            .Setup(r => r.GetJobsAsync(userId, null, null, null, 1, 20))
            .ReturnsAsync((jobs, isInterested, counts));

        var result = await _sut.GetJobsAsync(userId, null, null, null, 1, 20);

        result.Should().HaveCount(2);
        result.First(j => j.Id == job1.Id).IsInterested.Should().BeTrue();
        result.First(j => j.Id == job2.Id).IsInterested.Should().BeFalse();
    }

    [Fact]
    public async Task CreateJob_AssignsPosterId_AndStatusOpen()
    {
        var poster = TestBuilders.MakeUser();
        _userRepoMock.Setup(r => r.GetByIdAsync(poster.Id)).ReturnsAsync(poster);
        _jobRepoMock.Setup(r => r.CreateAsync(It.IsAny<Job>())).ReturnsAsync((Job j) => j);

        var request = new CreateJobRequest
        {
            Title = "Bricklayer needed",
            Trade = "Bricklayer",
            Location = "London",
            Postcode = "EC1A 1BB",
            Duration = 3,
            Days = new List<string> { "Monday" },
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)),
            StartTime = "08:00",
            EndTime = "17:00",
            DayRate = 300,
            PaymentTerms = "30 days",
        };

        var result = await _sut.CreateJobAsync(poster.Id, request);

        result.PostedById.Should().Be(poster.Id);
        result.Status.Should().Be("open");
        _jobRepoMock.Verify(r => r.CreateAsync(It.Is<Job>(j => j.PostedById == poster.Id && j.Status == "open")), Times.Once);
    }

    [Fact]
    public async Task CreateJob_WhenPosterNotFound_ThrowsKeyNotFoundException()
    {
        _userRepoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>())).ReturnsAsync((User?)null);

        var act = () => _sut.CreateJobAsync(Guid.NewGuid(), new CreateJobRequest
        {
            Title = "X", Trade = "Y", Location = "Z", Postcode = "AA1",
            Duration = 1, Days = new List<string> { "Mon" },
            StartDate = DateOnly.FromDateTime(DateTime.Today),
            EndDate = DateOnly.FromDateTime(DateTime.Today),
            StartTime = "08:00", EndTime = "17:00", DayRate = 100, PaymentTerms = "30 days",
        });

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task ToggleInterest_WhenNoExistingApplication_AddsApplication()
    {
        var userId = Guid.NewGuid();
        var job = TestBuilders.MakeJob(Guid.NewGuid());
        job.Applications = new List<JobApplication>();

        _jobRepoMock.Setup(r => r.GetByIdAsync(job.Id, userId)).ReturnsAsync((job, false, 0));
        _jobRepoMock.Setup(r => r.GetApplicationAsync(job.Id, userId)).ReturnsAsync((JobApplication?)null);
        _jobRepoMock.Setup(r => r.AddApplicationAsync(It.IsAny<JobApplication>())).Returns(Task.CompletedTask);
        _jobRepoMock.Setup(r => r.GetApplicationCountAsync(job.Id)).ReturnsAsync(1);
        _userRepoMock.Setup(r => r.GetByIdAsync(userId)).ReturnsAsync(TestBuilders.MakeUser());

        var result = await _sut.ToggleInterestAsync(job.Id, userId);

        _jobRepoMock.Verify(r => r.AddApplicationAsync(It.IsAny<JobApplication>()), Times.Once);
        _jobRepoMock.Verify(r => r.RemoveApplicationAsync(It.IsAny<JobApplication>()), Times.Never);
        result.IsInterested.Should().BeTrue();
    }

    [Fact]
    public async Task ToggleInterest_WhenExistingApplication_RemovesApplication()
    {
        var userId = Guid.NewGuid();
        var job = TestBuilders.MakeJob(Guid.NewGuid());
        var existingApp = new JobApplication { Id = Guid.NewGuid(), JobId = job.Id, ApplicantId = userId, Status = "interested" };

        _jobRepoMock.Setup(r => r.GetByIdAsync(job.Id, userId)).ReturnsAsync((job, true, 1));
        _jobRepoMock.Setup(r => r.GetApplicationAsync(job.Id, userId)).ReturnsAsync(existingApp);
        _jobRepoMock.Setup(r => r.RemoveApplicationAsync(existingApp)).Returns(Task.CompletedTask);
        _jobRepoMock.Setup(r => r.GetApplicationCountAsync(job.Id)).ReturnsAsync(0);

        var result = await _sut.ToggleInterestAsync(job.Id, userId);

        _jobRepoMock.Verify(r => r.RemoveApplicationAsync(existingApp), Times.Once);
        _jobRepoMock.Verify(r => r.AddApplicationAsync(It.IsAny<JobApplication>()), Times.Never);
        result.IsInterested.Should().BeFalse();
    }

    [Fact]
    public async Task AcceptApplicant_WhenCallerIsNotPoster_ThrowsUnauthorized()
    {
        var posterId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        var applicantId = Guid.NewGuid();
        var job = TestBuilders.MakeJob(posterId);

        _jobRepoMock.Setup(r => r.GetByIdAsync(job.Id, callerId)).ReturnsAsync((job, false, 0));

        var act = () => _sut.AcceptApplicantAsync(job.Id, callerId, applicantId);

        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task AcceptApplicant_WhenApplicationNotFound_ThrowsKeyNotFoundException()
    {
        var posterId = Guid.NewGuid();
        var applicantId = Guid.NewGuid();
        var job = TestBuilders.MakeJob(posterId);

        _jobRepoMock.Setup(r => r.GetByIdAsync(job.Id, posterId)).ReturnsAsync((job, false, 0));
        _jobRepoMock.Setup(r => r.GetApplicationAsync(job.Id, applicantId)).ReturnsAsync((JobApplication?)null);

        var act = () => _sut.AcceptApplicantAsync(job.Id, posterId, applicantId);

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task AcceptApplicant_SetsApplicationAndJobStatusToAccepted()
    {
        var posterId = Guid.NewGuid();
        var applicantId = Guid.NewGuid();
        var job = TestBuilders.MakeJob(posterId, "open");
        var application = new JobApplication { Id = Guid.NewGuid(), JobId = job.Id, ApplicantId = applicantId, Status = "interested" };

        _jobRepoMock.Setup(r => r.GetByIdAsync(job.Id, posterId)).ReturnsAsync((job, false, 1));
        _jobRepoMock.Setup(r => r.GetApplicationAsync(job.Id, applicantId)).ReturnsAsync(application);
        _jobRepoMock.Setup(r => r.UpdateAsync(It.IsAny<Job>())).Returns(Task.CompletedTask);
        _jobRepoMock.Setup(r => r.GetApplicationCountAsync(job.Id)).ReturnsAsync(1);

        var result = await _sut.AcceptApplicantAsync(job.Id, posterId, applicantId);

        application.Status.Should().Be("accepted");
        job.Status.Should().Be("accepted");
        result.Status.Should().Be("accepted");
    }

    [Fact]
    public async Task StartJob_CreatesWebPayInAndReturnsRedirectUrl()
    {
        var posterId = Guid.NewGuid();
        var poster = TestBuilders.MakeUser();
        poster.Id = posterId;
        var job = TestBuilders.MakeJob(posterId, "accepted");

        _jobRepoMock.Setup(r => r.GetByIdAsync(job.Id, posterId)).ReturnsAsync((job, false, 1));
        _jobRepoMock.Setup(r => r.UpdateAsync(It.IsAny<Job>())).Returns(Task.CompletedTask);
        _jobRepoMock.Setup(r => r.GetApplicationCountAsync(job.Id)).ReturnsAsync(1);
        _jobRepoMock.Setup(r => r.GetApplicantsAsync(job.Id)).ReturnsAsync(new List<(Domain.User, JobApplication)>());
        _userRepoMock.Setup(r => r.GetByIdAsync(posterId)).ReturnsAsync(poster);
        _userRepoMock.Setup(r => r.UpdateAsync(It.IsAny<User>())).Returns(Task.CompletedTask);

        var result = await _sut.StartJobAsync(job.Id, posterId);

        result.PayInRedirectUrl.Should().NotBeNullOrEmpty();
        result.Job.Status.Should().Be("in_progress");
        _mangopayMock.Verify(s => s.CreateWebPayInAsync(job.Id, It.IsAny<string>(), It.IsAny<decimal>(), It.IsAny<string>()), Times.Once);
    }

    [Fact]
    public async Task CompleteJob_WhenStatusIsAccepted_SetsStatusCompleted()
    {
        var posterId = Guid.NewGuid();
        var job = TestBuilders.MakeJob(posterId, "accepted");

        _jobRepoMock.Setup(r => r.GetByIdAsync(job.Id, posterId)).ReturnsAsync((job, false, 1));
        _jobRepoMock.Setup(r => r.UpdateAsync(It.IsAny<Job>())).Returns(Task.CompletedTask);
        _jobRepoMock.Setup(r => r.GetApplicationCountAsync(job.Id)).ReturnsAsync(1);
        _jobRepoMock.Setup(r => r.GetApplicantsAsync(job.Id)).ReturnsAsync(new List<(Domain.User, JobApplication)>());

        var result = await _sut.CompleteJobAsync(job.Id, posterId);

        result.Status.Should().Be("completed");
    }

    [Fact]
    public async Task CompleteJob_WhenStatusIsInProgress_SetsStatusCompleted()
    {
        var posterId = Guid.NewGuid();
        var job = TestBuilders.MakeJob(posterId, "in_progress");

        _jobRepoMock.Setup(r => r.GetByIdAsync(job.Id, posterId)).ReturnsAsync((job, false, 1));
        _jobRepoMock.Setup(r => r.UpdateAsync(It.IsAny<Job>())).Returns(Task.CompletedTask);
        _jobRepoMock.Setup(r => r.GetApplicationCountAsync(job.Id)).ReturnsAsync(1);
        _jobRepoMock.Setup(r => r.GetApplicantsAsync(job.Id)).ReturnsAsync(new List<(Domain.User, JobApplication)>());

        var result = await _sut.CompleteJobAsync(job.Id, posterId);

        result.Status.Should().Be("completed");
    }

    [Fact]
    public async Task CompleteJob_WhenStatusIsOpen_ThrowsArgumentException()
    {
        var posterId = Guid.NewGuid();
        var job = TestBuilders.MakeJob(posterId, "open");

        _jobRepoMock.Setup(r => r.GetByIdAsync(job.Id, posterId)).ReturnsAsync((job, false, 0));

        var act = () => _sut.CompleteJobAsync(job.Id, posterId);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task CompleteJob_WhenCallerIsNotPoster_ThrowsUnauthorized()
    {
        var posterId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        var job = TestBuilders.MakeJob(posterId, "accepted");

        _jobRepoMock.Setup(r => r.GetByIdAsync(job.Id, callerId)).ReturnsAsync((job, false, 0));

        var act = () => _sut.CompleteJobAsync(job.Id, callerId);

        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task CompleteJob_UsesTradespersonSubscriptionTier_NotHardcoded30Days()
    {
        var posterId = Guid.NewGuid();
        var tradesperson = TestBuilders.MakeUser();
        tradesperson.Subscriptions.Add(new Subscription { Tier = "gold", PayoutDays = 7, IsActive = true });
        var application = new JobApplication { Id = Guid.NewGuid(), ApplicantId = tradesperson.Id, Status = "accepted" };
        var job = TestBuilders.MakeJob(posterId, "accepted");

        _jobRepoMock.Setup(r => r.GetByIdAsync(job.Id, posterId)).ReturnsAsync((job, false, 1));
        _jobRepoMock.Setup(r => r.UpdateAsync(It.IsAny<Job>())).Returns(Task.CompletedTask);
        _jobRepoMock.Setup(r => r.GetApplicationCountAsync(job.Id)).ReturnsAsync(1);
        _jobRepoMock.Setup(r => r.GetApplicantsAsync(job.Id))
            .ReturnsAsync(new List<(Domain.User, JobApplication)> { (tradesperson, application) });
        _userRepoMock.Setup(r => r.UpdateAsync(It.IsAny<User>())).Returns(Task.CompletedTask);

        var before = DateTimeOffset.UtcNow;
        await _sut.CompleteJobAsync(job.Id, posterId);
        var after = DateTimeOffset.UtcNow;

        // Verify Hangfire scheduled with approximately 7-day delay (gold tier)
        _backgroundJobsMock.Verify(b => b.Create(
            It.IsAny<HangfireJob>(),
            It.Is<Hangfire.States.IState>(s =>
                s is Hangfire.States.ScheduledState &&
                ((Hangfire.States.ScheduledState)s).EnqueueAt >= before.AddDays(7).DateTime &&
                ((Hangfire.States.ScheduledState)s).EnqueueAt <= after.AddDays(7).DateTime)),
            Times.Once);

        // Confirm job PaymentStatus
        job.PaymentStatus.Should().Be("payout_pending");
        job.PayoutScheduledAt.Should().NotBeNull();
        job.PayoutScheduledAt!.Value.Should().BeCloseTo(DateTimeOffset.UtcNow.AddDays(7), TimeSpan.FromSeconds(5));
    }
}
