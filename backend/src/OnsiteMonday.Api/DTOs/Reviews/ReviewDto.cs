namespace OnsiteMonday.Api.DTOs.Reviews;

public class ReviewDto
{
    public Guid Id { get; set; }
    public Guid RevieweeId { get; set; }
    public Guid ReviewerId { get; set; }
    public string ReviewerName { get; set; } = null!;
    public string? ReviewerBusiness { get; set; }
    public Guid JobId { get; set; }
    public int Rating { get; set; }
    public string? Text { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
