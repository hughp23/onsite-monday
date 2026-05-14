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
        JobId = Guid.NewGuid(),
        Rating = rating,
        Text = "Great tradesperson.",
    };

    [Fact]
    public async Task SubmitReview_HappyPath_CreatesReviewAndNotification()
    {
        var reviewer = TestBuilders.MakeUser("uid-reviewer", "reviewer@test.com");
        var reviewee = TestBuilders.MakeUser("uid-reviewee", "reviewee@test.com");
        var request = MakeRequest();

        _userRepoMock.Setup(r => r.GetByIdAsync(reviewee.Id)).ReturnsAsync(reviewee);
        _userRepoMock.Setup(r => r.GetByIdAsync(reviewer.Id)).ReturnsAsync(reviewer);
        _reviewRepoMock.Setup(r => r.ExistsForJobAsync(request.JobId)).ReturnsAsync(false);
        _reviewRepoMock.Setup(r => r.CreateAsync(It.IsAny<Review>())).ReturnsAsync((Review r) => r);
        _reviewRepoMock.Setup(r => r.GetAverageRatingAsync(reviewee.Id)).ReturnsAsync(4.5m);
        _reviewRepoMock.Setup(r => r.GetReviewCountAsync(reviewee.Id)).ReturnsAsync(1);
        _userRepoMock.Setup(r => r.UpdateAsync(It.IsAny<User>())).Returns(Task.CompletedTask);
        _notificationRepoMock.Setup(r => r.CreateAsync(It.IsAny<Notification>())).ReturnsAsync((Notification n) => n);

        var result = await _sut.SubmitReviewAsync(reviewer.Id, reviewee.Id, request);

        result.Should().NotBeNull();
        result.RevieweeId.Should().Be(reviewee.Id);
        result.ReviewerId.Should().Be(reviewer.Id);
        result.Rating.Should().Be(request.Rating);
        _reviewRepoMock.Verify(r => r.CreateAsync(It.IsAny<Review>()), Times.Once);
        _notificationRepoMock.Verify(r => r.CreateAsync(It.IsAny<Notification>()), Times.Once);
    }

    [Fact]
    public async Task SubmitReview_RecalculatesRevieweeRatingAndCount()
    {
        var reviewer = TestBuilders.MakeUser("uid-reviewer", "reviewer@test.com");
        var reviewee = TestBuilders.MakeUser("uid-reviewee", "reviewee@test.com");
        var request = MakeRequest();

        _userRepoMock.Setup(r => r.GetByIdAsync(reviewee.Id)).ReturnsAsync(reviewee);
        _userRepoMock.Setup(r => r.GetByIdAsync(reviewer.Id)).ReturnsAsync(reviewer);
        _reviewRepoMock.Setup(r => r.ExistsForJobAsync(request.JobId)).ReturnsAsync(false);
        _reviewRepoMock.Setup(r => r.CreateAsync(It.IsAny<Review>())).ReturnsAsync((Review r) => r);
        _reviewRepoMock.Setup(r => r.GetAverageRatingAsync(reviewee.Id)).ReturnsAsync(3.8m);
        _reviewRepoMock.Setup(r => r.GetReviewCountAsync(reviewee.Id)).ReturnsAsync(5);
        _userRepoMock.Setup(r => r.UpdateAsync(It.IsAny<User>())).Returns(Task.CompletedTask);
        _notificationRepoMock.Setup(r => r.CreateAsync(It.IsAny<Notification>())).ReturnsAsync((Notification n) => n);

        await _sut.SubmitReviewAsync(reviewer.Id, reviewee.Id, request);

        _userRepoMock.Verify(r => r.UpdateAsync(It.Is<User>(u =>
            u.Id == reviewee.Id &&
            u.Rating == 3.8m &&
            u.ReviewCount == 5)), Times.Once);
    }

    [Fact]
    public async Task SubmitReview_WhenDuplicateJob_ThrowsArgumentException()
    {
        var reviewer = TestBuilders.MakeUser("uid-reviewer", "reviewer@test.com");
        var reviewee = TestBuilders.MakeUser("uid-reviewee", "reviewee@test.com");
        var request = MakeRequest();

        _userRepoMock.Setup(r => r.GetByIdAsync(reviewee.Id)).ReturnsAsync(reviewee);
        _userRepoMock.Setup(r => r.GetByIdAsync(reviewer.Id)).ReturnsAsync(reviewer);
        _reviewRepoMock.Setup(r => r.ExistsForJobAsync(request.JobId)).ReturnsAsync(true);

        var act = () => _sut.SubmitReviewAsync(reviewer.Id, reviewee.Id, request);

        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*already exists*");
    }

    [Fact]
    public async Task SubmitReview_WhenRevieweeNotFound_ThrowsKeyNotFoundException()
    {
        _userRepoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>())).ReturnsAsync((User?)null);

        var act = () => _sut.SubmitReviewAsync(Guid.NewGuid(), Guid.NewGuid(), MakeRequest());

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task SubmitReview_WhenJobNotCompleted_DoesNotScheduleHangfire()
    {
        // Job is in_progress (not "completed") — payout must NOT be scheduled.
        var reviewer = TestBuilders.MakeUser("uid-reviewer", "reviewer@test.com");
        var reviewee = TestBuilders.MakeUser("uid-reviewee", "reviewee@test.com");
        var request = MakeRequest();

        var job = TestBuilders.MakeJob(reviewer.Id, status: "in_progress");
        job.Id = request.JobId;
        job.PaymentStatus = "escrowed";

        _userRepoMock.Setup(r => r.GetByIdAsync(reviewee.Id)).ReturnsAsync(reviewee);
        _userRepoMock.Setup(r => r.GetByIdAsync(reviewer.Id)).ReturnsAsync(reviewer);
        _reviewRepoMock.Setup(r => r.ExistsForJobAsync(request.JobId)).ReturnsAsync(false);
        _reviewRepoMock.Setup(r => r.CreateAsync(It.IsAny<Review>())).ReturnsAsync((Review r) => r);
        _reviewRepoMock.Setup(r => r.GetAverageRatingAsync(reviewee.Id)).ReturnsAsync(4m);
        _reviewRepoMock.Setup(r => r.GetReviewCountAsync(reviewee.Id)).ReturnsAsync(1);
        _userRepoMock.Setup(r => r.UpdateAsync(It.IsAny<User>())).Returns(Task.CompletedTask);
        _notificationRepoMock.Setup(r => r.CreateAsync(It.IsAny<Notification>())).ReturnsAsync((Notification n) => n);
        _jobRepoMock.Setup(r => r.GetByIdRawAsync(request.JobId)).ReturnsAsync(job);

        await _sut.SubmitReviewAsync(reviewer.Id, reviewee.Id, request);

        _backgroundJobsMock.Verify(b => b.Create(It.IsAny<HangfireJob>(), It.IsAny<Hangfire.States.IState>()), Times.Never);
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

public class ReviewServicePayoutTests
{
    private readonly Mock<IReviewRepository> _reviewRepoMock = new();
    private readonly Mock<IUserRepository> _userRepoMock = new();
    private readonly Mock<INotificationRepository> _notificationRepoMock = new();
    private readonly Mock<IJobRepository> _jobRepoMock = new();
    private readonly Mock<IBackgroundJobClient> _backgroundJobsMock = new();
    private readonly ReviewService _sut;

    public ReviewServicePayoutTests()
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

    private void SetupCommonReviewMocks(User reviewer, User reviewee, SubmitReviewRequest request)
    {
        _userRepoMock.Setup(r => r.GetByIdAsync(reviewee.Id)).ReturnsAsync(reviewee);
        _userRepoMock.Setup(r => r.GetByIdAsync(reviewer.Id)).ReturnsAsync(reviewer);
        _reviewRepoMock.Setup(r => r.ExistsForJobAsync(request.JobId)).ReturnsAsync(false);
        _reviewRepoMock.Setup(r => r.CreateAsync(It.IsAny<Review>())).ReturnsAsync((Review r) => r);
        _reviewRepoMock.Setup(r => r.GetAverageRatingAsync(reviewee.Id)).ReturnsAsync(4m);
        _reviewRepoMock.Setup(r => r.GetReviewCountAsync(reviewee.Id)).ReturnsAsync(1);
        _userRepoMock.Setup(r => r.UpdateAsync(It.IsAny<User>())).Returns(Task.CompletedTask);
        _notificationRepoMock.Setup(r => r.CreateAsync(It.IsAny<Notification>())).ReturnsAsync((Notification n) => n);
        _jobRepoMock.Setup(r => r.UpdateAsync(It.IsAny<Job>())).Returns(Task.CompletedTask);
    }

    [Fact]
    public async Task SubmitReview_WhenJobCompletedAndEscrowed_SchedulesHangfireAndSetsPayout_Pending()
    {
        var reviewer = TestBuilders.MakeUser("uid-reviewer", "reviewer@test.com");
        var reviewee = TestBuilders.MakeUser("uid-reviewee", "reviewee@test.com");
        reviewee.Subscriptions = new List<Subscription>
        {
            new Subscription { Tier = "silver", IsActive = true, PayoutDays = 14, StartedAt = DateTimeOffset.UtcNow }
        };

        var request = new SubmitReviewRequest
        {
            JobId = Guid.NewGuid(),
            Rating = 5,
            Text = "Excellent work.",
        };

        var job = TestBuilders.MakeJob(reviewer.Id, status: "completed");
        job.Id = request.JobId;
        job.PaymentStatus = "escrowed";

        SetupCommonReviewMocks(reviewer, reviewee, request);
        _jobRepoMock.Setup(r => r.GetByIdRawAsync(request.JobId)).ReturnsAsync(job);

        await _sut.SubmitReviewAsync(reviewer.Id, reviewee.Id, request);

        _backgroundJobsMock.Verify(
            b => b.Create(It.IsAny<HangfireJob>(), It.IsAny<Hangfire.States.IState>()),
            Times.Once);

        job.PaymentStatus.Should().Be("payout_pending");
        job.HangfireJobId.Should().Be("stub_hangfire_id");
        job.PayoutScheduledAt.Should().NotBeNull();
    }

    [Fact]
    public async Task SubmitReview_WhenJobNotCompleted_DoesNotScheduleHangfire()
    {
        var reviewer = TestBuilders.MakeUser("uid-reviewer", "reviewer@test.com");
        var reviewee = TestBuilders.MakeUser("uid-reviewee", "reviewee@test.com");

        var request = new SubmitReviewRequest
        {
            JobId = Guid.NewGuid(),
            Rating = 4,
            Text = "Good job.",
        };

        var job = TestBuilders.MakeJob(reviewer.Id, status: "in_progress");
        job.Id = request.JobId;
        job.PaymentStatus = "escrowed";

        SetupCommonReviewMocks(reviewer, reviewee, request);
        _jobRepoMock.Setup(r => r.GetByIdRawAsync(request.JobId)).ReturnsAsync(job);

        await _sut.SubmitReviewAsync(reviewer.Id, reviewee.Id, request);

        _backgroundJobsMock.Verify(
            b => b.Create(It.IsAny<HangfireJob>(), It.IsAny<Hangfire.States.IState>()),
            Times.Never);
    }

    [Fact]
    public async Task SubmitReview_WhenJobCompletedButNotEscrowed_DoesNotScheduleHangfire()
    {
        var reviewer = TestBuilders.MakeUser("uid-reviewer", "reviewer@test.com");
        var reviewee = TestBuilders.MakeUser("uid-reviewee", "reviewee@test.com");

        var request = new SubmitReviewRequest
        {
            JobId = Guid.NewGuid(),
            Rating = 3,
            Text = "Decent.",
        };

        var job = TestBuilders.MakeJob(reviewer.Id, status: "completed");
        job.Id = request.JobId;
        job.PaymentStatus = "paid"; // already paid — shouldn't schedule again

        SetupCommonReviewMocks(reviewer, reviewee, request);
        _jobRepoMock.Setup(r => r.GetByIdRawAsync(request.JobId)).ReturnsAsync(job);

        await _sut.SubmitReviewAsync(reviewer.Id, reviewee.Id, request);

        _backgroundJobsMock.Verify(
            b => b.Create(It.IsAny<HangfireJob>(), It.IsAny<Hangfire.States.IState>()),
            Times.Never);
    }
}
