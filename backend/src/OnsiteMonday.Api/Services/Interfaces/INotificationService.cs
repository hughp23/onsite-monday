using OnsiteMonday.Api.DTOs.Notifications;

namespace OnsiteMonday.Api.Services;

public interface INotificationService
{
    Task<List<NotificationDto>> GetNotificationsAsync(Guid userId);
    Task MarkReadAsync(Guid notificationId, Guid userId);
    Task MarkAllReadAsync(Guid userId);
}
