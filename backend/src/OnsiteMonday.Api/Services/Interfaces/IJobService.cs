using OnsiteMonday.Api.DTOs.Jobs;

namespace OnsiteMonday.Api.Services;

public interface IJobService
{
    Task<List<JobDto>> GetJobsAsync(Guid currentUserId, string? trade, string? location, string? status, int page, int pageSize);
    Task<JobDto> GetByIdAsync(Guid id, Guid currentUserId);
    Task<JobDto> CreateJobAsync(Guid posterId, CreateJobRequest request);
    Task<List<JobDto>> GetMyPostedJobsAsync(Guid userId);
    Task<List<JobDto>> GetMyAcceptedJobsAsync(Guid userId);
    Task<JobDto> ToggleInterestAsync(Guid jobId, Guid userId);
    Task<JobDto> AcceptApplicantAsync(Guid jobId, Guid posterId, Guid applicantId);
    Task<JobDto> CompleteJobAsync(Guid jobId, Guid userId);
}
