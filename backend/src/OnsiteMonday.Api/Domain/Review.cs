namespace OnsiteMonday.Api.Domain;

public class Review
{
    public Guid Id { get; set; }
    public Guid RevieweeId { get; set; }   // tradesperson being reviewed
    public User Reviewee { get; set; } = null!;
    public Guid ReviewerId { get; set; }   // job poster writing the review
    public User Reviewer { get; set; } = null!;
    public Guid JobId { get; set; }
    public Job Job { get; set; } = null!;
    public int Rating { get; set; }        // 1–5
    public string? Text { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
