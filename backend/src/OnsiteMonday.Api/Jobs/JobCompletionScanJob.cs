using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.Repositories;

namespace OnsiteMonday.Api.Jobs;

public interface IJobCompletionScanJob
{
    Task ExecuteAsync();
}

public class JobCompletionScanJob : IJobCompletionScanJob
{
    private readonly IJobRepository _jobRepo;
    private readonly INotificationRepository _notificationRepo;
    private readonly ILogger<JobCompletionScanJob> _logger;

    public JobCompletionScanJob(
        IJobRepository jobRepo,
        INotificationRepository notificationRepo,
        ILogger<JobCompletionScanJob> logger)
    {
        _jobRepo = jobRepo;
        _notificationRepo = notificationRepo;
        _logger = logger;
    }

    public async Task ExecuteAsync()
    {
        var jobs = await _jobRepo.GetJobsForAutocompleteAsync();
        var now = DateTimeOffset.UtcNow;

        foreach (var job in jobs)
        {
            var endDateTime = new DateTimeOffset(job.EndDate.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            var acceptedApplicantId = job.Applications
                .FirstOrDefault(a => a.Status == "accepted")?.ApplicantId;

            // First pass: end date passed, notify both parties once
            if (job.CompletionNotifiedAt == null)
            {
                _logger.LogInformation("JobCompletionScan: notifying parties for job {JobId} ({Title})", job.Id, job.Title);

                await _notificationRepo.CreateAsync(new Notification
                {
                    Id = Guid.NewGuid(),
                    UserId = job.PostedById,
                    Type = "job_completion_pending",
                    Title = "Did your job complete?",
                    Description = $"\"{job.Title}\" has ended. Mark it complete and submit your review.",
                    LinkedId = job.Id,
                    CreatedAt = now,
                });

                if (acceptedApplicantId.HasValue)
                {
                    await _notificationRepo.CreateAsync(new Notification
                    {
                        Id = Guid.NewGuid(),
                        UserId = acceptedApplicantId.Value,
                        Type = "job_completion_pending",
                        Title = "Your job has ended",
                        Description = $"\"{job.Title}\" has ended. Please submit your review of the job poster.",
                        LinkedId = job.Id,
                        CreatedAt = now,
                    });
                }

                job.CompletionNotifiedAt = now;
                await _jobRepo.UpdateAsync(job);
            }
            // Second pass: 3 days past notification with no manual completion → autocomplete
            else if (job.CompletionNotifiedAt.Value.AddDays(3) < now)
            {
                _logger.LogInformation("JobCompletionScan: autocompleting job {JobId} ({Title})", job.Id, job.Title);

                job.Status = "completed";
                job.UpdatedAt = now;
                await _jobRepo.UpdateAsync(job);

                await _notificationRepo.CreateAsync(new Notification
                {
                    Id = Guid.NewGuid(),
                    UserId = job.PostedById,
                    Type = "job_autocompleted",
                    Title = "Job marked complete",
                    Description = $"\"{job.Title}\" was automatically marked complete. Submit your review to unlock full platform access.",
                    LinkedId = job.Id,
                    CreatedAt = now,
                });

                if (acceptedApplicantId.HasValue)
                {
                    await _notificationRepo.CreateAsync(new Notification
                    {
                        Id = Guid.NewGuid(),
                        UserId = acceptedApplicantId.Value,
                        Type = "job_autocompleted",
                        Title = "Job marked complete",
                        Description = $"\"{job.Title}\" was automatically marked complete. Submit your review to unlock full platform access.",
                        LinkedId = job.Id,
                        CreatedAt = now,
                    });
                }
            }
        }
    }
}
