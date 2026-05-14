using Hangfire;
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.DTOs.Reviews;
using OnsiteMonday.Api.Jobs;
using OnsiteMonday.Api.Repositories;

namespace OnsiteMonday.Api.Services;

public class ReviewService : IReviewService
{
    private readonly IReviewRepository _reviewRepo;
    private readonly IUserRepository _userRepo;
    private readonly INotificationRepository _notificationRepo;
    private readonly IJobRepository _jobRepo;
    private readonly IBackgroundJobClient _backgroundJobs;

    public ReviewService(
        IReviewRepository reviewRepo,
        IUserRepository userRepo,
        INotificationRepository notificationRepo,
        IJobRepository jobRepo,
        IBackgroundJobClient backgroundJobs)
    {
        _reviewRepo = reviewRepo;
        _userRepo = userRepo;
        _notificationRepo = notificationRepo;
        _jobRepo = jobRepo;
        _backgroundJobs = backgroundJobs;
    }

    public async Task<ReviewDto> SubmitReviewAsync(Guid reviewerId, Guid revieweeId, SubmitReviewRequest request)
    {
        var reviewee = await _userRepo.GetByIdAsync(revieweeId)
            ?? throw new KeyNotFoundException($"User {revieweeId} not found.");

        var reviewer = await _userRepo.GetByIdAsync(reviewerId)
            ?? throw new KeyNotFoundException("Reviewer not found.");

        if (await _reviewRepo.ExistsForJobAsync(request.JobId))
            throw new ArgumentException("A review already exists for this job.");

        var review = new Review
        {
            Id = Guid.NewGuid(),
            RevieweeId = revieweeId,
            ReviewerId = reviewerId,
            JobId = request.JobId,
            Rating = request.Rating,
            Text = request.Text,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        await _reviewRepo.CreateAsync(review);

        // Recalculate rating from all reviews
        reviewee.Rating = await _reviewRepo.GetAverageRatingAsync(revieweeId);
        reviewee.ReviewCount = await _reviewRepo.GetReviewCountAsync(revieweeId);
        await _userRepo.UpdateAsync(reviewee);

        // Notify the reviewee
        await _notificationRepo.CreateAsync(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = revieweeId,
            Type = "review",
            Title = "New review received",
            Description = $"{reviewer.FirstName} {reviewer.LastName} left you a {request.Rating}-star review.",
            LinkedId = review.Id,
            CreatedAt = DateTimeOffset.UtcNow,
        });

        // Gate payout on review: schedule Hangfire job if job is completed+escrowed
        await MaybeSchedulePayoutAsync(reviewee, request.JobId);

        return ToDto(review, reviewer);
    }

    private async Task MaybeSchedulePayoutAsync(User tradesperson, Guid jobId)
    {
        var job = await _jobRepo.GetByIdRawAsync(jobId);
        if (job is null) return;
        if (job.Status != "completed") return;
        if (job.PaymentStatus != "escrowed") return;

        var payoutDays = tradesperson.ActiveSubscription?.PayoutDays ?? 30;
        var scheduleAt = DateTimeOffset.UtcNow.AddDays(payoutDays);

        var hangfireJobId = _backgroundJobs.Schedule<IPayoutReleaseJob>(
            j => j.ExecuteAsync(jobId),
            scheduleAt);

        job.PaymentStatus = "payout_pending";
        job.PayoutScheduledAt = scheduleAt;
        job.HangfireJobId = hangfireJobId;

        await _jobRepo.UpdateAsync(job);
    }

    public async Task<List<ReviewDto>> GetReviewsAsync(Guid revieweeId)
    {
        var reviews = await _reviewRepo.GetByRevieweeIdAsync(revieweeId);
        return reviews.Select(r => ToDto(r, r.Reviewer)).ToList();
    }

    private static ReviewDto ToDto(Review review, Domain.User reviewer) => new()
    {
        Id = review.Id,
        RevieweeId = review.RevieweeId,
        ReviewerId = review.ReviewerId,
        ReviewerName = $"{reviewer.FirstName} {reviewer.LastName}".Trim(),
        ReviewerBusiness = reviewer.BusinessName,
        JobId = review.JobId,
        Rating = review.Rating,
        Text = review.Text,
        CreatedAt = review.CreatedAt,
    };
}
