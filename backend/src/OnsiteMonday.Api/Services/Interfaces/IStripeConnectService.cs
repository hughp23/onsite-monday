namespace OnsiteMonday.Api.Services.Interfaces;

public interface IStripeConnectService
{
    Task<string> CreateConnectedAccountAsync(Guid userId, string email);
    Task<string> CreateAccountLinkAsync(string stripeAccountId, string refreshUrl, string returnUrl);
    Task<bool> GetOnboardingCompleteAsync(string stripeAccountId);
    Task<(string SessionId, string Url)> CreateJobCheckoutSessionAsync(
        Guid jobId, string jobTitle, long amountPence, string successUrl, string cancelUrl);
    Task<long> GetPaymentIntentAmountAsync(string paymentIntentId);
    Task<string> CreateTransferAsync(
        Guid jobId, string destinationAccountId, long netAmountPence, string? sourceTransaction = null);
}
