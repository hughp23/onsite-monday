using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OnsiteMonday.Api.DTOs.Jobs;
using OnsiteMonday.Api.Repositories;
using OnsiteMonday.Api.Services;
using System.Security.Claims;

namespace OnsiteMonday.Api.Controllers;

[ApiController]
[Route("api/jobs")]
[Authorize]
public class JobsController : ControllerBase
{
    private readonly IJobService _jobService;
    private readonly IUserRepository _userRepo;

    public JobsController(IJobService jobService, IUserRepository userRepo)
    {
        _jobService = jobService;
        _userRepo = userRepo;
    }

    private string FirebaseUid =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException("Missing user identifier.");

    private string Email =>
        User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;

    private async Task<Guid> GetCurrentUserIdAsync()
    {
        var user = await _userRepo.GetOrCreateByFirebaseUidAsync(FirebaseUid, Email);
        return user.Id;
    }

    // GET /api/jobs?trade=Builder&location=York&status=open&page=1&pageSize=20
    [HttpGet]
    public async Task<ActionResult<List<JobDto>>> GetJobs(
        [FromQuery] string? trade,
        [FromQuery] string? location,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userId = await GetCurrentUserIdAsync();
        var jobs = await _jobService.GetJobsAsync(userId, trade, location, status, page, pageSize);
        return Ok(jobs);
    }

    // POST /api/jobs
    [HttpPost]
    public async Task<ActionResult<JobDto>> CreateJob([FromBody] CreateJobRequest request)
    {
        var userId = await GetCurrentUserIdAsync();
        var job = await _jobService.CreateJobAsync(userId, request);
        return CreatedAtAction(nameof(GetById), new { id = job.Id }, job);
    }

    // GET /api/jobs/my/posted
    [HttpGet("my/posted")]
    public async Task<ActionResult<List<JobDto>>> GetMyPostedJobs()
    {
        var userId = await GetCurrentUserIdAsync();
        var jobs = await _jobService.GetMyPostedJobsAsync(userId);
        return Ok(jobs);
    }

    // GET /api/jobs/my/accepted
    [HttpGet("my/accepted")]
    public async Task<ActionResult<List<JobDto>>> GetMyAcceptedJobs()
    {
        var userId = await GetCurrentUserIdAsync();
        var jobs = await _jobService.GetMyAcceptedJobsAsync(userId);
        return Ok(jobs);
    }

    // GET /api/jobs/{id}
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<JobDto>> GetById(Guid id)
    {
        var userId = await GetCurrentUserIdAsync();
        var job = await _jobService.GetByIdAsync(id, userId);
        return Ok(job);
    }

    // POST /api/jobs/{id}/interest
    [HttpPost("{id:guid}/interest")]
    public async Task<ActionResult<JobDto>> ToggleInterest(Guid id)
    {
        var userId = await GetCurrentUserIdAsync();
        var job = await _jobService.ToggleInterestAsync(id, userId);
        return Ok(job);
    }

    // PUT /api/jobs/{id}/accept
    [HttpPut("{id:guid}/accept")]
    public async Task<ActionResult<JobDto>> AcceptApplicant(Guid id, [FromBody] AcceptJobRequest request)
    {
        var userId = await GetCurrentUserIdAsync();
        var job = await _jobService.AcceptApplicantAsync(id, userId, request.ApplicantId);
        return Ok(job);
    }

    // PUT /api/jobs/{id}/complete
    [HttpPut("{id:guid}/complete")]
    public async Task<ActionResult<JobDto>> CompleteJob(Guid id)
    {
        var userId = await GetCurrentUserIdAsync();
        var job = await _jobService.CompleteJobAsync(id, userId);
        return Ok(job);
    }
}
