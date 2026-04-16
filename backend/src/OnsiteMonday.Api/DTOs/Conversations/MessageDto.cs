namespace OnsiteMonday.Api.DTOs.Conversations;

public class MessageDto
{
    public Guid Id { get; set; }
    public Guid ConversationId { get; set; }
    public Guid SenderId { get; set; }
    public string Text { get; set; } = null!;
    public bool IsRead { get; set; }
    public DateTimeOffset SentAt { get; set; }
}
