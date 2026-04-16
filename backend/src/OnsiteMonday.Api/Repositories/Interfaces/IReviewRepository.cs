using OnsiteMonday.Api.Domain;

namespace OnsiteMonday.Api.Repositories;

public interface IReviewRepository
{
    Task<List<Review>> GetByRevieweeIdAsync(Guid revieweeId);
    Task<bool> ExistsForJobAsync(Guid jobId);
    Task<Review> CreateAsync(Review review);
    Task<decimal> GetAverageRatingAsync(Guid revieweeId);
    Task<int> GetReviewCountAsync(Guid revieweeId);
}
