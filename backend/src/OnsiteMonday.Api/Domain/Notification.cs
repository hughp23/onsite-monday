namespace OnsiteMonday.Api.Domain;

public class Notification
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string Type { get; set; } = null!; // application | accepted | payment | review | review_required | job_completion_pending | job_autocompleted | cancelled | job_invite
    public string Title { get; set; } = null!;
    public string Description { get; set; } = null!;
    public bool IsRead { get; set; } = false;
    public Guid? LinkedId { get; set; }        // optional link to a job or user
    public DateTimeOffset CreatedAt { get; set; }
}
