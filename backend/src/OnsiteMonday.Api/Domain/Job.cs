namespace OnsiteMonday.Api.Domain;

public class Job
{
    public Guid Id { get; set; }
    public string Title { get; set; } = null!;
    public string Trade { get; set; } = null!;
    public string Location { get; set; } = null!;
    public string Postcode { get; set; } = null!;
    public int Duration { get; set; }
    public List<string> Days { get; set; } = new();  // e.g. ["M","T","W","Th","F"]
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string StartTime { get; set; } = null!;
    public string EndTime { get; set; } = null!;
    public decimal DayRate { get; set; }
    public string? Description { get; set; }
    public Guid PostedById { get; set; }
    public User PostedBy { get; set; } = null!;
    public string PaymentTerms { get; set; } = null!;
    public string Status { get; set; } = "open"; // open | applied | accepted | in_progress | completed
    public List<string> Photos { get; set; } = new();
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    // Navigation
    public ICollection<JobApplication> Applications { get; set; } = new List<JobApplication>();
    public Review? Review { get; set; }
}
