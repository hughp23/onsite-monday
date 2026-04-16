namespace OnsiteMonday.Api.DTOs.Jobs;

public class CreateJobRequest
{
    public string Title { get; set; } = null!;
    public string Trade { get; set; } = null!;
    public string Location { get; set; } = null!;
    public string Postcode { get; set; } = null!;
    public int Duration { get; set; }
    public List<string> Days { get; set; } = new();
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string StartTime { get; set; } = null!;
    public string EndTime { get; set; } = null!;
    public decimal DayRate { get; set; }
    public string? Description { get; set; }
    public string PaymentTerms { get; set; } = null!;
    public List<string> Photos { get; set; } = new();
}
