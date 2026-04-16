namespace OnsiteMonday.Api.Domain;

public class Message
{
    public Guid Id { get; set; }
    public Guid ConversationId { get; set; }
    public Conversation Conversation { get; set; } = null!;
    public Guid SenderId { get; set; }
    public User Sender { get; set; } = null!;
    public string Text { get; set; } = null!;
    public bool IsRead { get; set; } = false;
    public DateTimeOffset SentAt { get; set; }
}
