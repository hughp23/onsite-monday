using OnsiteMonday.Api.Services.Interfaces;

namespace OnsiteMonday.Api.Stubs;

public class StubStripeConnectService : IStripeConnectService
{
    private readonly ILogger<StubStripeConnectService> _logger;

    public StubStripeConnectService(ILogger<StubStripeConnectService> logger) => _logger = logger;

    public Task<string> CreateConnectedAccountAsync(Guid userId, string email)
    {
        var id = "stub_acct_" + userId.ToString("N")[..8];
        _logger.LogInformation("[STUB] Stripe Connect: CreateAccount for {UserId} → {AccountId}", userId, id);
        return Task.FromResult(id);
    }

    public Task<string> CreateAccountLinkAsync(string stripeAccountId, string refreshUrl, string returnUrl)
    {
        var url = $"https://stub-connect.stripe.com/onboarding/{stripeAccountId}";
        _logger.LogInformation("[STUB] Stripe Connect: AccountLink for {AccountId} → {Url}", stripeAccountId, url);
        return Task.FromResult(url);
    }

    public Task<bool> GetOnboardingCompleteAsync(string stripeAccountId)
    {
        _logger.LogInformation("[STUB] Stripe Connect: GetOnboardingComplete {AccountId} → true", stripeAccountId);
        return Task.FromResult(true);
    }

    public Task<(string SessionId, string Url)> CreateJobCheckoutSessionAsync(
        Guid jobId, string jobTitle, long amountPence, string successUrl, string cancelUrl)
    {
        var sessionId = "stub_cs_" + Guid.NewGuid().ToString("N")[..8];
        var url = $"https://stub-checkout.stripe.com/pay/{sessionId}";
        _logger.LogInformation("[STUB] Stripe Connect: Checkout Session £{Amount} for job {JobId} → {SessionId}",
            amountPence / 100m, jobId, sessionId);
        return Task.FromResult((sessionId, url));
    }

    public Task<string> CreateTransferAsync(Guid jobId, string destinationAccountId, long netAmountPence)
    {
        var transferId = "stub_tr_" + Guid.NewGuid().ToString("N")[..8];
        _logger.LogInformation("[STUB] Stripe Connect: Transfer £{Amount} to {AccountId} for job {JobId} → {TransferId}",
            netAmountPence / 100m, destinationAccountId, jobId, transferId);
        return Task.FromResult(transferId);
    }
}
