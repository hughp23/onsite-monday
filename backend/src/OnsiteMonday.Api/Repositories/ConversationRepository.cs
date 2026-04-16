using Microsoft.EntityFrameworkCore;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Domain;

namespace OnsiteMonday.Api.Repositories;

public class ConversationRepository : IConversationRepository
{
    private readonly AppDbContext _db;

    public ConversationRepository(AppDbContext db) => _db = db;

    public Task<List<Conversation>> GetByUserIdAsync(Guid userId) =>
        _db.Conversations
            .Include(c => c.Initiator)
            .Include(c => c.Participant)
            .Include(c => c.Messages.OrderByDescending(m => m.SentAt).Take(1))
            .Where(c => c.InitiatorId == userId || c.ParticipantId == userId)
            .OrderByDescending(c => c.LastActivityAt)
            .ToListAsync();

    public Task<Conversation?> GetByIdAsync(Guid id) =>
        _db.Conversations
            .Include(c => c.Initiator)
            .Include(c => c.Participant)
            .Include(c => c.Messages.OrderBy(m => m.SentAt))
            .FirstOrDefaultAsync(c => c.Id == id);

    public Task<Conversation?> GetByParticipantsAsync(Guid userAId, Guid userBId) =>
        _db.Conversations.FirstOrDefaultAsync(c =>
            (c.InitiatorId == userAId && c.ParticipantId == userBId) ||
            (c.InitiatorId == userBId && c.ParticipantId == userAId));

    public async Task<Conversation> CreateAsync(Conversation conversation)
    {
        _db.Conversations.Add(conversation);
        await _db.SaveChangesAsync();
        return conversation;
    }

    public async Task<Message> AddMessageAsync(Message message)
    {
        _db.Messages.Add(message);
        await _db.SaveChangesAsync();
        return message;
    }

    public async Task MarkReadAsync(Guid conversationId, Guid userId)
    {
        await _db.Messages
            .Where(m => m.ConversationId == conversationId && m.SenderId != userId && !m.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.IsRead, true));
    }

    public async Task UpdateLastActivityAsync(Guid conversationId)
    {
        await _db.Conversations
            .Where(c => c.Id == conversationId)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.LastActivityAt, DateTimeOffset.UtcNow));
    }
}
