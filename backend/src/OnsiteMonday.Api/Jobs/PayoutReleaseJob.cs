using Microsoft.EntityFrameworkCore;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Stubs;

namespace OnsiteMonday.Api.Jobs;

public class PayoutReleaseJob : IPayoutReleaseJob
{
    private readonly AppDbContext _db;
    private readonly IMangopayService _mangopay;
    private readonly ILogger<PayoutReleaseJob> _logger;

    public PayoutReleaseJob(AppDbContext db, IMangopayService mangopay, ILogger<PayoutReleaseJob> logger)
    {
        _db = db;
        _mangopay = mangopay;
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

        if (string.IsNullOrEmpty(tradesperson.MangopayWalletId))
        {
            _logger.LogError("PayoutReleaseJob: tradesperson {UserId} has no Mangopay wallet, cannot transfer for job {JobId}", tradesperson.Id, jobId);
            return;
        }

        if (string.IsNullOrEmpty(job.EscrowTransferId))
        {
            var transferId = await _mangopay.TransferToTradesPersonWalletAsync(jobId, tradesperson.MangopayUserId!, tradesperson.MangopayWalletId, amount);
            job.EscrowTransferId = transferId;
            await _db.SaveChangesAsync();
        }

        // Bank PayOut is deferred until KYC/bank-account registration is implemented.
        // Funds are now in the tradesperson's Mangopay wallet and accessible.
        _logger.LogInformation(
            "PayoutReleaseJob: Transfer complete for job {JobId}. Bank payout deferred (KYC Phase 2). " +
            "Funds in wallet {WalletId}.",
            jobId, tradesperson.MangopayWalletId);

        job.PaymentStatus = "paid";
        await _db.SaveChangesAsync();

        _logger.LogInformation("PayoutReleaseJob: completed for job {JobId}, £{Amount}", jobId, amount);
    }
}
