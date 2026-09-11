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
        var jobId = Guid.NewGuid();
        var job = TestBuilders.MakeJob(_posterId, status: "completed", id: jobId,
            paymentStatus: "payout_pending");
        _db.Jobs.Add(job);
        _db.JobApplications.Add(new JobApplication
        {
            Id = Guid.NewGuid(), JobId = jobId, ApplicantId = _tradespersonId,
            Status = "accepted", AppliedAt = DateTimeOffset.UtcNow,
        });
        await _db.SaveChangesAsync();

        _connectMock
            .Setup(s => s.CreateTransferAsync(jobId, "acct_live_123", It.IsAny<long>()))
            .ReturnsAsync("tr_real_123");

        await _sut.ExecuteAsync(jobId);

        var updated = await _db.Jobs.FindAsync(jobId);
        updated!.PaymentStatus.Should().Be("payout_complete");
        updated.StripeTransferId.Should().Be("tr_real_123");

        // Job DayRate=250, Duration=5, total=1250, fee=10% → transfer=1125
        _connectMock.Verify(
            s => s.CreateTransferAsync(jobId, "acct_live_123", 112500L), Times.Once);
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
            paymentStatus: "payout_pending");
        _db.Jobs.Add(job);
        _db.JobApplications.Add(new JobApplication
        {
            Id = Guid.NewGuid(), JobId = jobId, ApplicantId = _tradespersonId,
            Status = "accepted", AppliedAt = DateTimeOffset.UtcNow,
        });
        await _db.SaveChangesAsync();

        await _sut.ExecuteAsync(jobId);

        _connectMock.Verify(s => s.CreateTransferAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<long>()), Times.Never);
        var updated = await _db.Jobs.FindAsync(jobId);
        updated!.PaymentStatus.Should().Be("payout_pending");
    }
}
