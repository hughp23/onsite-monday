using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Stubs;

namespace OnsiteMonday.Api.Controllers;

[ApiController]
[Route("api/webhooks/mangopay")]
[EnableRateLimiting("public")]
public class MangopayWebhookController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IMangopayService _mangopay;
    private readonly ILogger<MangopayWebhookController> _logger;

    public MangopayWebhookController(
        AppDbContext db,
        IMangopayService mangopay,
        ILogger<MangopayWebhookController> logger)
    {
        _db = db;
        _mangopay = mangopay;
        _logger = logger;
    }

    // Mangopay POSTs to this endpoint for payment events.
    // EventType and RessourceId are sent as query parameters (Mangopay's spelling).
    [HttpPost]
    public async Task<IActionResult> HandleEvent(
        [FromQuery] string EventType,
        [FromQuery] string RessourceId)
    {
        Request.EnableBuffering();
        using var reader = new StreamReader(Request.Body, leaveOpen: true);
        var rawBody = await reader.ReadToEndAsync();
        Request.Body.Position = 0;

        if (!_mangopay.ValidateWebhookSignature(rawBody, EventType))
        {
            _logger.LogWarning("Mangopay webhook: invalid signature for event {EventType}", EventType);
            return BadRequest("Invalid webhook signature.");
        }

        _logger.LogInformation("Mangopay webhook: {EventType} resource {ResourceId}", EventType, RessourceId);

        switch (EventType)
        {
            case "PAYIN_NORMAL_SUCCEEDED":
                await HandlePayInSucceededAsync(RessourceId);
                break;
            case "PAYIN_NORMAL_FAILED":
                await HandlePayInFailedAsync(RessourceId);
                break;
            case "KYC_SUCCEEDED":
                await HandleKycSucceededAsync(RessourceId);
                break;
            case "KYC_FAILED":
                await HandleKycFailedAsync(RessourceId);
                break;
            case "TRANSFER_NORMAL_SUCCEEDED":
                _logger.LogInformation("Mangopay Transfer {ResourceId} succeeded", RessourceId);
                break;
            case "PAYOUT_NORMAL_SUCCEEDED":
                _logger.LogInformation("Mangopay Payout {ResourceId} succeeded", RessourceId);
                break;
            default:
                _logger.LogInformation("Mangopay webhook: unhandled event {EventType}", EventType);
                break;
        }

        return Ok();
    }

    private async Task HandlePayInSucceededAsync(string payInId)
    {
        var job = await _db.Jobs.FirstOrDefaultAsync(j => j.EscrowPayInId == payInId);
        if (job == null)
        {
            _logger.LogWarning("PayIn {PayInId} has no matching job", payInId);
            return;
        }
        job.PaymentStatus = "escrowed";
        await _db.SaveChangesAsync();
        _logger.LogInformation("Job {JobId} payment status updated to escrowed", job.Id);
    }

    private async Task HandlePayInFailedAsync(string payInId)
    {
        var job = await _db.Jobs.FirstOrDefaultAsync(j => j.EscrowPayInId == payInId);
        if (job == null) return;

        // Reset so the poster can retry payment
        job.PaymentStatus = "none";
        job.Status = "accepted";
        job.EscrowPayInId = null;
        await _db.SaveChangesAsync();
        _logger.LogWarning("PayIn failed for job {JobId}, reset to accepted", job.Id);
    }

    private async Task HandleKycSucceededAsync(string kycDocumentId)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.MangopayKycDocumentId == kycDocumentId);
        if (user == null)
        {
            _logger.LogWarning("KYC_SUCCEEDED: no user found for doc {DocId}", kycDocumentId);
            return;
        }
        user.MangopayKycStatus = "verified";
        await _db.SaveChangesAsync();
        _logger.LogInformation("KYC verified for user {UserId}", user.Id);
    }

    private async Task HandleKycFailedAsync(string kycDocumentId)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.MangopayKycDocumentId == kycDocumentId);
        if (user == null) return;
        user.MangopayKycStatus = "failed";
        await _db.SaveChangesAsync();
        _logger.LogWarning("KYC failed for user {UserId} — doc {DocId}", user.Id, kycDocumentId);
    }
}
