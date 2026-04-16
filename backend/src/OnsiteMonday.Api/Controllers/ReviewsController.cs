using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OnsiteMonday.Api.DTOs.Reviews;
using OnsiteMonday.Api.Repositories;
using OnsiteMonday.Api.Services;
using System.Security.Claims;

namespace OnsiteMonday.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class ReviewsController : ControllerBase
{
    private readonly IReviewService _reviewService;
    private readonly IUserRepository _userRepo;

    public ReviewsController(IReviewService reviewService, IUserRepository userRepo)
    {
        _reviewService = reviewService;
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

    // POST /api/users/{id}/reviews
    [HttpPost("{id:guid}/reviews")]
    public async Task<ActionResult<ReviewDto>> SubmitReview(Guid id, [FromBody] SubmitReviewRequest request)
    {
        var reviewerId = await GetCurrentUserIdAsync();
        var review = await _reviewService.SubmitReviewAsync(reviewerId, id, request);
        return CreatedAtAction(nameof(GetReviews), new { id }, review);
    }

    // GET /api/users/{id}/reviews
    [HttpGet("{id:guid}/reviews")]
    public async Task<ActionResult<List<ReviewDto>>> GetReviews(Guid id)
    {
        var reviews = await _reviewService.GetReviewsAsync(id);
        return Ok(reviews);
    }
}
