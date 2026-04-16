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

    Task<Job> CreateAsync(Job job);
    Task UpdateAsync(Job job);

    Task<JobApplication?> GetApplicationAsync(Guid jobId, Guid applicantId);
    Task AddApplicationAsync(JobApplication application);
    Task RemoveApplicationAsync(JobApplication application);
    Task<int> GetApplicationCountAsync(Guid jobId);
}
