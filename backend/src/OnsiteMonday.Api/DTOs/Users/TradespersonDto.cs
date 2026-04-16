namespace OnsiteMonday.Api.DTOs.Users;

public class TradespersonDto
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = null!;
    public string LastName { get; set; } = null!;
    public string? BusinessName { get; set; }
    public string? Trade { get; set; }
    public List<string> Skills { get; set; } = new();
    public List<string> Accreditations { get; set; } = new();
    public decimal? DayRate { get; set; }
    public bool DayRateVisible { get; set; }
    public string? Location { get; set; }
    public int TravelRadius { get; set; }
    public decimal Rating { get; set; }
    public int ReviewCount { get; set; }
    public string? ProfileImageUrl { get; set; }
    public List<string> Gallery { get; set; } = new();
}
