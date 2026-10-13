using FluentAssertions;
using Hangfire;
using HangfireJob = Hangfire.Common.Job;
using Moq;
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.DTOs.Reviews;
using OnsiteMonday.Api.Jobs;
using OnsiteMonday.Api.Repositories;
using OnsiteMonday.Api.Services;
using OnsiteMonday.Api.Tests.Infrastructure;

namespace OnsiteMonday.Api.Tests.Unit.Services;

public class ReviewServiceTests
{
    private readonly Mock<IReviewRepository> _reviewRepoMock = new();
    private readonly Mock<IUserRepository> _userRepoMock = new();
    private readonly Mock<INotificationRepository> _notificationRepoMock = new();
    private readonly Mock<IJobRepository> _jobRepoMock = new();
    private readonly Mock<IBackgroundJobClient> _backgroundJobsMock = new();
    private readonly ReviewService _sut;

    public ReviewServiceTests()
    {
        _backgroundJobsMock
            .Setup(b => b.Create(It.IsAny<HangfireJob>(), It.IsAny<Hangfire.States.IState>()))
            .Returns("stub_hangfire_id");
        _sut = new ReviewService(
            _reviewRepoMock.Object,
            _userRepoMock.Object,
            _notificationRepoMock.Object,
            _jobRepoMock.Object,
            _backgroundJobsMock.Object);
    }

    private static SubmitReviewRequest MakeRequest(int rating = 4) => new()
    {
        Rating = rating,
        Text = "Great tradesperson.",
    };

    private static (User Applicant, JobApplication Application) Application(
        Guid jobId, User applicant, string status) =>
        (applicant, new JobApplication
        {
            Id = Guid.NewGuid(), JobId = jobId, ApplicantId = applicant.Id,
            Status = status, AppliedAt = DateTimeOffset.UtcNow,
        });

    // Poster's completed job, with `hired` accepted and an unrelated applicant
    // rejected, so tests prove the reviewee comes from the accepted application.
    private Job SetupCompletedJob(User poster, User hired, string paymentStatus = "none")
    {
        var job = TestBuilders.MakeJob(poster.Id, status: "completed", paymentStatus: paymentStatus);
        var other = TestBuilders.MakeUser("uid-other", "other@test.com");

        _jobRepoMock.Setup(r => r.GetByIdRawAsync(job.Id)).ReturnsAsync(job);
        _jobRepoMock.Setup(r => r.GetApplicantsAsync(job.Id)).ReturnsAsync(new List<(User, JobApplication)>
        {
            Application(job.Id, other, "rejected"),
            Application(job.Id, hired, "accepted"),
        });
        _jobRepoMock.Setup(r => r.UpdateAsync(It.IsAny<Job>())).Returns(Task.CompletedTask);
        _userRepoMock.Setup(r => r.GetByIdAsync(hired.Id)).ReturnsAsync(hired);
        _userRepoMock.Setup(r => r.GetByIdAsync(poster.Id)).ReturnsAsync(poster);
        _reviewRepoMock.Setup(r => r.ExistsForJobAsync(job.Id)).ReturnsAsync(false);
        _reviewRepoMock.Setup(r => r.CreateAsync(It.IsAny<Review>())).ReturnsAsync((Review r) => r);
        _reviewRepoMock.Setup(r => r.GetAverageRatingAsync(hired.Id)).ReturnsAsync(4.5m);
        _reviewRepoMock.Setup(r => r.GetReviewCountAsync(hired.Id)).ReturnsAsync(1);
        _userRepoMock.Setup(r => r.UpdateAsync(It.IsAny<User>())).Returns(Task.CompletedTask);
        _notificationRepoMock.Setup(r => r.CreateAsync(It.IsAny<Notification>())).ReturnsAsync((Notification n) => n);
        return job;
    }

    [Fact]
    public async Task SubmitReview_HappyPath_ReviewsTheAcceptedApplicantAndNotifies()
    {
        var poster = TestBuilders.MakeUser("uid-poster", "poster@test.com");
        var hired = TestBuilders.MakeUser("uid-hired", "hired@test.com");
        var job = SetupCompletedJob(poster, hired);

        var result = await _sut.SubmitReviewAsync(poster.Id, job.Id, MakeRequest());

        result.RevieweeId.Should().Be(hired.Id);
        result.ReviewerId.Should().Be(poster.Id);
        result.JobId.Should().Be(job.Id);
        _reviewRepoMock.Verify(r => r.CreateAsync(It.Is<Review>(rv =>
            rv.RevieweeId == hired.Id && rv.JobId == job.Id)), Times.Once);
        _notificationRepoMock.Verify(r => r.CreateAsync(It.Is<Notification>(n =>
            n.UserId == hired.Id)), Times.Once);
    }

