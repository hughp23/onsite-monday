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
    Task<List<ApplicantDto>> GetApplicantsAsync(Guid jobId, Guid requesterId);
    Task<JobDto> AcceptApplicantAsync(Guid jobId, Guid posterId, Guid applicantId);
    Task<JobStartResponse> StartJobAsync(Guid jobId, Guid userId);
    Task<JobDto> CompleteJobAsync(Guid jobId, Guid userId);
    Task DeleteJobAsync(Guid jobId, Guid userId);
    Task<JobDto> CancelJobAsync(Guid jobId, Guid userId, string? reason);
}
