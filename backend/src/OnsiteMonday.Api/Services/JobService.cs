using AutoMapper;
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.DTOs.Jobs;
using OnsiteMonday.Api.Repositories;

namespace OnsiteMonday.Api.Services;

public class JobService : IJobService
{
    private readonly IJobRepository _jobRepo;
    private readonly IUserRepository _userRepo;
    private readonly IMapper _mapper;

    public JobService(IJobRepository jobRepo, IUserRepository userRepo, IMapper mapper)
    {
        _jobRepo = jobRepo;
        _userRepo = userRepo;
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
        }

        var newCount = await _jobRepo.GetApplicationCountAsync(jobId);
        return ToDto(result.Job, existing == null, newCount);
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

        var count = await _jobRepo.GetApplicationCountAsync(jobId);
        return ToDto(result.Job, result.IsInterested, count);
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

        job.Status = "completed";
        await _jobRepo.UpdateAsync(job);

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
