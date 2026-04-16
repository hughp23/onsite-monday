using OnsiteMonday.Api.Domain;

namespace OnsiteMonday.Api.Repositories;

public interface INotificationRepository
{
    Task<List<Notification>> GetByUserIdAsync(Guid userId);
    Task<Notification> CreateAsync(Notification notification);
    Task MarkReadAsync(Guid notificationId, Guid userId);
    Task MarkAllReadAsync(Guid userId);
}
