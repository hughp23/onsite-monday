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

    public async Task<ReviewDto> SubmitReviewAsync(Guid reviewerId, Guid jobId, SubmitReviewRequest request)
    {
        var job = await _jobRepo.GetByIdRawAsync(jobId)
            ?? throw new KeyNotFoundException($"Job {jobId} not found.");

        if (job.PostedById != reviewerId)
            throw new UnauthorizedAccessException("Only the job poster can review the tradesperson for this job.");

        if (job.Status != "completed")
            throw new InvalidOperationException("Reviews can only be submitted for completed jobs.");

        // The reviewee is always the hired applicant, never a client-supplied id,
        // because this review gates the payout release.
        var acceptedApp = (await _jobRepo.GetApplicantsAsync(jobId))
            .FirstOrDefault(a => a.Application.Status == "accepted");

        if (acceptedApp == default)
            throw new InvalidOperationException("This job has no accepted tradesperson to review.");

        var revieweeId = acceptedApp.Applicant.Id;

        if (await _reviewRepo.ExistsForJobAsync(jobId))
            throw new ArgumentException("A review already exists for this job.");

        var reviewee = await _userRepo.GetByIdAsync(revieweeId)
            ?? throw new KeyNotFoundException($"User {revieweeId} not found.");

        var reviewer = await _userRepo.GetByIdAsync(reviewerId)
            ?? throw new KeyNotFoundException("Reviewer not found.");

        var review = new Review
        {
            Id = Guid.NewGuid(),
            RevieweeId = revieweeId,
            ReviewerId = reviewerId,
            JobId = jobId,
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
        var payoutScheduledAt = await MaybeSchedulePayoutAsync(reviewee, job);

        var dto = ToDto(review, reviewer);
        dto.PayoutScheduledAt = payoutScheduledAt;
        return dto;
    }

    private async Task<DateTimeOffset?> MaybeSchedulePayoutAsync(User tradesperson, Job job)
    {
        var jobId = job.Id;
        if (job.Status != "completed") return null;
        if (job.PaymentStatus != "escrowed") return null;

        var payoutDays = tradesperson.ActiveSubscription?.PayoutDays ?? 30;
        var scheduleAt = DateTimeOffset.UtcNow.AddDays(payoutDays);

        var hangfireJobId = _backgroundJobs.Schedule<IPayoutReleaseJob>(
            j => j.ExecuteAsync(jobId),
            scheduleAt);

        job.PaymentStatus = "payout_pending";
        job.PayoutScheduledAt = scheduleAt;
        job.HangfireJobId = hangfireJobId;

        await _jobRepo.UpdateAsync(job);
        return scheduleAt;
    }

    public async Task<List<ReviewDto>> GetReviewsAsync(Guid revieweeId)
    {
        var reviews = await _reviewRepo.GetByRevieweeIdAsync(revieweeId);
        return reviews.Select(r => ToDto(r, r.Reviewer)).ToList();
    }

    public async Task SubmitTradesPersonReviewAsync(Guid tradespersonId, Guid jobId, SubmitTradesPersonReviewRequest request)
    {
        var job = await _jobRepo.GetByIdRawAsync(jobId)
            ?? throw new KeyNotFoundException($"Job {jobId} not found.");

        if (job.Status != "completed")
            throw new InvalidOperationException("Reviews can only be submitted for completed jobs.");

        var acceptedApp = (await _jobRepo.GetApplicantsAsync(jobId))
            .FirstOrDefault(a => a.Application.Status == "accepted" && a.Applicant.Id == tradespersonId);

        if (acceptedApp == default)
            throw new UnauthorizedAccessException("Only the accepted tradesperson can submit this review.");

        if (await _reviewRepo.TradesPersonReviewExistsForJobAsync(jobId))
            throw new ArgumentException("A tradesperson review already exists for this job.");

        var tradesperson = await _userRepo.GetByIdAsync(tradespersonId)
            ?? throw new KeyNotFoundException("Tradesperson not found.");

        var review = new TradesPersonReview
        {
            Id = Guid.NewGuid(),
            ReviewerId = tradespersonId,
            RevieweeId = job.PostedById,
            JobId = jobId,
            Rating = request.Rating,
            Text = request.Text,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        await _reviewRepo.CreateTradesPersonReviewAsync(review);

        await _notificationRepo.CreateAsync(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = job.PostedById,
            Type = "review",
            Title = "New review received",
            Description = $"{tradesperson.FirstName} {tradesperson.LastName} left you a {request.Rating}-star review.",
            LinkedId = jobId,
            CreatedAt = DateTimeOffset.UtcNow,
        });
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
