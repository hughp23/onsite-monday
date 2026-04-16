using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OnsiteMonday.Api.DTOs.Notifications;
using OnsiteMonday.Api.Repositories;
using OnsiteMonday.Api.Services;
using System.Security.Claims;

namespace OnsiteMonday.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;
    private readonly IUserRepository _userRepo;

    public NotificationsController(INotificationService notificationService, IUserRepository userRepo)
    {
        _notificationService = notificationService;
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

    // GET /api/notifications
    [HttpGet]
    public async Task<ActionResult<List<NotificationDto>>> GetNotifications()
    {
        var userId = await GetCurrentUserIdAsync();
        var notifications = await _notificationService.GetNotificationsAsync(userId);
        return Ok(notifications);
    }

    // PUT /api/notifications/{id}/read
    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id)
    {
        var userId = await GetCurrentUserIdAsync();
        await _notificationService.MarkReadAsync(id, userId);
        return NoContent();
    }

    // PUT /api/notifications/read-all
    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        var userId = await GetCurrentUserIdAsync();
        await _notificationService.MarkAllReadAsync(userId);
        return NoContent();
    }
}
