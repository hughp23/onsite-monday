using AutoMapper;
using Hangfire;
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.DTOs.Jobs;
using OnsiteMonday.Api.Jobs;
using OnsiteMonday.Api.Repositories;
using OnsiteMonday.Api.Services.Interfaces;

namespace OnsiteMonday.Api.Services;

public class JobService : IJobService
{
    private readonly IJobRepository _jobRepo;
    private readonly IUserRepository _userRepo;
    private readonly INotificationRepository _notificationRepo;
    private readonly IStripeConnectService _stripeConnect;
    private readonly IBackgroundJobClient _backgroundJobs;
    private readonly IMapper _mapper;

    public JobService(
        IJobRepository jobRepo,
        IUserRepository userRepo,
        INotificationRepository notificationRepo,
        IStripeConnectService stripeConnect,
        IBackgroundJobClient backgroundJobs,
        IMapper mapper)
    {
        _jobRepo = jobRepo;
        _userRepo = userRepo;
        _notificationRepo = notificationRepo;
        _stripeConnect = stripeConnect;
        _backgroundJobs = backgroundJobs;
        _mapper = mapper;
    }

    public async Task<List<JobDto>> GetJobsAsync(Guid currentUserId, string? trade, string? location, string? status, int page, int pageSize)
    {
        var (jobs, isInterested, counts) = await _jobRepo.GetJobsAsync(currentUserId, trade, location, status, page, pageSize);
        return jobs.Select(j => ToDto(j, isInterested.GetValueOrDefault(j.Id), counts.GetValueOrDefault(j.Id))).ToList();
    }

    public async Task<JobDto> GetByIdAsync(Guid id, Guid currentUserId)
    {
        var result = await _jobRepo.GetByIdAsync(id, currentUserId)
            ?? throw new KeyNotFoundException($"Job {id} not found.");
        return ToDto(result.Job, result.IsInterested, result.InterestedCount);
    }

    public async Task<JobDto> CreateJobAsync(Guid posterId, CreateJobRequest request)
    {
        if (await _jobRepo.HasOutstandingPosterReviewAsync(posterId))
            throw new InvalidOperationException("You have outstanding reviews to complete before posting new jobs.");

        var poster = await _userRepo.GetByIdAsync(posterId)
            ?? throw new KeyNotFoundException("Poster user not found.");

        var job = new Job
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            Trade = request.Trade,
            Location = request.Location,
            Postcode = request.Postcode,
            Duration = request.Duration,
            Days = request.Days,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            DayRate = request.DayRate,
            Description = request.Description,
            PostedById = posterId,
            PaymentTerms = request.PaymentTerms,
            Photos = request.Photos,
            Status = "open",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };

