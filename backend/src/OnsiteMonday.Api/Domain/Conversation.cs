namespace OnsiteMonday.Api.Domain;

public class Conversation
{
    public Guid Id { get; set; }
    public Guid InitiatorId { get; set; }
    public User Initiator { get; set; } = null!;
    public Guid ParticipantId { get; set; }
    public User Participant { get; set; } = null!;
    public Guid? RelatedJobId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset LastActivityAt { get; set; }

    // Navigation
    public ICollection<Message> Messages { get; set; } = new List<Message>();
}
