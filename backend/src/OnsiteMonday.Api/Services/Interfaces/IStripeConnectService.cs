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

    /// <summary>
    /// Makes sure an unpaid job's Checkout Session can no longer be paid. True when the
    /// session is now expired (by this call or already); false when it has completed,
    /// i.e. the poster paid and the checkout.session.completed webhook may not have landed yet.
    /// </summary>
    Task<bool> TryExpireCheckoutSessionAsync(string sessionId);

    /// <summary>Full refund of a job's captured payment. Idempotent per job. Returns the refund id.</summary>
    Task<string> RefundJobPaymentAsync(Guid jobId, string paymentIntentId);
}
