namespace OnsiteMonday.Api.DTOs.Jobs;

public class JobDto
{
    public Guid Id { get; set; }
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
    public Guid PostedById { get; set; }
    public string PostedByName { get; set; } = null!;
    public string? PostedByBusiness { get; set; }
    public string PaymentTerms { get; set; } = null!;
    public string Status { get; set; } = null!;
    public List<string> Photos { get; set; } = new();
    public DateTimeOffset CreatedAt { get; set; }

    // Computed per-caller fields
    public bool IsInterested { get; set; }
    public int InterestedCount { get; set; }
    public int ApplicantCount { get; set; }
}
