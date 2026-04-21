namespace OnsiteMonday.Api.Stubs;

public class StubMangopayService : IMangopayService
{
    private readonly ILogger<StubMangopayService> _logger;

    public StubMangopayService(ILogger<StubMangopayService> logger) => _logger = logger;

    public Task<string> EnsureUserAsync(Guid userId, string email, string firstName, string lastName)
    {
        var id = "stub_mango_user_" + userId.ToString("N")[..8];
        _logger.LogInformation("[STUB] Mangopay EnsureUser {UserId} → {MangoId}", userId, id);
        return Task.FromResult(id);
    }

    public Task<string> EnsureWalletAsync(string mangopayUserId, string description)
    {
        var id = "stub_wallet_" + Guid.NewGuid().ToString("N")[..8];
        _logger.LogInformation("[STUB] Mangopay EnsureWallet for {UserId} → {WalletId}", mangopayUserId, id);
        return Task.FromResult(id);
    }

    public Task<(string PayInId, string RedirectUrl)> CreateWebPayInAsync(
        Guid jobId, string posterMangopayUserId, decimal amount, string returnUrl)
    {
        var payInId = "stub_payin_" + Guid.NewGuid().ToString("N")[..8];
        var url = $"https://stub-checkout.mangopay.com/pay/{payInId}";
        _logger.LogInformation("[STUB] Mangopay PayIn £{Amount} for job {JobId} → {PayInId}", amount, jobId, payInId);
        return Task.FromResult((payInId, url));
    }

    public Task<string> TransferToTradesPersonWalletAsync(
        Guid jobId, string tradespersonMangopayUserId, string tradespersonMangopayWalletId, decimal amount)
    {
        var id = "stub_transfer_" + Guid.NewGuid().ToString("N")[..8];
        _logger.LogInformation("[STUB] Mangopay Transfer £{Amount} for job {JobId} → {TransferId}", amount, jobId, id);
        return Task.FromResult(id);
    }

    public Task<string> ReleaseFundsAsync(
        string mangopayUserId, string mangopayWalletId, string mangopayBankAccountId, decimal amount, string reference)
    {
        var id = "stub_payout_" + Guid.NewGuid().ToString("N")[..8];
        _logger.LogInformation("[STUB] Mangopay Payout £{Amount} ref {Ref} → {PayoutId}", amount, reference, id);
        return Task.FromResult(id);
    }

    public bool ValidateWebhookSignature(string rawBody, string mangopayEventType) => true;
}
