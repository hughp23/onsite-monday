using OnsiteMonday.Api.DTOs.Conversations;

namespace OnsiteMonday.Api.Services;

public interface IConversationService
{
    Task<List<ConversationDto>> GetConversationsAsync(Guid userId);
    Task<ConversationDto> GetOrCreateConversationAsync(Guid initiatorId, Guid participantId, Guid? relatedJobId);
    Task<ConversationDto> GetByIdAsync(Guid conversationId, Guid userId);
    Task<MessageDto> SendMessageAsync(Guid conversationId, Guid senderId, string text);
    Task MarkReadAsync(Guid conversationId, Guid userId);
}
