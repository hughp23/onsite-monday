namespace OnsiteMonday.Api.DTOs.Notifications;

public class NotificationDto
{
    public Guid Id { get; set; }
    public string Type { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string Description { get; set; } = null!;
    public bool IsRead { get; set; }
    public Guid? LinkedId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
