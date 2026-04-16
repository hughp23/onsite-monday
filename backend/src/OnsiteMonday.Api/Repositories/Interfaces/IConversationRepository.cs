using OnsiteMonday.Api.Domain;

namespace OnsiteMonday.Api.Repositories;

public interface IConversationRepository
{
    Task<List<Conversation>> GetByUserIdAsync(Guid userId);
    Task<Conversation?> GetByIdAsync(Guid id);
    Task<Conversation?> GetByParticipantsAsync(Guid userAId, Guid userBId);
    Task<Conversation> CreateAsync(Conversation conversation);
    Task<Message> AddMessageAsync(Message message);
    Task MarkReadAsync(Guid conversationId, Guid userId);
    Task UpdateLastActivityAsync(Guid conversationId);
}
