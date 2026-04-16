namespace OnsiteMonday.Api.DTOs.Reviews;

public class SubmitReviewRequest
{
    public int Rating { get; set; }
    public string? Text { get; set; }
    public Guid JobId { get; set; }
}
