using Microsoft.EntityFrameworkCore;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Services.Interfaces;

namespace OnsiteMonday.Api.Jobs;

public class PayoutReleaseJob : IPayoutReleaseJob
{
    private readonly AppDbContext _db;
    private readonly IStripeConnectService _stripeConnect;
    private readonly ILogger<PayoutReleaseJob> _logger;

    public PayoutReleaseJob(AppDbContext db, IStripeConnectService stripeConnect, ILogger<PayoutReleaseJob> logger)
    {
        _db = db;
        _stripeConnect = stripeConnect;
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
            _logger.LogWarning("PayoutReleaseJob: job {JobId} has PaymentStatus={Status}, skipping duplicate trigger", jobId, job.PaymentStatus);
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
        var amount = job.DayRate * job.Duration;

        if (string.IsNullOrEmpty(tradesperson.StripeConnectAccountId))
        {
            _logger.LogError("PayoutReleaseJob: tradesperson {UserId} has no Stripe Connect account, cannot transfer for job {JobId}", tradesperson.Id, jobId);
            return;
        }

        var netAmountPence = (long)Math.Round(amount * 100, MidpointRounding.AwayFromZero);

        if (string.IsNullOrEmpty(job.StripeTransferId))
        {
            var transferId = await _stripeConnect.CreateTransferAsync(jobId, tradesperson.StripeConnectAccountId, netAmountPence);
            job.StripeTransferId = transferId;
            await _db.SaveChangesAsync();
        }

        job.PaymentStatus = "payout_complete";
        await _db.SaveChangesAsync();

        _logger.LogInformation("PayoutReleaseJob: completed for job {JobId}, £{Amount}", jobId, amount);
    }
}
