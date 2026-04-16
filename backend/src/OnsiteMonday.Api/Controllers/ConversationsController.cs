using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OnsiteMonday.Api.DTOs.Conversations;
using OnsiteMonday.Api.Repositories;
using OnsiteMonday.Api.Services;
using System.Security.Claims;

namespace OnsiteMonday.Api.Controllers;

[ApiController]
[Route("api/conversations")]
[Authorize]
public class ConversationsController : ControllerBase
{
    private readonly IConversationService _conversationService;
    private readonly IUserRepository _userRepo;

    public ConversationsController(IConversationService conversationService, IUserRepository userRepo)
    {
        _conversationService = conversationService;
        _userRepo = userRepo;
    }

    private string FirebaseUid =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException("Missing user identifier.");

    private string Email =>
        User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;

    private async Task<Guid> GetCurrentUserIdAsync()
    {
        var user = await _userRepo.GetOrCreateByFirebaseUidAsync(FirebaseUid, Email);
        return user.Id;
    }

    // GET /api/conversations
    [HttpGet]
    public async Task<ActionResult<List<ConversationDto>>> GetConversations()
    {
        var userId = await GetCurrentUserIdAsync();
        var conversations = await _conversationService.GetConversationsAsync(userId);
        return Ok(conversations);
    }

    // POST /api/conversations
    [HttpPost]
    public async Task<ActionResult<ConversationDto>> StartConversation([FromBody] StartConversationRequest request)
    {
        var userId = await GetCurrentUserIdAsync();
        var conversation = await _conversationService.GetOrCreateConversationAsync(
            userId, request.ParticipantId, request.RelatedJobId);
        return Ok(conversation);
    }

    // GET /api/conversations/{id}
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ConversationDto>> GetById(Guid id)
    {
        var userId = await GetCurrentUserIdAsync();
        var conversation = await _conversationService.GetByIdAsync(id, userId);
        return Ok(conversation);
    }

    // POST /api/conversations/{id}/messages
    [HttpPost("{id:guid}/messages")]
    public async Task<ActionResult<MessageDto>> SendMessage(Guid id, [FromBody] SendMessageRequest request)
    {
        var userId = await GetCurrentUserIdAsync();
        var message = await _conversationService.SendMessageAsync(id, userId, request.Text);
        return Ok(message);
    }

    // PUT /api/conversations/{id}/read
    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id)
    {
        var userId = await GetCurrentUserIdAsync();
        await _conversationService.MarkReadAsync(id, userId);
        return NoContent();
    }
}
