using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.Jobs;
using OnsiteMonday.Api.Services;
using OnsiteMonday.Api.Services.Interfaces;
using OnsiteMonday.Api.Tests.Infrastructure;

namespace OnsiteMonday.Api.Tests.Unit.Services;

public class PayoutReleaseJobTests : IAsyncLifetime
{
    private readonly AppDbContext _db;
    private readonly Mock<IStripeConnectService> _connectMock = new();
    private readonly IPayoutReleaseJob _sut;

    private Guid _posterId;
    private Guid _tradespersonId;

    public PayoutReleaseJobTests()
    {
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("PayoutReleaseJob_" + Guid.NewGuid())
            .Options;
        _db = new AppDbContext(opts);

        var stripeOpts = Options.Create(new StripeOptions { PlatformFeePercent = 10 });
        _sut = new PayoutReleaseJob(_db, _connectMock.Object, stripeOpts, NullLogger<PayoutReleaseJob>.Instance);
    }

    public async Task InitializeAsync()
    {
        var poster = TestBuilders.MakeUser("poster-sub", "poster@test.com");
        _db.Users.Add(poster);
        await _db.SaveChangesAsync();
        _posterId = poster.Id;

        var tradesperson = TestBuilders.MakeUserWithStripeConnect("tp-sub", "tp@test.com", "acct_live_123", true);
        _db.Users.Add(tradesperson);
        await _db.SaveChangesAsync();
        _tradespersonId = tradesperson.Id;
    }

    public Task DisposeAsync() { _db.Dispose(); return Task.CompletedTask; }

    [Fact]
    public async Task ExecuteAsync_TransfersFundsAndSetsPaid()
    {
        // Job DayRate=250, Duration=5 → captured 125000p. Fee=10% → transfer=112500p.
        var jobId = Guid.NewGuid();
        var job = TestBuilders.MakeJob(_posterId, status: "completed", id: jobId,
            paymentStatus: "payout_pending",
            stripePaymentIntentId: "pi_exec_test_123");
        _db.Jobs.Add(job);
        _db.JobApplications.Add(new JobApplication
        {
            Id = Guid.NewGuid(), JobId = jobId, ApplicantId = _tradespersonId,
            Status = "accepted", AppliedAt = DateTimeOffset.UtcNow,
        });
        await _db.SaveChangesAsync();

        _connectMock
            .Setup(s => s.GetPaymentIntentAmountAsync("pi_exec_test_123"))
            .ReturnsAsync(125_000L);
        _connectMock
            .Setup(s => s.CreateTransferAsync(jobId, "acct_live_123", It.IsAny<long>(), It.IsAny<string?>()))
            .ReturnsAsync("tr_real_123");

        await _sut.ExecuteAsync(jobId);

        var updated = await _db.Jobs.FindAsync(jobId);
        updated!.PaymentStatus.Should().Be("payout_complete");
        updated.StripeTransferId.Should().Be("tr_real_123");

        _connectMock.Verify(
            s => s.CreateTransferAsync(jobId, "acct_live_123", 112_500L, "pi_exec_test_123"),
            Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_UsesActualCapturedAmountNotComputedRate()
    {
        // Job DayRate=250, Duration=5 would compute 125000p — but actual capture was 100000p.
        // Transfer must use the Stripe amount, not the computed one.
        var jobId = Guid.NewGuid();
        var job = TestBuilders.MakeJob(_posterId, status: "completed", id: jobId,
            paymentStatus: "payout_pending",
            stripePaymentIntentId: "pi_diff_amount_456");
        _db.Jobs.Add(job);
        _db.JobApplications.Add(new JobApplication
        {
            Id = Guid.NewGuid(), JobId = jobId, ApplicantId = _tradespersonId,
            Status = "accepted", AppliedAt = DateTimeOffset.UtcNow,
        });
        await _db.SaveChangesAsync();

        _connectMock
            .Setup(s => s.GetPaymentIntentAmountAsync("pi_diff_amount_456"))
            .ReturnsAsync(100_000L); // £1000 — differs from DayRate*Duration=£1250
        _connectMock
            .Setup(s => s.CreateTransferAsync(jobId, "acct_live_123", It.IsAny<long>(), It.IsAny<string?>()))
            .ReturnsAsync("tr_diff_456");

        await _sut.ExecuteAsync(jobId);

        // 10% fee of £1000 = £100; net = £900 = 90000p — NOT 112500p
        _connectMock.Verify(
            s => s.CreateTransferAsync(jobId, "acct_live_123", 90_000L, "pi_diff_amount_456"),
            Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_WhenPaymentIntentIdMissing_LogsErrorAndAborts()
    {
        var jobId = Guid.NewGuid();
        var job = TestBuilders.MakeJob(_posterId, status: "completed", id: jobId,
            paymentStatus: "payout_pending",
            stripePaymentIntentId: null); // no payment intent ID
        _db.Jobs.Add(job);
        _db.JobApplications.Add(new JobApplication
        {
            Id = Guid.NewGuid(), JobId = jobId, ApplicantId = _tradespersonId,
            Status = "accepted", AppliedAt = DateTimeOffset.UtcNow,
        });
        await _db.SaveChangesAsync();

        await _sut.ExecuteAsync(jobId);

        _connectMock.Verify(
            s => s.CreateTransferAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<long>(), It.IsAny<string?>()),
            Times.Never);

        var updated = await _db.Jobs.FindAsync(jobId);
        updated!.PaymentStatus.Should().Be("payout_pending");
    }

    [Fact]
    public async Task ExecuteAsync_WhenNoConnectAccount_LogsErrorAndAborts()
    {
        var tp = await _db.Users.FindAsync(_tradespersonId);
        tp!.StripeConnectAccountId = null;
        tp.StripeConnectOnboardingComplete = false;
        await _db.SaveChangesAsync();

        var jobId = Guid.NewGuid();
        var job = TestBuilders.MakeJob(_posterId, status: "completed", id: jobId,
            paymentStatus: "payout_pending",
            stripePaymentIntentId: "pi_no_account_789");
        _db.Jobs.Add(job);
        _db.JobApplications.Add(new JobApplication
        {
            Id = Guid.NewGuid(), JobId = jobId, ApplicantId = _tradespersonId,
            Status = "accepted", AppliedAt = DateTimeOffset.UtcNow,
        });
        await _db.SaveChangesAsync();

        await _sut.ExecuteAsync(jobId);

        _connectMock.Verify(
            s => s.CreateTransferAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<long>(), It.IsAny<string?>()),
            Times.Never);

        var updated = await _db.Jobs.FindAsync(jobId);
        updated!.PaymentStatus.Should().Be("payout_pending");
    }
}
