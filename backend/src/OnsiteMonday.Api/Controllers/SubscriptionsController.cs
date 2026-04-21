using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OnsiteMonday.Api.DTOs.Subscriptions;
using OnsiteMonday.Api.Repositories;
using OnsiteMonday.Api.Services;
using System.Security.Claims;

namespace OnsiteMonday.Api.Controllers;

[ApiController]
[Route("api/subscriptions")]
[Authorize]
public class SubscriptionsController : ControllerBase
{
    private readonly ISubscriptionService _subscriptionService;
    private readonly IUserRepository _userRepo;

    public SubscriptionsController(ISubscriptionService subscriptionService, IUserRepository userRepo)
    {
        _subscriptionService = subscriptionService;
        _userRepo = userRepo;
    }

    private string FirebaseUid =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException("Missing user identifier.");

    private string Email =>
        User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;

    private async Task<Guid> GetCurrentUserIdAsync()
    {
        var user = await _userRepo.GetOrCreateByFirebaseUidAsync(FirebaseUid, Email);
        return user.Id;
    }

    // GET /api/subscriptions/current
    [HttpGet("current")]
    public async Task<ActionResult<SubscriptionDto>> GetCurrent()
    {
        var userId = await GetCurrentUserIdAsync();
        var subscription = await _subscriptionService.GetCurrentAsync(userId);

        if (subscription == null)
            return Ok(new SubscriptionDto { Tier = "bronze", PayoutDays = 30, IsActive = false });

        return Ok(subscription);
    }

    // POST /api/subscriptions
    [HttpPost]
    public async Task<ActionResult<SubscriptionCheckoutResponse>> UpdateSubscription([FromBody] UpdateSubscriptionRequest request)
    {
        var userId = await GetCurrentUserIdAsync();
        var response = await _subscriptionService.UpdateSubscriptionAsync(userId, request.Tier);
        return Ok(response);
    }
}
