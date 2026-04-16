namespace OnsiteMonday.Api.Stubs;

public interface IEmailService
{
    Task SendEmailAsync(string to, string subject, string htmlBody);
}
