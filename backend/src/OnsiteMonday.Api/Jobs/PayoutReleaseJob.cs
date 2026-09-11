using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Services;
using OnsiteMonday.Api.Services.Interfaces;

namespace OnsiteMonday.Api.Jobs;

public class PayoutReleaseJob : IPayoutReleaseJob
{
    private readonly AppDbContext _db;
    private readonly IStripeConnectService _stripeConnect;
    private readonly StripeOptions _opts;
    private readonly ILogger<PayoutReleaseJob> _logger;

    public PayoutReleaseJob(
        AppDbContext db,
        IStripeConnectService stripeConnect,
        IOptions<StripeOptions> opts,
        ILogger<PayoutReleaseJob> logger)
    {
        _db = db;
        _stripeConnect = stripeConnect;
        _opts = opts.Value;
        _logger = logger;
    }

    public async Task ExecuteAsync(Guid jobId)
    {
        var job = await _db.Jobs
            .Include(j => j.PostedBy)
            .FirstOrDefaultAsync(j => j.Id == jobId);

        if (job == null)
        {
            _logger.LogWarning("PayoutReleaseJob: job {JobId} not found", jobId);
            return;
        }

        if (job.PaymentStatus != "payout_pending")
        {
            _logger.LogWarning("PayoutReleaseJob: job {JobId} has PaymentStatus={Status}, skipping duplicate trigger",
                jobId, job.PaymentStatus);
            return;
        }

        var application = await _db.JobApplications
            .Include(a => a.Applicant)
            .FirstOrDefaultAsync(a => a.JobId == jobId && a.Status == "accepted");

        if (application == null)
        {
            _logger.LogError("PayoutReleaseJob: no accepted applicant for job {JobId}", jobId);
            return;
        }

        var tradesperson = application.Applicant;

        if (string.IsNullOrEmpty(tradesperson.StripeConnectAccountId) || !tradesperson.StripeConnectOnboardingComplete)
        {
            _logger.LogError(
                "PayoutReleaseJob: tradesperson {UserId} has no completed Stripe Connect account, cannot transfer for job {JobId}",
                tradesperson.Id, jobId);
            return;
        }

        if (string.IsNullOrEmpty(job.StripeTransferId))
        {
            var totalPence = ToMinorUnits(job.DayRate * job.Duration);
            var feePence = (long)Math.Round(totalPence * _opts.PlatformFeePercent / 100m, MidpointRounding.AwayFromZero);
            var netPence = totalPence - feePence;

            var transferId = await _stripeConnect.CreateTransferAsync(
                jobId, tradesperson.StripeConnectAccountId, netPence);

            job.StripeTransferId = transferId;
            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "PayoutReleaseJob: Transfer {TransferId} for job {JobId}, net £{Net} (total £{Total}, fee {Fee}%)",
                transferId, jobId, netPence / 100m, totalPence / 100m, _opts.PlatformFeePercent);
        }

        job.PaymentStatus = "payout_complete";
        await _db.SaveChangesAsync();

        _logger.LogInformation("PayoutReleaseJob: completed for job {JobId}", jobId);
    }

    private static long ToMinorUnits(decimal amount) =>
        (long)Math.Round(amount * 100, MidpointRounding.AwayFromZero);
}