        await _jobRepo.CreateAsync(job);
        job.PostedBy = poster;
        return ToDto(job, false, 0);
    }

    public async Task<List<JobDto>> GetMyPostedJobsAsync(Guid userId)
    {
        var jobs = await _jobRepo.GetPostedByUserAsync(userId);
        return jobs.Select(j => ToDto(j, false, j.Applications.Count)).ToList();
    }

    public async Task<List<JobDto>> GetMyAcceptedJobsAsync(Guid userId)
    {
        var jobs = await _jobRepo.GetAcceptedByUserAsync(userId);
        return jobs.Select(j => ToDto(j, true, j.Applications.Count)).ToList();
    }

    public async Task<List<JobDto>> GetMyLikedJobsAsync(Guid userId)
    {
        var jobs = await _jobRepo.GetLikedByUserAsync(userId);
        return jobs.Select(j => ToDto(j, true, j.Applications.Count)).ToList();
    }

    public async Task<List<JobDto>> GetMyAppliedJobsAsync(Guid userId)
    {
        var jobs = await _jobRepo.GetAppliedByUserAsync(userId);
        return jobs.Select(j => ToDto(j, true, j.Applications.Count)).ToList();
    }

    public async Task<JobDto> ToggleInterestAsync(Guid jobId, Guid userId)
    {
        var result = await _jobRepo.GetByIdAsync(jobId, userId)
            ?? throw new KeyNotFoundException($"Job {jobId} not found.");

        if (result.Job.PostedById == userId)
            throw new InvalidOperationException("You cannot like your own job.");

        var existing = await _jobRepo.GetApplicationAsync(jobId, userId);

        if (existing != null && existing.Status == "interested")
        {
            // Un-like: only remove if still in the interested state
            await _jobRepo.RemoveApplicationAsync(existing);
        }
        else if (existing == null)
        {
            await _jobRepo.AddApplicationAsync(new JobApplication
            {
                Id = Guid.NewGuid(),
                JobId = jobId,
                ApplicantId = userId,
                Status = "interested",
                AppliedAt = DateTimeOffset.UtcNow,
            });

            var applicant = await _userRepo.GetByIdAsync(userId);
            if (applicant != null)
            {
                await _notificationRepo.CreateAsync(new Notification
                {
                    Id = Guid.NewGuid(),
                    UserId = result.Job.PostedById,
                    Type = "application",
                    Title = "New applicant interested",
                    Description = $"{applicant.FirstName} {applicant.LastName} is interested in \"{result.Job.Title}\".",
                    LinkedId = jobId,
                    CreatedAt = DateTimeOffset.UtcNow,
                });
            }
        }
        // If existing.Status is "applied" or "accepted", toggling interest is a no-op

        var newCount = await _jobRepo.GetApplicationCountAsync(jobId);
        var nowInterested = existing == null || existing.Status != "interested";
        return ToDto(result.Job, nowInterested, newCount);
    }

    public async Task<JobDto> ApplyToJobAsync(Guid jobId, Guid userId)
    {
        if (await _jobRepo.HasOutstandingTradesPersonReviewAsync(userId))
            throw new InvalidOperationException("You have outstanding reviews to complete before applying for new jobs.");

        var result = await _jobRepo.GetByIdAsync(jobId, userId)
            ?? throw new KeyNotFoundException($"Job {jobId} not found.");

        if (result.Job.PostedById == userId)
            throw new InvalidOperationException("You cannot apply to your own job.");

        if (result.Job.Status != "open")
            throw new InvalidOperationException("This job is no longer accepting applications.");

        var existing = await _jobRepo.GetApplicationAsync(jobId, userId);

        if (existing == null)
        {
            await _jobRepo.AddApplicationAsync(new JobApplication
            {
                Id = Guid.NewGuid(),
                JobId = jobId,
                ApplicantId = userId,
                Status = "applied",
                AppliedAt = DateTimeOffset.UtcNow,
            });
        }
        else if (existing.Status == "interested")
        {
            existing.Status = "applied";
            await _jobRepo.UpdateApplicationAsync(existing);
        }
        // Already applied or accepted — idempotent, do nothing

        if (existing == null || existing.Status == "interested")
        {
            var applicant = await _userRepo.GetByIdAsync(userId);
            if (applicant != null)
            {
                await _notificationRepo.CreateAsync(new Notification
                {
                    Id = Guid.NewGuid(),
                    UserId = result.Job.PostedById,
                    Type = "application",
                    Title = "New application received",
                    Description = $"{applicant.FirstName} {applicant.LastName} has applied for \"{result.Job.Title}\".",
                    LinkedId = jobId,
                    CreatedAt = DateTimeOffset.UtcNow,
                });
            }
        }

        var newCount = await _jobRepo.GetApplicationCountAsync(jobId);
        return ToDto(result.Job, true, newCount);
    }

    public async Task<List<ApplicantDto>> GetApplicantsAsync(Guid jobId, Guid requesterId)
    {
        var result = await _jobRepo.GetByIdAsync(jobId, requesterId)
            ?? throw new KeyNotFoundException($"Job {jobId} not found.");

        if (result.Job.PostedById != requesterId)
            throw new UnauthorizedAccessException("Only the job poster can view applicants.");

        var applicants = await _jobRepo.GetApplicantsAsync(jobId);

        return applicants.Select(a => new ApplicantDto
        {
            Id = a.Applicant.Id,
            FirstName = a.Applicant.FirstName,
            LastName = a.Applicant.LastName,
            Trade = a.Applicant.Trade,
            ProfileImageUrl = a.Applicant.ProfileImageUrl,
            DayRate = a.Applicant.DayRate,
            Rating = a.Applicant.Rating,
            ReviewCount = a.Applicant.ReviewCount,
            Skills = a.Applicant.Skills,
            ApplicationStatus = a.Application.Status,
            AppliedAt = a.Application.AppliedAt,
        }).ToList();
    }

    public async Task<JobDto> AcceptApplicantAsync(Guid jobId, Guid posterId, Guid applicantId)
    {
        var result = await _jobRepo.GetByIdAsync(jobId, posterId)
            ?? throw new KeyNotFoundException($"Job {jobId} not found.");

        if (result.Job.PostedById != posterId)
            throw new UnauthorizedAccessException("Only the job poster can accept applicants.");

        var application = await _jobRepo.GetApplicationAsync(jobId, applicantId)
            ?? throw new KeyNotFoundException("Application not found.");

        application.Status = "accepted";
        application.AcceptedAt = DateTimeOffset.UtcNow;

        result.Job.Status = "accepted";
        await _jobRepo.UpdateAsync(result.Job);

        await _notificationRepo.CreateAsync(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = applicantId,
            Type = "accepted",
            Title = "You've been accepted!",
            Description = $"You've been accepted for \"{result.Job.Title}\". The job starts on {result.Job.StartDate:d MMM yyyy}.",
            LinkedId = jobId,
            CreatedAt = DateTimeOffset.UtcNow,
        });

        var count = await _jobRepo.GetApplicationCountAsync(jobId);
        return ToDto(result.Job, result.IsInterested, count);
    }

    public async Task<JobStartResponse> StartJobAsync(Guid jobId, Guid userId)
    {
        var result = await _jobRepo.GetByIdAsync(jobId, userId)
            ?? throw new KeyNotFoundException($"Job {jobId} not found.");
        var job = result.Job;

        if (job.PostedById != userId)
            throw new UnauthorizedAccessException("Only the job poster can start a job.");
        if (job.Status != "accepted")
            throw new ArgumentException("Job must be accepted before it can be started.");

        var totalPence = ToMinorUnits(job.DayRate * job.Duration);
        var successUrl = $"https://app.onsitemonday.co.uk/jobs/{jobId}/payment-success";
        var cancelUrl = $"https://app.onsitemonday.co.uk/jobs/{jobId}/payment-cancel";

        var (sessionId, checkoutUrl) = await _stripeConnect.CreateJobCheckoutSessionAsync(
            jobId, job.Title, totalPence, successUrl, cancelUrl);

        job.StripeCheckoutSessionId = sessionId;
        job.PaymentStatus = "payin_pending";
        job.Status = "in_progress";
        job.UpdatedAt = DateTimeOffset.UtcNow;
        await _jobRepo.UpdateAsync(job);

        var applicants = await _jobRepo.GetApplicantsAsync(jobId);
        var acceptedApplicant = applicants.FirstOrDefault(a => a.Application.Status == "accepted");
        if (acceptedApplicant != default)
        {
            await _notificationRepo.CreateAsync(new Notification
            {
                Id = Guid.NewGuid(),
                UserId = acceptedApplicant.Applicant.Id,
                Type = "accepted",
                Title = "Job started — payment secured",
                Description = $"\"{job.Title}\" has started. Your payment is held securely and will be released once the job is complete and reviewed.",
                LinkedId = jobId,
                CreatedAt = DateTimeOffset.UtcNow,
            });
        }

        var count = await _jobRepo.GetApplicationCountAsync(jobId);
        return new JobStartResponse
        {
            Job = ToDto(job, result.IsInterested, count),
            CheckoutUrl = checkoutUrl,
        };
    }

    private static long ToMinorUnits(decimal amount) =>
        (long)Math.Round(amount * 100, MidpointRounding.AwayFromZero);

    public async Task<JobDto> CompleteJobAsync(Guid jobId, Guid userId)
    {
        var result = await _jobRepo.GetByIdAsync(jobId, userId)
            ?? throw new KeyNotFoundException($"Job {jobId} not found.");
        var job = result.Job;

        if (job.PostedById != userId)
            throw new UnauthorizedAccessException("Only the job poster can mark a job as complete.");
        if (job.Status != "accepted" && job.Status != "in_progress")
            throw new ArgumentException("Job must be accepted or in progress to be marked complete.");

        job.Status = "completed";
        job.UpdatedAt = DateTimeOffset.UtcNow;
        await _jobRepo.UpdateAsync(job);

        var amount = job.DayRate * job.Duration;
        var applicants = await _jobRepo.GetApplicantsAsync(jobId);
        var acceptedEntry = applicants.FirstOrDefault(a => a.Application.Status == "accepted");

        if (acceptedEntry != default)
        {
            await _notificationRepo.CreateAsync(new Notification
            {
                Id = Guid.NewGuid(),
                UserId = acceptedEntry.Applicant.Id,
                Type = "payment",
                Title = "Job complete — payment pending review",
                Description = $"The job \"{job.Title}\" is complete. Your payment of £{amount:0.00} will be released once the poster submits their review.",
                LinkedId = jobId,
                CreatedAt = DateTimeOffset.UtcNow,
            });
        }

        await _notificationRepo.CreateAsync(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = job.PostedById,
            Type = "review_required",
            Title = "Submit your review to release payment",
            Description = $"You've marked \"{job.Title}\" as complete. Please submit your review of the tradesperson to release their payment.",
            LinkedId = jobId,
            CreatedAt = DateTimeOffset.UtcNow,
        });

        var count = await _jobRepo.GetApplicationCountAsync(jobId);
        return ToDto(job, result.IsInterested, count);
    }

    public async Task DeleteJobAsync(Guid jobId, Guid userId)
    {
        var result = await _jobRepo.GetByIdAsync(jobId, userId)
            ?? throw new KeyNotFoundException($"Job {jobId} not found.");

        if (result.Job.PostedById != userId)
            throw new UnauthorizedAccessException("Only the job poster can delete a job.");

        if (result.Job.Status != "open")
            throw new InvalidOperationException("Only open jobs (with no hire) can be deleted.");

        await _jobRepo.DeleteAsync(result.Job);
    }

    public async Task<JobDto> CancelJobAsync(Guid jobId, Guid userId, string? reason)
    {
        var result = await _jobRepo.GetByIdAsync(jobId, userId)
            ?? throw new KeyNotFoundException($"Job {jobId} not found.");

        var job = result.Job;

        if (job.Status != "accepted")
            throw new InvalidOperationException("Only accepted jobs can be cancelled.");

        // Check caller is poster or accepted tradesperson
        var applicants = await _jobRepo.GetApplicantsAsync(jobId);
        var acceptedEntry = applicants.FirstOrDefault(a => a.Application.Status == "accepted");
        Guid? acceptedTradespersonId = acceptedEntry != default ? acceptedEntry.Applicant.Id : null;

        if (job.PostedById != userId && acceptedTradespersonId != userId)
            throw new UnauthorizedAccessException("Only the job poster or the hired tradesperson can cancel this job.");

        // Payment refund is handled manually for now; set status so ops can identify affected jobs
        if (job.PaymentStatus == "escrowed")
            job.PaymentStatus = "refund_pending";

        job.Status = "cancelled";
        job.CancellationReason = reason;
        job.CancelledAt = DateTimeOffset.UtcNow;
        job.UpdatedAt = DateTimeOffset.UtcNow;
        await _jobRepo.UpdateAsync(job);

        // Notify the other party
        var otherPartyId = job.PostedById == userId ? acceptedTradespersonId : (Guid?)job.PostedById;
        if (otherPartyId.HasValue)
        {
            await _notificationRepo.CreateAsync(new Notification
            {
                Id = Guid.NewGuid(),
                UserId = otherPartyId.Value,
                Type = "cancelled",
                Title = "Job cancelled",
                Description = $"The job \"{job.Title}\" has been cancelled.",
                LinkedId = jobId,
                CreatedAt = DateTimeOffset.UtcNow,
            });
        }

        var count = await _jobRepo.GetApplicationCountAsync(jobId);
        return ToDto(job, result.IsInterested, count);
    }

    private static JobDto ToDto(Job job, bool isInterested, int interestedCount) => new()
    {
        Id = job.Id,
        Title = job.Title,
        Trade = job.Trade,
        Location = job.Location,
        Postcode = job.Postcode,
        Duration = job.Duration,
        Days = job.Days,
        StartDate = job.StartDate,
        EndDate = job.EndDate,
        StartTime = job.StartTime,
        EndTime = job.EndTime,
        DayRate = job.DayRate,
        Description = job.Description,
        PostedById = job.PostedById,
        PostedByName = job.PostedBy != null
            ? $"{job.PostedBy.FirstName} {job.PostedBy.LastName}".Trim()
            : string.Empty,
        PostedByBusiness = job.PostedBy?.BusinessName,
        PaymentTerms = job.PaymentTerms,
        Status = job.Status,
        Photos = job.Photos,
        CreatedAt = job.CreatedAt,
        IsInterested = isInterested,
        InterestedCount = interestedCount,
        ApplicantCount = interestedCount,
    };
}
