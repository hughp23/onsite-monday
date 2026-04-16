using Microsoft.EntityFrameworkCore;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Domain;

namespace OnsiteMonday.Api.Repositories;

public class ReviewRepository : IReviewRepository
{
    private readonly AppDbContext _db;

    public ReviewRepository(AppDbContext db) => _db = db;

    public Task<List<Review>> GetByRevieweeIdAsync(Guid revieweeId) =>
        _db.Reviews
            .Include(r => r.Reviewer)
            .Where(r => r.RevieweeId == revieweeId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

    public Task<bool> ExistsForJobAsync(Guid jobId) =>
        _db.Reviews.AnyAsync(r => r.JobId == jobId);

    public async Task<Review> CreateAsync(Review review)
    {
        _db.Reviews.Add(review);
        await _db.SaveChangesAsync();
        return review;
    }

    public async Task<decimal> GetAverageRatingAsync(Guid revieweeId)
    {
        var avg = await _db.Reviews
            .Where(r => r.RevieweeId == revieweeId)
            .AverageAsync(r => (double?)r.Rating);
        return (decimal)(avg ?? 0);
    }

    public Task<int> GetReviewCountAsync(Guid revieweeId) =>
        _db.Reviews.CountAsync(r => r.RevieweeId == revieweeId);
}
