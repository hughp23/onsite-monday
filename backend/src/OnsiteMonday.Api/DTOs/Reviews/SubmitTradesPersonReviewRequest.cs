namespace OnsiteMonday.Api.DTOs.Reviews;

public class SubmitTradesPersonReviewRequest
{
    public int Rating { get; set; }   // 1–5
    public string? Text { get; set; }
}
