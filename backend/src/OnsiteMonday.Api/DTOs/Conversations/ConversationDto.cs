namespace OnsiteMonday.Api.DTOs.Conversations;

public class ConversationDto
{
    public Guid Id { get; set; }
    public Guid ParticipantId { get; set; }
    public string ParticipantName { get; set; } = null!;
    public string? ParticipantImage { get; set; }
    public string LastMessage { get; set; } = string.Empty;
    public DateTimeOffset LastActivityAt { get; set; }
    public int UnreadCount { get; set; }
    public List<MessageDto> Messages { get; set; } = new();
}
