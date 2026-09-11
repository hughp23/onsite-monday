using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Services.Interfaces;
using System.Security.Claims;

namespace OnsiteMonday.Api.Controllers;

[ApiController]
[Route("api/stripe-connect")]
[Authorize]
public class StripeConnectController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IStripeConnectService _stripeConnect;
    private readonly ILogger<StripeConnectController> _logger;

    public StripeConnectController(
        AppDbContext db,
        IStripeConnectService stripeConnect,
        ILogger<StripeConnectController> logger)
    {
        _db = db;
        _stripeConnect = stripeConnect;
        _logger = logger;
    }

    private string CognitoSub =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException("Missing user identifier.");

    // POST /api/stripe-connect/onboarding-link
    // Creates (or reuses) a Stripe Express account and returns a hosted onboarding URL.
    // The URL is time-limited (~5 min) — the client must open it promptly.
    [HttpPost("onboarding-link")]
    public async Task<IActionResult> CreateOnboardingLink()
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.CognitoSub == CognitoSub);
        if (user is null)
            return NotFound("User not found.");

        if (string.IsNullOrEmpty(user.StripeConnectAccountId))
        {
            user.StripeConnectAccountId = await _stripeConnect.CreateConnectedAccountAsync(user.Id, user.Email);
            await _db.SaveChangesAsync();
            _logger.LogInformation("Stripe Connect: Created account {AccountId} for user {UserId}",
                user.StripeConnectAccountId, user.Id);
        }

        var refreshUrl = "https://app.onsitemonday.co.uk/stripe-connect/refresh";
        var returnUrl = "https://app.onsitemonday.co.uk/stripe-connect/return";

        var onboardingUrl = await _stripeConnect.CreateAccountLinkAsync(
            user.StripeConnectAccountId, refreshUrl, returnUrl);

        return Ok(new { onboardingUrl });
    }

    // GET /api/stripe-connect/account-status
    // Returns the current onboarding status and account ID for the authenticated user.
    // Also syncs the local flag against Stripe on each call (in case the webhook was missed).
    [HttpGet("account-status")]
    public async Task<IActionResult> GetAccountStatus()
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.CognitoSub == CognitoSub);
        if (user is null)
            return NotFound("User not found.");

        if (string.IsNullOrEmpty(user.StripeConnectAccountId))
            return Ok(new { onboardingComplete = false, accountId = (string?)null });

        var complete = await _stripeConnect.GetOnboardingCompleteAsync(user.StripeConnectAccountId);
        if (user.StripeConnectOnboardingComplete != complete)
        {
            user.StripeConnectOnboardingComplete = complete;
            await _db.SaveChangesAsync();
        }

        return Ok(new { onboardingComplete = complete, accountId = user.StripeConnectAccountId });
    }
}
