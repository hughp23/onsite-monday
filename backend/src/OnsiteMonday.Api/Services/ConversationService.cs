using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.DTOs.Conversations;
using OnsiteMonday.Api.Repositories;

namespace OnsiteMonday.Api.Services;

public class ConversationService : IConversationService
{
    private readonly IConversationRepository _repo;
    private readonly IUserRepository _userRepo;

    public ConversationService(IConversationRepository repo, IUserRepository userRepo)
    {
        _repo = repo;
        _userRepo = userRepo;
    }

    public async Task<List<ConversationDto>> GetConversationsAsync(Guid userId)
    {
        var conversations = await _repo.GetByUserIdAsync(userId);
        return conversations.Select(c => ToDto(c, userId)).ToList();
    }

    public async Task<ConversationDto> GetOrCreateConversationAsync(Guid initiatorId, Guid participantId, Guid? relatedJobId)
    {
        // Upsert — return existing conversation if one already exists between this pair
        var existing = await _repo.GetByParticipantsAsync(initiatorId, participantId);
        if (existing != null)
        {
            var full = await _repo.GetByIdAsync(existing.Id);
            return ToDto(full!, initiatorId);
        }

        var participant = await _userRepo.GetByIdAsync(participantId)
            ?? throw new KeyNotFoundException($"User {participantId} not found.");

        var initiator = await _userRepo.GetByIdAsync(initiatorId)
            ?? throw new KeyNotFoundException("Initiator not found.");

        var now = DateTimeOffset.UtcNow;
        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            InitiatorId = initiatorId,
            Initiator = initiator,
            ParticipantId = participantId,
            Participant = participant,
            RelatedJobId = relatedJobId,
            CreatedAt = now,
            LastActivityAt = now,
        };

        await _repo.CreateAsync(conversation);
        return ToDto(conversation, initiatorId);
    }

    public async Task<ConversationDto> GetByIdAsync(Guid conversationId, Guid userId)
    {
        var conversation = await _repo.GetByIdAsync(conversationId)
            ?? throw new KeyNotFoundException($"Conversation {conversationId} not found.");

        if (conversation.InitiatorId != userId && conversation.ParticipantId != userId)
            throw new UnauthorizedAccessException("You are not a participant in this conversation.");

        return ToDto(conversation, userId);
    }

    public async Task<MessageDto> SendMessageAsync(Guid conversationId, Guid senderId, string text)
    {
        var conversation = await _repo.GetByIdAsync(conversationId)
            ?? throw new KeyNotFoundException($"Conversation {conversationId} not found.");

        if (conversation.InitiatorId != senderId && conversation.ParticipantId != senderId)
            throw new UnauthorizedAccessException("You are not a participant in this conversation.");

        var message = new Message
        {
            Id = Guid.NewGuid(),
            ConversationId = conversationId,
            SenderId = senderId,
            Text = text,
            IsRead = false,
            SentAt = DateTimeOffset.UtcNow,
        };

        await _repo.AddMessageAsync(message);
        await _repo.UpdateLastActivityAsync(conversationId);

        return new MessageDto
        {
            Id = message.Id,
            ConversationId = message.ConversationId,
            SenderId = message.SenderId,
            Text = message.Text,
            IsRead = message.IsRead,
            SentAt = message.SentAt,
        };
    }

    public Task MarkReadAsync(Guid conversationId, Guid userId) =>
        _repo.MarkReadAsync(conversationId, userId);

    private static ConversationDto ToDto(Conversation c, Guid currentUserId)
    {
        // The "other" participant from the current user's perspective
        var isInitiator = c.InitiatorId == currentUserId;
        var other = isInitiator ? c.Participant : c.Initiator;
        var otherId = isInitiator ? c.ParticipantId : c.InitiatorId;

        var messages = c.Messages
            .OrderBy(m => m.SentAt)
            .Select(m => new MessageDto
            {
                Id = m.Id,
                ConversationId = m.ConversationId,
                SenderId = m.SenderId,
                Text = m.Text,
                IsRead = m.IsRead,
                SentAt = m.SentAt,
            }).ToList();

        var lastMessage = messages.LastOrDefault();
        var unreadCount = c.Messages.Count(m => m.SenderId != currentUserId && !m.IsRead);

        return new ConversationDto
        {
            Id = c.Id,
            ParticipantId = otherId,
            ParticipantName = other != null
                ? $"{other.FirstName} {other.LastName}".Trim()
                : string.Empty,
            ParticipantImage = other?.ProfileImageUrl,
            LastMessage = lastMessage?.Text ?? string.Empty,
            LastActivityAt = c.LastActivityAt,
            UnreadCount = unreadCount,
            Messages = messages,
        };
    }
}
