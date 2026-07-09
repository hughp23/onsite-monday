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
    private readonly IStorageService _storageService;

    public UsersController(IUserService userService, IStorageService storageService)
    {
        _userService = userService;
        _storageService = storageService;
    }

    private string CognitoSub =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException("Missing user identifier.");

    private string Email =>
        User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;

    // Cognito passes Google's given_name / family_name / picture claims in the JWT.
    // Try both the long ClaimTypes form and the short JWT form.
    private string? GivenName =>
        NullIfEmpty(User.FindFirstValue(ClaimTypes.GivenName) ?? User.FindFirstValue("given_name"));

    private string? FamilyName =>
        NullIfEmpty(User.FindFirstValue(ClaimTypes.Surname) ?? User.FindFirstValue("family_name"));

    private string? Picture =>
        NullIfEmpty(User.FindFirstValue("picture"));

    private static string? NullIfEmpty(string? s) => string.IsNullOrWhiteSpace(s) ? null : s;

    // GET /api/users/me
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> GetMe()
    {
        var user = await _userService.GetOrCreateCurrentUserAsync(CognitoSub, Email, GivenName, FamilyName, Picture);
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

    // POST /api/users/me/profile-image-upload-url
    [HttpPost("me/profile-image-upload-url")]
    public async Task<ActionResult<ProfileImageUploadUrlResponse>> GetProfileImageUploadUrl(
        [FromBody] ProfileImageUploadUrlRequest request)
    {
        if (request.ContentType is not ("image/jpeg" or "image/png"))
            return BadRequest(new { error = "contentType must be image/jpeg or image/png" });

        var (uploadUrl, publicUrl) = await _storageService.GenerateProfileImageUploadUrlAsync(
            CognitoSub, request.ContentType);

        return Ok(new ProfileImageUploadUrlResponse(uploadUrl, publicUrl));
    }
}
