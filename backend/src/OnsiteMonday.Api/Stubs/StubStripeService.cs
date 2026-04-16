namespace OnsiteMonday.Api.Stubs;

public class StubStripeService : IStripeService
{
    private readonly ILogger<StubStripeService> _logger;

    public StubStripeService(ILogger<StubStripeService> logger) => _logger = logger;

    public Task<string> CreateConnectAccountAsync(string userId)
    {
        _logger.LogInformation("[STUB] Stripe: CreateConnectAccount for user {UserId}", userId);
        return Task.FromResult("stub_acct_" + Guid.NewGuid().ToString("N")[..8]);
    }

    public Task TriggerPayoutAsync(Guid jobId, decimal amount, int delayDays)
    {
        _logger.LogInformation("[STUB] Stripe: Payout £{Amount} for job {JobId} in {Days} days", amount, jobId, delayDays);
        return Task.CompletedTask;
    }

    public Task<string> CreateCheckoutSessionAsync(Guid jobId, decimal amount)
    {
        _logger.LogInformation("[STUB] Stripe: Checkout session for job {JobId}, £{Amount}", jobId, amount);
        return Task.FromResult("stub_cs_" + Guid.NewGuid().ToString("N")[..8]);
    }
}
