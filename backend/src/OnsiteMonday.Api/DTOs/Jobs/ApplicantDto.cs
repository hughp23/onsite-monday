namespace OnsiteMonday.Api.DTOs.Jobs;

public class ApplicantDto
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = null!;
    public string LastName { get; set; } = null!;
    public string? Trade { get; set; }
    public string? ProfileImageUrl { get; set; }
    public decimal? DayRate { get; set; }
    public decimal Rating { get; set; }
    public int ReviewCount { get; set; }
    public List<string> Skills { get; set; } = [];
    public string ApplicationStatus { get; set; } = null!;
    public DateTimeOffset AppliedAt { get; set; }
}
