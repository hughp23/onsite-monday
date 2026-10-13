using AutoMapper;
using FluentAssertions;
using Hangfire;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.Mapping;
using OnsiteMonday.Api.Repositories;
using OnsiteMonday.Api.Services;
using OnsiteMonday.Api.Services.Interfaces;
using OnsiteMonday.Api.Tests.Infrastructure;

namespace OnsiteMonday.Api.Tests.Unit.Services;

public class JobCancellationTests
{
    private readonly Mock<IJobRepository> _jobRepoMock = new();
    private readonly Mock<INotificationRepository> _notificationRepoMock = new();
    private readonly Mock<IStripeConnectService> _stripeMock = new();
    private readonly JobService _sut;

    private readonly User _poster = TestBuilders.MakeUser("uid-poster", "poster@test.com");
    private readonly User _tradesperson = TestBuilders.MakeUser("uid-tp", "tp@test.com");

    public JobCancellationTests()
    {
        _notificationRepoMock.Setup(r => r.CreateAsync(It.IsAny<Notification>())).ReturnsAsync(new Notification());
        _jobRepoMock.Setup(r => r.UpdateAsync(It.IsAny<Job>())).Returns(Task.CompletedTask);
        _stripeMock.Setup(s => s.TryExpireCheckoutSessionAsync(It.IsAny<string>())).ReturnsAsync(true);
        _stripeMock.Setup(s => s.RefundJobPaymentAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync("re_test");
        var mapper = new MapperConfiguration(cfg => cfg.AddProfile<MappingProfile>()).CreateMapper();
        _sut = new JobService(_jobRepoMock.Object, Mock.Of<IUserRepository>(), _notificationRepoMock.Object,
            _stripeMock.Object, Mock.Of<IBackgroundJobClient>(), Mock.Of<IUsageService>(), mapper,
            NullLogger<JobService>.Instance);
    }

    private Job SetupJob(string status, string paymentStatus, int startDaysFromToday = 7,
        string? sessionId = null, string? paymentIntentId = null)
    {
        var job = TestBuilders.MakeJob(_poster.Id, status: status, paymentStatus: paymentStatus,
            stripeCheckoutSessionId: sessionId, stripePaymentIntentId: paymentIntentId);
        job.StartDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(startDaysFromToday);
        job.EndDate = job.StartDate.AddDays(4);

        _jobRepoMock.Setup(r => r.GetByIdAsync(job.Id, It.IsAny<Guid>())).ReturnsAsync((job, false, 1));
        _jobRepoMock.Setup(r => r.GetApplicationCountAsync(job.Id)).ReturnsAsync(1);
        _jobRepoMock.Setup(r => r.GetApplicantsAsync(job.Id)).ReturnsAsync(new List<(User, JobApplication)>
        {
            (_tradesperson, new JobApplication
            {
                Id = Guid.NewGuid(), JobId = job.Id, ApplicantId = _tradesperson.Id,
                Status = "accepted", AppliedAt = DateTimeOffset.UtcNow,
            }),
        });
        return job;
    }

    [Fact]
    public async Task AcceptedJob_Cancels_WithoutTouchingStripe()
    {
        var job = SetupJob("accepted", "none");

        var dto = await _sut.CancelJobAsync(job.Id, _poster.Id, "No longer needed");

        dto.Status.Should().Be("cancelled");
        dto.PaymentStatus.Should().Be("none");
        job.CancellationReason.Should().Be("No longer needed");
        _stripeMock.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task UnpaidInProgressJob_ExpiresCheckoutThenCancels()
    {
        var job = SetupJob("in_progress", "payin_pending", sessionId: "cs_open");

        var dto = await _sut.CancelJobAsync(job.Id, _poster.Id, null);

        _stripeMock.Verify(s => s.TryExpireCheckoutSessionAsync("cs_open"), Times.Once);
        _stripeMock.Verify(s => s.RefundJobPaymentAsync(It.IsAny<Guid>(), It.IsAny<string>()), Times.Never);
        dto.Status.Should().Be("cancelled");
        dto.PaymentStatus.Should().Be("none");
    }

    [Fact]
    public async Task UnpaidInProgressJob_WhenCheckoutHasJustCompleted_RefusesAndChangesNothing()
    {
        var job = SetupJob("in_progress", "payin_pending", sessionId: "cs_paid");
        _stripeMock.Setup(s => s.TryExpireCheckoutSessionAsync("cs_paid")).ReturnsAsync(false);

        var act = () => _sut.CancelJobAsync(job.Id, _poster.Id, null);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*just gone through*");
        job.Status.Should().Be("in_progress");
        job.PaymentStatus.Should().Be("payin_pending");
        _jobRepoMock.Verify(r => r.UpdateAsync(It.IsAny<Job>()), Times.Never);
    }

    [Fact]
    public async Task PaidJob_PosterBeforeStartDate_RefundsInFull()
    {
        var job = SetupJob("in_progress", "escrowed", startDaysFromToday: 2, paymentIntentId: "pi_paid");

        var dto = await _sut.CancelJobAsync(job.Id, _poster.Id, null);

        _stripeMock.Verify(s => s.RefundJobPaymentAsync(job.Id, "pi_paid"), Times.Once);
        dto.Status.Should().Be("cancelled");
        dto.PaymentStatus.Should().Be("refunded");
        _notificationRepoMock.Verify(r => r.CreateAsync(It.Is<Notification>(n =>
            n.UserId == _tradesperson.Id && !n.Description.Contains("refunded"))), Times.Once);
    }

    [Fact]
    public async Task PaidJob_PosterAfterStartDate_IsRefused()
    {
        var job = SetupJob("in_progress", "escrowed", startDaysFromToday: -2, paymentIntentId: "pi_paid");

        var act = () => _sut.CancelJobAsync(job.Id, _poster.Id, null);

        await act.Should().ThrowAsync<UnauthorizedAccessException>().WithMessage("*only the tradesperson*");
        _stripeMock.Verify(s => s.RefundJobPaymentAsync(It.IsAny<Guid>(), It.IsAny<string>()), Times.Never);
        _jobRepoMock.Verify(r => r.UpdateAsync(It.IsAny<Job>()), Times.Never);
        job.PaymentStatus.Should().Be("escrowed");
    }

    [Fact]
    public async Task PaidJob_TradespersonAfterStartDate_RefundsAndTellsThePoster()
    {
        var job = SetupJob("in_progress", "escrowed", startDaysFromToday: -2, paymentIntentId: "pi_paid");

        var dto = await _sut.CancelJobAsync(job.Id, _tradesperson.Id, "Can't make it");

        _stripeMock.Verify(s => s.RefundJobPaymentAsync(job.Id, "pi_paid"), Times.Once);
        dto.PaymentStatus.Should().Be("refunded");
        _notificationRepoMock.Verify(r => r.CreateAsync(It.Is<Notification>(n =>
            n.UserId == _poster.Id && n.Description.Contains("refunded in full"))), Times.Once);
    }

    [Fact]
    public async Task PaidJob_WhenStripeRefundFails_CancelsAndLeavesRefundPending()
    {
        var job = SetupJob("in_progress", "escrowed", paymentIntentId: "pi_paid");
        _stripeMock.Setup(s => s.RefundJobPaymentAsync(job.Id, "pi_paid"))
            .ThrowsAsync(new Stripe.StripeException("card_declined"));

        var dto = await _sut.CancelJobAsync(job.Id, _tradesperson.Id, null);

        dto.Status.Should().Be("cancelled");
        dto.PaymentStatus.Should().Be("refund_pending");
        _notificationRepoMock.Verify(r => r.CreateAsync(It.Is<Notification>(n =>
            n.UserId == _poster.Id && !n.Description.Contains("refunded"))), Times.Once);
    }

    [Fact]
    public async Task PaidJob_WithNoRecordedPaymentIntent_LeavesRefundPending()
    {
        var job = SetupJob("in_progress", "escrowed", paymentIntentId: null);

        var dto = await _sut.CancelJobAsync(job.Id, _poster.Id, null);

        _stripeMock.Verify(s => s.RefundJobPaymentAsync(It.IsAny<Guid>(), It.IsAny<string>()), Times.Never);
        dto.PaymentStatus.Should().Be("refund_pending");
    }

    [Theory]
    [InlineData("open")]
    [InlineData("completed")]
    [InlineData("cancelled")]
    public async Task OtherStatuses_AreRefused(string status)
    {
        var job = SetupJob(status, status == "completed" ? "escrowed" : "none");

        var act = () => _sut.CancelJobAsync(job.Id, _poster.Id, null);

        await act.Should().ThrowAsync<InvalidOperationException>();
        _stripeMock.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task SomeoneElse_IsRefused()
    {
        var job = SetupJob("in_progress", "escrowed", paymentIntentId: "pi_paid");

        var act = () => _sut.CancelJobAsync(job.Id, Guid.NewGuid(), null);

        await act.Should().ThrowAsync<UnauthorizedAccessException>();
        _stripeMock.VerifyNoOtherCalls();
    }
}
