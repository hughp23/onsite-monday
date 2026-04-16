using OnsiteMonday.Api.DTOs.Notifications;
using OnsiteMonday.Api.Repositories;

namespace OnsiteMonday.Api.Services;

public class NotificationService : INotificationService
{
    private readonly INotificationRepository _repo;

    public NotificationService(INotificationRepository repo) => _repo = repo;

    public async Task<List<NotificationDto>> GetNotificationsAsync(Guid userId)
    {
        var notifications = await _repo.GetByUserIdAsync(userId);
        return notifications.Select(n => new NotificationDto
        {
            Id = n.Id,
            Type = n.Type,
            Title = n.Title,
            Description = n.Description,
            IsRead = n.IsRead,
            LinkedId = n.LinkedId,
            CreatedAt = n.CreatedAt,
        }).ToList();
    }

    public Task MarkReadAsync(Guid notificationId, Guid userId) =>
        _repo.MarkReadAsync(notificationId, userId);

    public Task MarkAllReadAsync(Guid userId) =>
        _repo.MarkAllReadAsync(userId);
}
