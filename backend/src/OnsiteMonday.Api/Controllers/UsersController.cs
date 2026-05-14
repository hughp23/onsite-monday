using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OnsiteMonday.Api.DTOs.Users;
using OnsiteMonday.Api.Services;
using System.Security.Claims;

namespace OnsiteMonday.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService) => _userService = userService;

    private string CognitoSub =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException("Missing user identifier.");

    private string Email =>
        User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;

    // GET /api/users/me
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> GetMe()
    {
        var user = await _userService.GetOrCreateCurrentUserAsync(CognitoSub, Email);
        return Ok(user);
    }

    // PUT /api/users/me
    [HttpPut("me")]
    public async Task<ActionResult<UserDto>> UpdateMe([FromBody] UpdateUserRequest request)
    {
        var user = await _userService.UpdateCurrentUserAsync(CognitoSub, Email, request);
        return Ok(user);
    }

    // POST /api/users/me/onboard
    [HttpPost("me/onboard")]
    public async Task<ActionResult<UserDto>> CompleteOnboarding()
    {
        var current = await _userService.GetOrCreateCurrentUserAsync(CognitoSub, Email);

        if (current.KycStatus == "none")
            return BadRequest(new { error = "Please complete identity verification before finishing setup." });

        if (!current.HasBankAccount)
            return BadRequest(new { error = "Please add your bank account details before finishing setup." });

        var user = await _userService.CompleteOnboardingAsync(CognitoSub, Email);
        return Ok(user);
    }

    // GET /api/users/tradespeople?trade=Builder&location=York
    [EnableRateLimiting("user-lookup")]
    [HttpGet("tradespeople")]
    public async Task<ActionResult<List<TradespersonDto>>> GetTradespeople(
        [FromQuery] string? trade,
        [FromQuery] string? location)
    {
        var tradespeople = await _userService.GetTradespeopleAsync(trade, location);
        return Ok(tradespeople);
    }

    // GET /api/users/{id}
    [EnableRateLimiting("user-lookup")]
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserDto>> GetById(Guid id)
    {
        var user = await _userService.GetByIdAsync(id);
        return Ok(user);
    }
}