    [Fact]
    public async Task SubmitReview_RecalculatesRevieweeRatingAndCount()
    {
        var poster = TestBuilders.MakeUser("uid-poster", "poster@test.com");
        var hired = TestBuilders.MakeUser("uid-hired", "hired@test.com");
        var job = SetupCompletedJob(poster, hired);
        _reviewRepoMock.Setup(r => r.GetAverageRatingAsync(hired.Id)).ReturnsAsync(3.8m);
        _reviewRepoMock.Setup(r => r.GetReviewCountAsync(hired.Id)).ReturnsAsync(5);

        await _sut.SubmitReviewAsync(poster.Id, job.Id, MakeRequest());

        _userRepoMock.Verify(r => r.UpdateAsync(It.Is<User>(u =>
            u.Id == hired.Id &&
            u.Rating == 3.8m &&
            u.ReviewCount == 5)), Times.Once);
    }

    [Fact]
    public async Task SubmitReview_WhenDuplicateJob_ThrowsArgumentException()
    {
        var poster = TestBuilders.MakeUser("uid-poster", "poster@test.com");
        var hired = TestBuilders.MakeUser("uid-hired", "hired@test.com");
        var job = SetupCompletedJob(poster, hired);
        _reviewRepoMock.Setup(r => r.ExistsForJobAsync(job.Id)).ReturnsAsync(true);

        var act = () => _sut.SubmitReviewAsync(poster.Id, job.Id, MakeRequest());

        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*already exists*");
    }

