namespace OnsiteMonday.Api.Stubs;

public interface IMangopayService
{
    Task<string> EnsureUserAsync(Guid userId, string email, string firstName, string lastName);
    Task<string> EnsureWalletAsync(string mangopayUserId, string description);
    Task<(string PayInId, string RedirectUrl)> CreateWebPayInAsync(Guid jobId, string posterMangopayUserId, decimal amount, string returnUrl);
    Task<string> TransferToTradesPersonWalletAsync(Guid jobId, string tradespersonMangopayUserId, string tradespersonMangopayWalletId, decimal amount);
    Task<string> ReleaseFundsAsync(string mangopayUserId, string mangopayWalletId, string mangopayBankAccountId, decimal amount, string reference);
    bool ValidateWebhookSignature(string rawBody, string mangopayEventType);
}
