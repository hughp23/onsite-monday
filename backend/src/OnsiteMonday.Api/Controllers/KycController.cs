using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Stubs;
using System.Security.Claims;

namespace OnsiteMonday.Api.Controllers;

[ApiController]
[Authorize]
public class KycController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IMangopayService _mangopay;
    private readonly ILogger<KycController> _logger;

    public KycController(AppDbContext db, IMangopayService mangopay, ILogger<KycController> logger)
    {
        _db = db;
        _mangopay = mangopay;
        _logger = logger;
    }

    private string CognitoSub =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException("Missing user identifier.");

    // POST /api/kyc/document
    [HttpPost("api/kyc/document")]
    public async Task<IActionResult> SubmitKycDocument(IFormFile? file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("A file is required.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.CognitoSub == CognitoSub);
        if (user is null)
            return NotFound("User not found.");

        if (string.IsNullOrEmpty(user.MangopayUserId))
            return BadRequest("Mangopay account not set up. Please complete onboarding first.");

        byte[] fileBytes;
        using (var ms = new MemoryStream())
        {
            await file.CopyToAsync(ms);
            fileBytes = ms.ToArray();
        }

        var docId = await _mangopay.SubmitKycDocumentAsync(user.MangopayUserId, fileBytes, file.FileName);

        user.MangopayKycStatus = "pending";
        user.MangopayKycDocumentId = docId;
        await _db.SaveChangesAsync();

        _logger.LogInformation("KYC document {DocId} submitted for user {UserId}", docId, user.Id);

        return Accepted(new { kycDocumentId = docId, kycStatus = "pending" });
    }

    // PUT /api/users/me/bank-account
    [HttpPut("api/users/me/bank-account")]
    public async Task<IActionResult> RegisterBankAccount([FromBody] RegisterBankAccountRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.CognitoSub == CognitoSub);
        if (user is null)
            return NotFound("User not found.");

        if (user.MangopayKycStatus != "verified")
            return BadRequest("KYC must be verified before registering a bank account.");

        if (string.IsNullOrEmpty(user.MangopayUserId))
            return BadRequest("Mangopay account not set up. Please complete onboarding first.");

        var bankAccountId = await _mangopay.CreateBankAccountAsync(
            user.MangopayUserId,
            request.HolderName,
            request.SortCode,
            request.AccountNumber);

        user.MangopayBankAccountId = bankAccountId;
        await _db.SaveChangesAsync();

        _logger.LogInformation("Bank account {AccountId} registered for user {UserId}", bankAccountId, user.Id);

        return Ok(new { bankAccountId });
    }
}

public record RegisterBankAccountRequest(string SortCode, string AccountNumber, string HolderName);
