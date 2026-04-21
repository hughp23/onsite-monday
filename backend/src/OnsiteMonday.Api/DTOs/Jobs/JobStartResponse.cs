namespace OnsiteMonday.Api.DTOs.Jobs;

public class JobStartResponse
{
    public JobDto Job { get; set; } = null!;

    /// <summary>
    /// Mangopay hosted payment page URL. The mobile app opens this in an in-app browser.
    /// Null when using the stub service (development/testing).
    /// </summary>
    public string? PayInRedirectUrl { get; set; }
}
