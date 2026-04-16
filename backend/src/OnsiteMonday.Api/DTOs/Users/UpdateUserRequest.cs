namespace OnsiteMonday.Api.DTOs.Users;

public class UpdateUserRequest
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? BusinessName { get; set; }
    public string? Phone { get; set; }
    public string? Trade { get; set; }
    public List<string>? Skills { get; set; }
    public List<string>? Accreditations { get; set; }
    public decimal? DayRate { get; set; }
    public bool? DayRateVisible { get; set; }
    public string? Location { get; set; }
    public int? TravelRadius { get; set; }
    public string? ProfileImageUrl { get; set; }
    public List<string>? Gallery { get; set; }
}
