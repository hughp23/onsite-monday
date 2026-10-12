using OnsiteMonday.Api.Domain;

namespace OnsiteMonday.Api.Repositories;

public interface IJobRepository
{
    Task<(List<Job> Jobs, Dictionary<Guid, bool> IsInterested, Dictionary<Guid, int> InterestedCounts)>
        GetJobsAsync(Guid currentUserId, string? trade, string? location, string? status, int page, int pageSize);

    Task<(Job Job, bool IsInterested, int InterestedCount)?>
        GetByIdAsync(Guid id, Guid currentUserId);

    Task<List<Job>> GetPostedByUserAsync(Guid userId);
    Task<List<Job>> GetAcceptedByUserAsync(Guid userId);
    Task<List<Job>> GetLikedByUserAsync(Guid userId);
    Task<List<Job>> GetAppliedByUserAsync(Guid userId);

    Task<Job> CreateAsync(Job job);
    Task UpdateAsync(Job job);
    Task DeleteAsync(Job job);

    Task<Job?> GetByIdRawAsync(Guid jobId);

    Task<JobApplication?> GetApplicationAsync(Guid jobId, Guid applicantId);
    Task AddApplicationAsync(JobApplication application);
    Task UpdateApplicationAsync(JobApplication application);
    Task RemoveApplicationAsync(JobApplication application);
    Task<int> GetApplicationCountAsync(Guid jobId);
    Task<List<(User Applicant, JobApplication Application)>> GetApplicantsAsync(Guid jobId);

    // Review block checks
    Task<bool> HasOutstandingPosterReviewAsync(Guid posterId);
    Task<bool> HasOutstandingTradesPersonReviewAsync(Guid tradespersonId);

    // Tier usage counts (calendar-month window supplied by caller)
    Task<int> CountJobsPostedSinceAsync(Guid posterId, DateTimeOffset since);
    Task<int> CountApplicationsSinceAsync(Guid applicantId, DateTimeOffset since);

    // Autocomplete scan: jobs past end date that are still active
    Task<List<Job>> GetJobsForAutocompleteAsync();
}
