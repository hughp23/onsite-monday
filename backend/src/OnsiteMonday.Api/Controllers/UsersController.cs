using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

    private string FirebaseUid =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException("Missing user identifier.");

    private string Email =>
        User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;

    // GET /api/users/me
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> GetMe()
    {
        var user = await _userService.GetOrCreateCurrentUserAsync(FirebaseUid, Email);
        return Ok(user);
    }

    // PUT /api/users/me
    [HttpPut("me")]
    public async Task<ActionResult<UserDto>> UpdateMe([FromBody] UpdateUserRequest request)
    {
        var user = await _userService.UpdateCurrentUserAsync(FirebaseUid, Email, request);
        return Ok(user);
    }

    // POST /api/users/me/onboard
    [HttpPost("me/onboard")]
    public async Task<ActionResult<UserDto>> CompleteOnboarding()
    {
        var user = await _userService.CompleteOnboardingAsync(FirebaseUid);
        return Ok(user);
    }

    // GET /api/users/tradespeople?trade=Builder&location=York
    [HttpGet("tradespeople")]
    public async Task<ActionResult<List<TradespersonDto>>> GetTradespeople(
        [FromQuery] string? trade,
        [FromQuery] string? location)
    {
        var tradespeople = await _userService.GetTradespeopleAsync(trade, location);
        return Ok(tradespeople);
    }

    // GET /api/users/{id}
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserDto>> GetById(Guid id)
    {
        var user = await _userService.GetByIdAsync(id);
        return Ok(user);
    }
}