    [Fact]
    public async Task SubmitReview_WhenJobNotFound_ThrowsKeyNotFoundException()
    {
        _jobRepoMock.Setup(r => r.GetByIdRawAsync(It.IsAny<Guid>())).ReturnsAsync((Job?)null);

        var act = () => _sut.SubmitReviewAsync(Guid.NewGuid(), Guid.NewGuid(), MakeRequest());

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task SubmitReview_WhenCallerIsNotThePoster_ThrowsAndCreatesNothing()
    {
        var poster = TestBuilders.MakeUser("uid-poster", "poster@test.com");
        var hired = TestBuilders.MakeUser("uid-hired", "hired@test.com");
        var job = SetupCompletedJob(poster, hired);

        var act = () => _sut.SubmitReviewAsync(Guid.NewGuid(), job.Id, MakeRequest());

        await act.Should().ThrowAsync<UnauthorizedAccessException>();
        _reviewRepoMock.Verify(r => r.CreateAsync(It.IsAny<Review>()), Times.Never);
    }

    [Fact]
    public async Task SubmitReview_WhenNoAcceptedApplicant_ThrowsAndCreatesNothing()
    {
        var poster = TestBuilders.MakeUser("uid-poster", "poster@test.com");
        var hired = TestBuilders.MakeUser("uid-hired", "hired@test.com");
        var job = SetupCompletedJob(poster, hired);
        _jobRepoMock.Setup(r => r.GetApplicantsAsync(job.Id)).ReturnsAsync(new List<(User, JobApplication)>
        {
            Application(job.Id, hired, "interested"),
        });

        var act = () => _sut.SubmitReviewAsync(poster.Id, job.Id, MakeRequest());

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*no accepted tradesperson*");
        _reviewRepoMock.Verify(r => r.CreateAsync(It.IsAny<Review>()), Times.Never);
    }

    [Fact]
    public async Task SubmitReview_WhenJobNotCompleted_ThrowsAndDoesNotScheduleHangfire()
    {
        var poster = TestBuilders.MakeUser("uid-poster", "poster@test.com");
        var hired = TestBuilders.MakeUser("uid-hired", "hired@test.com");
        var job = SetupCompletedJob(poster, hired, paymentStatus: "escrowed");
        job.Status = "in_progress";

        var act = () => _sut.SubmitReviewAsync(poster.Id, job.Id, MakeRequest());

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*completed jobs*");
        _reviewRepoMock.Verify(r => r.CreateAsync(It.IsAny<Review>()), Times.Never);
        _backgroundJobsMock.Verify(b => b.Create(It.IsAny<HangfireJob>(), It.IsAny<Hangfire.States.IState>()), Times.Never);
    }

    [Fact]
    public async Task SubmitReview_WhenCompletedAndEscrowed_SchedulesPayoutOnHiredTradespersonsTier()
    {
        var poster = TestBuilders.MakeUser("uid-poster", "poster@test.com");
        poster.Subscriptions = new List<Subscription>
        {
            new Subscription { Tier = "gold", IsActive = true, PayoutDays = 7, StartedAt = DateTimeOffset.UtcNow }
        };
        // The loaded User deliberately has no subscriptions: the delay must come
        // from the explicit active-subscription lookup, not the navigation property.
        var hired = TestBuilders.MakeUser("uid-hired", "hired@test.com");
        var job = SetupCompletedJob(poster, hired, paymentStatus: "escrowed");
        _userRepoMock.Setup(r => r.GetActivePayoutDaysAsync(hired.Id)).ReturnsAsync(14);
        _userRepoMock.Setup(r => r.GetActivePayoutDaysAsync(poster.Id)).ReturnsAsync(7);

        var result = await _sut.SubmitReviewAsync(poster.Id, job.Id, MakeRequest(5));

        _backgroundJobsMock.Verify(
            b => b.Create(It.IsAny<HangfireJob>(), It.IsAny<Hangfire.States.IState>()),
            Times.Once);
        job.PaymentStatus.Should().Be("payout_pending");
        job.HangfireJobId.Should().Be("stub_hangfire_id");
        job.PayoutScheduledAt.Should().BeCloseTo(DateTimeOffset.UtcNow.AddDays(14), TimeSpan.FromMinutes(1));
        result.PayoutScheduledAt.Should().Be(job.PayoutScheduledAt);
    }

    [Fact]
    public async Task SubmitReview_WhenTradespersonHasNoActiveSubscription_UsesBronzeDelay()
    {
        var poster = TestBuilders.MakeUser("uid-poster", "poster@test.com");
        var hired = TestBuilders.MakeUser("uid-hired", "hired@test.com");
        var job = SetupCompletedJob(poster, hired, paymentStatus: "escrowed");
        _userRepoMock.Setup(r => r.GetActivePayoutDaysAsync(hired.Id)).ReturnsAsync((int?)null);

        var result = await _sut.SubmitReviewAsync(poster.Id, job.Id, MakeRequest());

        result.PayoutScheduledAt.Should().BeCloseTo(DateTimeOffset.UtcNow.AddDays(30), TimeSpan.FromMinutes(1));
    }

    [Fact]
    public async Task SubmitReview_WhenCompletedButNotEscrowed_DoesNotScheduleHangfire()
    {
        var poster = TestBuilders.MakeUser("uid-poster", "poster@test.com");
        var hired = TestBuilders.MakeUser("uid-hired", "hired@test.com");
        var job = SetupCompletedJob(poster, hired, paymentStatus: "paid");

        var result = await _sut.SubmitReviewAsync(poster.Id, job.Id, MakeRequest(3));

        _backgroundJobsMock.Verify(
            b => b.Create(It.IsAny<HangfireJob>(), It.IsAny<Hangfire.States.IState>()),
            Times.Never);
        result.PayoutScheduledAt.Should().BeNull();
    }

    [Fact]
    public async Task GetReviews_ReturnsAllReviewsMapped()
    {
        var reviewee = TestBuilders.MakeUser();
        var reviewer = TestBuilders.MakeUser("uid2", "r2@test.com");
        var reviews = new List<Review>
        {
            new Review { Id = Guid.NewGuid(), RevieweeId = reviewee.Id, ReviewerId = reviewer.Id, JobId = Guid.NewGuid(), Rating = 5, Reviewer = reviewer },
            new Review { Id = Guid.NewGuid(), RevieweeId = reviewee.Id, ReviewerId = reviewer.Id, JobId = Guid.NewGuid(), Rating = 3, Reviewer = reviewer },
        };
        _reviewRepoMock.Setup(r => r.GetByRevieweeIdAsync(reviewee.Id)).ReturnsAsync(reviews);

        var result = await _sut.GetReviewsAsync(reviewee.Id);

        result.Should().HaveCount(2);
    }
}
