namespace OnsiteMonday.Api.Domain;

public class JobApplication
{
    public Guid Id { get; set; }
    public Guid JobId { get; set; }
    public Job Job { get; set; } = null!;
    public Guid ApplicantId { get; set; }
    public User Applicant { get; set; } = null!;
    public string Status { get; set; } = "interested"; // interested | accepted | rejected
    public DateTimeOffset AppliedAt { get; set; }
    public DateTimeOffset? AcceptedAt { get; set; }
}
