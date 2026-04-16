using OnsiteMonday.Api.DTOs.Reviews;

namespace OnsiteMonday.Api.Services;

public interface IReviewService
{
    Task<ReviewDto> SubmitReviewAsync(Guid reviewerId, Guid revieweeId, SubmitReviewRequest request);
    Task<List<ReviewDto>> GetReviewsAsync(Guid revieweeId);
}
