namespace OnsiteMonday.Api.DTOs.Conversations;

public class StartConversationRequest
{
    public Guid ParticipantId { get; set; }
    public Guid? RelatedJobId { get; set; }
}
