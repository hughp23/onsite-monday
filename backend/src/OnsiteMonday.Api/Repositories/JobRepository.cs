using Microsoft.EntityFrameworkCore;
using OnsiteMonday.Api.Data;
using OnsiteMonday.Api.Domain;

namespace OnsiteMonday.Api.Repositories;

public class JobRepository : IJobRepository
{
    private readonly AppDbContext _db;

    public JobRepository(AppDbContext db) => _db = db;

    public async Task<(List<Job> Jobs, Dictionary<Guid, bool> IsInterested, Dictionary<Guid, int> InterestedCounts)>
        GetJobsAsync(Guid currentUserId, string? trade, string? location, string? status, int page, int pageSize)
    {
        var query = _db.Jobs.Include(j => j.PostedBy).AsQueryable();

        if (!string.IsNullOrWhiteSpace(trade))
            query = query.Where(j => j.Trade == trade);

        if (!string.IsNullOrWhiteSpace(location))
            query = query.Where(j => j.Location.ToLower().Contains(location.ToLower()));

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(j => j.Status == status);
        else
            query = query.Where(j => j.Status == "open");

        var jobs = await query
            .OrderByDescending(j => j.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var jobIds = jobs.Select(j => j.Id).ToList();

        var applications = await _db.JobApplications
            .Where(a => jobIds.Contains(a.JobId))
            .ToListAsync();

        var isInterested = applications
            .GroupBy(a => a.JobId)
            .ToDictionary(g => g.Key, g => g.Any(a => a.ApplicantId == currentUserId));

        var interestedCounts = applications
            .GroupBy(a => a.JobId)
            .ToDictionary(g => g.Key, g => g.Count());

        return (jobs, isInterested, interestedCounts);
    }

    public async Task<(Job Job, bool IsInterested, int InterestedCount)?>
        GetByIdAsync(Guid id, Guid currentUserId)
    {
        var job = await _db.Jobs.Include(j => j.PostedBy).FirstOrDefaultAsync(j => j.Id == id);
        if (job == null) return null;

        var applications = await _db.JobApplications.Where(a => a.JobId == id).ToListAsync();
        var isInterested = applications.Any(a => a.ApplicantId == currentUserId);
        var count = applications.Count;

        return (job, isInterested, count);
    }

    public Task<List<Job>> GetPostedByUserAsync(Guid userId) =>
        _db.Jobs.Include(j => j.PostedBy).Include(j => j.Applications)
            .Where(j => j.PostedById == userId)
            .OrderByDescending(j => j.CreatedAt)
            .ToListAsync();

    public async Task<List<Job>> GetAcceptedByUserAsync(Guid userId)
    {
        var acceptedJobIds = await _db.JobApplications
            .Where(a => a.ApplicantId == userId && a.Status == "accepted")
            .Select(a => a.JobId)
            .ToListAsync();

        return await _db.Jobs.Include(j => j.PostedBy).Include(j => j.Applications)
            .Where(j => acceptedJobIds.Contains(j.Id))
            .OrderByDescending(j => j.CreatedAt)
            .ToListAsync();
    }

    public async Task<Job> CreateAsync(Job job)
    {
        _db.Jobs.Add(job);
        await _db.SaveChangesAsync();
        return job;
    }

    public async Task UpdateAsync(Job job)
    {
        job.UpdatedAt = DateTimeOffset.UtcNow;
        _db.Jobs.Update(job);
        await _db.SaveChangesAsync();
    }

    public Task<JobApplication?> GetApplicationAsync(Guid jobId, Guid applicantId) =>
        _db.JobApplications.FirstOrDefaultAsync(a => a.JobId == jobId && a.ApplicantId == applicantId);

    public async Task AddApplicationAsync(JobApplication application)
    {
        _db.JobApplications.Add(application);
        await _db.SaveChangesAsync();
    }

    public async Task RemoveApplicationAsync(JobApplication application)
    {
        _db.JobApplications.Remove(application);
        await _db.SaveChangesAsync();
    }

    public Task<int> GetApplicationCountAsync(Guid jobId) =>
        _db.JobApplications.CountAsync(a => a.JobId == jobId);
}
