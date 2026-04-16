namespace OnsiteMonday.Api.Stubs;

public interface IStripeService
{
    Task<string> CreateConnectAccountAsync(string userId);
    Task TriggerPayoutAsync(Guid jobId, decimal amount, int delayDays);
    Task<string> CreateCheckoutSessionAsync(Guid jobId, decimal amount);
}
