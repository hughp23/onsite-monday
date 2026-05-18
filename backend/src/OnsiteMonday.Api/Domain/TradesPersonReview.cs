namespace OnsiteMonday.Api.Domain;

public class TradesPersonReview
{
    public Guid Id { get; set; }
    public Guid ReviewerId { get; set; }   // tradesperson writing the review
    public User Reviewer { get; set; } = null!;
    public Guid RevieweeId { get; set; }   // job poster being reviewed
    public User Reviewee { get; set; } = null!;
    public Guid JobId { get; set; }
    public Job Job { get; set; } = null!;
    public int Rating { get; set; }        // 1–5
    public string? Text { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
