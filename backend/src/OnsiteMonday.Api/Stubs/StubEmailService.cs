namespace OnsiteMonday.Api.Stubs;

public class StubEmailService : IEmailService
{
    private readonly ILogger<StubEmailService> _logger;

    public StubEmailService(ILogger<StubEmailService> logger) => _logger = logger;

    public Task SendEmailAsync(string to, string subject, string htmlBody)
    {
        _logger.LogInformation("[STUB] SendGrid: Email to {To} — Subject: {Subject}", to, subject);
        return Task.CompletedTask;
    }
}
