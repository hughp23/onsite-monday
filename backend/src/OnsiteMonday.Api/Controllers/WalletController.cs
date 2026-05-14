using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Stubs;
using System.Security.Claims;

namespace OnsiteMonday.Api.Controllers;

[ApiController]
[Route("api/wallet")]
[Authorize]
public class WalletController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IMangopayService _mangopay;
    private readonly ILogger<WalletController> _logger;

    public WalletController(AppDbContext db, IMangopayService mangopay, ILogger<WalletController> logger)
    {
        _db = db;
        _mangopay = mangopay;
        _logger = logger;
    }

    private string CognitoSub =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException("Missing user identifier.");

    // GET /api/wallet
    [HttpGet]
    public async Task<IActionResult> GetWallet()
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.CognitoSub == CognitoSub);
        if (user is null)
            return NotFound("User not found.");

        decimal balance = 0;
        long balancePence = 0;

        if (!string.IsNullOrEmpty(user.MangopayWalletId))
        {
            try
            {
                (balancePence, balance) = await _mangopay.GetWalletBalanceAsync(user.MangopayWalletId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to fetch wallet balance for user {UserId}", user.Id);
            }
        }

        return Ok(new
        {
            balance,
            balancePence,
            kycStatus = user.MangopayKycStatus,
            hasBankAccount = !string.IsNullOrEmpty(user.MangopayBankAccountId),
            autoWithdraw = user.AutoWithdraw,
        });
    }

    // POST /api/wallet/withdraw
    [HttpPost("withdraw")]
    public async Task<IActionResult> Withdraw()
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.CognitoSub == CognitoSub);
        if (user is null)
            return NotFound("User not found.");

        if (user.MangopayKycStatus != "verified")
            return BadRequest("KYC must be verified before withdrawing funds.");

        if (string.IsNullOrEmpty(user.MangopayBankAccountId))
            return BadRequest("No bank account registered.");

        if (string.IsNullOrEmpty(user.MangopayWalletId))
            return BadRequest("No Mangopay wallet found.");

        var (balancePence, balance) = await _mangopay.GetWalletBalanceAsync(user.MangopayWalletId);

        if (balance <= 0)
            return BadRequest("Insufficient balance.");

        var reference = $"withdraw-{user.Id:N}-{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
        var payoutId = await _mangopay.ReleaseFundsAsync(
            user.MangopayUserId!,
            user.MangopayWalletId,
            user.MangopayBankAccountId,
            balance,
            reference);

        _logger.LogInformation("Manual withdrawal {PayoutId} initiated for user {UserId}, amount {Amount}", payoutId, user.Id, balance);

        return Ok(new
        {
            payoutId,
            amount = balance,
            reference,
        });
    }

    // PUT /api/wallet/auto-withdraw
    [HttpPut("auto-withdraw")]
    public async Task<IActionResult> SetAutoWithdraw([FromBody] AutoWithdrawRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.CognitoSub == CognitoSub);
        if (user is null)
            return NotFound("User not found.");

        user.AutoWithdraw = request.Enabled;
        await _db.SaveChangesAsync();

        return Ok(new { autoWithdraw = user.AutoWithdraw });
    }
}

public record AutoWithdrawRequest(bool Enabled);
