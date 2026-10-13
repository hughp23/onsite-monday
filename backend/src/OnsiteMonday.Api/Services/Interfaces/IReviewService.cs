using OnsiteMonday.Api.DTOs.Reviews;

namespace OnsiteMonday.Api.Services;

public interface IReviewService
{
    Task<ReviewDto> SubmitReviewAsync(Guid reviewerId, Guid jobId, SubmitReviewRequest request);
    Task<List<ReviewDto>> GetReviewsAsync(Guid revieweeId);
    Task SubmitTradesPersonReviewAsync(Guid tradespersonId, Guid jobId, SubmitTradesPersonReviewRequest request);
}
