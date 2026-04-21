using AutoMapper;
using Hangfire;
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.DTOs.Jobs;
using OnsiteMonday.Api.Jobs;
using OnsiteMonday.Api.Repositories;
using OnsiteMonday.Api.Stubs;

namespace OnsiteMonday.Api.Services;

public class JobService : IJobService
{
    private readonly IJobRepository _jobRepo;
    private readonly IUserRepository _userRepo;
    private readonly INotificationRepository _notificationRepo;
    private readonly IMangopayService _mangopay;
    private readonly IBackgroundJobClient _backgroundJobs;
    private readonly IMapper _mapper;

    public JobService(
        IJobRepository jobRepo,
        IUserRepository userRepo,
        INotificationRepository notificationRepo,
        IMangopayService mangopay,
        IBackgroundJobClient backgroundJobs,
        IMapper mapper)
    {
        _jobRepo = jobRepo;
        _userRepo = userRepo;
        _notificationRepo = notificationRepo;
        _mangopay = mangopay;
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

    public async Task<JobDto> ToggleInterestAsync(Guid jobId, Guid userId)
    {
        var result = await _jobRepo.GetByIdAsync(jobId, userId)
            ?? throw new KeyNotFoundException($"Job {jobId} not found.");

        var existing = await _jobRepo.GetApplicationAsync(jobId, userId);

        if (existing != null)
        {
            await _jobRepo.RemoveApplicationAsync(existing);
        }
        else
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

        var newCount = await _jobRepo.GetApplicationCountAsync(jobId);
        return ToDto(result.Job, existing == null, newCount);
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

        // Ensure the poster has a Mangopay user and wallet
        var poster = await _userRepo.GetByIdAsync(userId)
            ?? throw new KeyNotFoundException("Poster user not found.");

        if (string.IsNullOrEmpty(poster.MangopayUserId))
        {
            poster.MangopayUserId = await _mangopay.EnsureUserAsync(poster.Id, poster.Email, poster.FirstName, poster.LastName);
            poster.MangopayWalletId = await _mangopay.EnsureWalletAsync(poster.MangopayUserId, $"Wallet for {poster.Email}");
            await _userRepo.UpdateAsync(poster);
        }

        var escrowAmount = job.DayRate * job.Duration;
        var returnUrl = $"https://app.onsitemonday.co.uk/jobs/{jobId}/payment-return";

        var (payInId, redirectUrl) = await _mangopay.CreateWebPayInAsync(jobId, poster.MangopayUserId, escrowAmount, returnUrl);

        job.Status = "in_progress";
        job.EscrowPayInId = payInId;
        job.PaymentStatus = "payin_pending";
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
                Type = "payment",
                Title = "Payment in progress",
                Description = $"The job poster is completing payment of £{escrowAmount:0.00} for \"{job.Title}\". It will be held securely until the job is complete.",
                LinkedId = jobId,
                CreatedAt = DateTimeOffset.UtcNow,
            });
        }

        var count = await _jobRepo.GetApplicationCountAsync(jobId);
        return new JobStartResponse
        {
            Job = ToDto(job, result.IsInterested, count),
            PayInRedirectUrl = redirectUrl,
        };
    }

    public async Task<JobDto> CompleteJobAsync(Guid jobId, Guid userId)
    {
        var result = await _jobRepo.GetByIdAsync(jobId, userId)
            ?? throw new KeyNotFoundException($"Job {jobId} not found.");

        var job = result.Job;

        if (job.PostedById != userId)
            throw new UnauthorizedAccessException("Only the job poster can mark a job as complete.");

        if (job.Status != "accepted" && job.Status != "in_progress")
            throw new ArgumentException("Job must be accepted or in progress to be marked complete.");

        // Find the accepted tradesperson to determine their payout delay
        var applicants = await _jobRepo.GetApplicantsAsync(jobId);
        var acceptedEntry = applicants.FirstOrDefault(a => a.Application.Status == "accepted");

        // Ensure tradesperson has a Mangopay wallet for the eventual payout
        if (acceptedEntry != default)
        {
            var tradesperson = acceptedEntry.Applicant;
            if (string.IsNullOrEmpty(tradesperson.MangopayUserId))
            {
                tradesperson.MangopayUserId = await _mangopay.EnsureUserAsync(tradesperson.Id, tradesperson.Email, tradesperson.FirstName, tradesperson.LastName);
                tradesperson.MangopayWalletId = await _mangopay.EnsureWalletAsync(tradesperson.MangopayUserId, $"Wallet for {tradesperson.Email}");
                await _userRepo.UpdateAsync(tradesperson);
            }
        }

        // Look up payout delay from the tradesperson's active subscription (fixes hardcoded 30-day bug)
        var tradespersonUser = acceptedEntry.Applicant; // null if no accepted applicant found
        var payoutDays = tradespersonUser?.ActiveSubscription?.PayoutDays ?? 30;

        var amount = job.DayRate * job.Duration;
        var scheduleAt = DateTimeOffset.UtcNow.AddDays(payoutDays);

        var hangfireJobId = _backgroundJobs.Schedule<IPayoutReleaseJob>(
            j => j.ExecuteAsync(jobId),
            scheduleAt);

        job.Status = "completed";
        job.PaymentStatus = "payout_pending";
        job.PayoutScheduledAt = scheduleAt;
        job.HangfireJobId = hangfireJobId;
        job.UpdatedAt = DateTimeOffset.UtcNow;
        await _jobRepo.UpdateAsync(job);

        if (acceptedEntry != default)
        {
            await _notificationRepo.CreateAsync(new Notification
            {
                Id = Guid.NewGuid(),
                UserId = acceptedEntry.Applicant.Id,
                Type = "payment",
                Title = "Payment scheduled",
                Description = $"The job \"{job.Title}\" is complete. Your payment of £{amount:0.00} will be released in {payoutDays} days.",
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
