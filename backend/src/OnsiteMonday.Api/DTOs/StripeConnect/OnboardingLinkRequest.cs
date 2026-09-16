namespace OnsiteMonday.Api.DTOs.StripeConnect;

public record OnboardingLinkRequest(string? ReturnUrl, string? RefreshUrl);
