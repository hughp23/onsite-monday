using FluentAssertions;
using Moq;
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.Repositories;
using OnsiteMonday.Api.Services;
using OnsiteMonday.Api.Tests.Infrastructure;

namespace OnsiteMonday.Api.Tests.Unit.Services;

public class ConversationServiceTests
{
    private readonly Mock<IConversationRepository> _convRepoMock = new();
    private readonly Mock<IUserRepository> _userRepoMock = new();
    private readonly ConversationService _sut;

    public ConversationServiceTests()
    {
        _sut = new ConversationService(_convRepoMock.Object, _userRepoMock.Object);
    }

    [Fact]
    public async Task GetOrCreate_WhenConversationExists_ReturnsExisting_NeverCallsCreate()
    {
        var initiator = TestBuilders.MakeUser("uid1", "a@b.com");
        var participant = TestBuilders.MakeUser("uid2", "c@d.com");
        var existing = TestBuilders.MakeConversation(initiator.Id, participant.Id);
        existing.Initiator = initiator;
        existing.Participant = participant;

        _convRepoMock
            .Setup(r => r.GetByParticipantsAsync(initiator.Id, participant.Id))
            .ReturnsAsync(existing);
        _convRepoMock
            .Setup(r => r.GetByIdAsync(existing.Id))
            .ReturnsAsync(existing);

        var result = await _sut.GetOrCreateConversationAsync(initiator.Id, participant.Id, null);

        result.Id.Should().Be(existing.Id);
        _convRepoMock.Verify(r => r.CreateAsync(It.IsAny<Conversation>()), Times.Never);
    }

    [Fact]
    public async Task GetOrCreate_WhenNoConversationExists_CreatesNew()
    {
        var initiator = TestBuilders.MakeUser("uid1", "a@b.com");
        var participant = TestBuilders.MakeUser("uid2", "c@d.com");

        _convRepoMock
            .Setup(r => r.GetByParticipantsAsync(initiator.Id, participant.Id))
            .ReturnsAsync((Conversation?)null);
        _userRepoMock.Setup(r => r.GetByIdAsync(participant.Id)).ReturnsAsync(participant);
        _userRepoMock.Setup(r => r.GetByIdAsync(initiator.Id)).ReturnsAsync(initiator);
        _convRepoMock
            .Setup(r => r.CreateAsync(It.IsAny<Conversation>()))
            .ReturnsAsync((Conversation c) => c);

        var result = await _sut.GetOrCreateConversationAsync(initiator.Id, participant.Id, null);

        result.Should().NotBeNull();
        _convRepoMock.Verify(r => r.CreateAsync(It.IsAny<Conversation>()), Times.Once);
    }

    [Fact]
    public async Task GetOrCreate_WhenParticipantNotFound_ThrowsKeyNotFoundException()
    {
        var initiatorId = Guid.NewGuid();
        var participantId = Guid.NewGuid();

        _convRepoMock
            .Setup(r => r.GetByParticipantsAsync(initiatorId, participantId))
            .ReturnsAsync((Conversation?)null);
        _userRepoMock.Setup(r => r.GetByIdAsync(participantId)).ReturnsAsync((User?)null);

        var act = () => _sut.GetOrCreateConversationAsync(initiatorId, participantId, null);

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task SendMessage_WhenSenderIsNotParticipant_ThrowsUnauthorized()
    {
        var initiator = TestBuilders.MakeUser("uid1", "a@b.com");
        var participant = TestBuilders.MakeUser("uid2", "c@d.com");
        var outsider = Guid.NewGuid();
        var conversation = TestBuilders.MakeConversation(initiator.Id, participant.Id);
        conversation.Initiator = initiator;
        conversation.Participant = participant;

        _convRepoMock.Setup(r => r.GetByIdAsync(conversation.Id)).ReturnsAsync(conversation);

        var act = () => _sut.SendMessageAsync(conversation.Id, outsider, "Hello");

        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task GetById_WhenCallerIsNotParticipant_ThrowsUnauthorized()
    {
        var initiator = TestBuilders.MakeUser("uid1", "a@b.com");
        var participant = TestBuilders.MakeUser("uid2", "c@d.com");
        var outsider = Guid.NewGuid();
        var conversation = TestBuilders.MakeConversation(initiator.Id, participant.Id);
        conversation.Initiator = initiator;
        conversation.Participant = participant;

        _convRepoMock.Setup(r => r.GetByIdAsync(conversation.Id)).ReturnsAsync(conversation);

        var act = () => _sut.GetByIdAsync(conversation.Id, outsider);

        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }
}
