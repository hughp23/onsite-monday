using Microsoft.Extensions.Options;
using OnsiteMonday.Api.Services.Interfaces;
using Stripe;
using Stripe.Checkout;

namespace OnsiteMonday.Api.Services;

public class StripeConnectService : IStripeConnectService
{
    private readonly StripeClient _client;
    private readonly ILogger<StripeConnectService> _logger;

    public StripeConnectService(StripeClient client, ILogger<StripeConnectService> logger)
    {
        _client = client;
        _logger = logger;
    }

    public async Task<string> CreateConnectedAccountAsync(Guid userId, string email)
    {
        var service = new AccountService(_client);
        var account = await service.CreateAsync(new AccountCreateOptions
        {
            Type = "express",
            Country = "GB",
            Email = email,
            Metadata = new Dictionary<string, string> { ["userId"] = userId.ToString() },
        });
        _logger.LogInformation("Stripe Connect: Created account {AccountId} for user {UserId}", account.Id, userId);
        return account.Id;
    }

    public async Task<string> CreateAccountLinkAsync(string stripeAccountId, string refreshUrl, string returnUrl)
    {
        var service = new AccountLinkService(_client);
        var link = await service.CreateAsync(new AccountLinkCreateOptions
        {
            Account = stripeAccountId,
            Type = "account_onboarding",
            RefreshUrl = refreshUrl,
            ReturnUrl = returnUrl,
        });
        return link.Url;
    }

    public async Task<bool> GetOnboardingCompleteAsync(string stripeAccountId)
    {
        var service = new AccountService(_client);
        var account = await service.GetAsync(stripeAccountId);
        return account.ChargesEnabled && account.PayoutsEnabled;
    }

    public async Task<(string SessionId, string Url)> CreateJobCheckoutSessionAsync(
        Guid jobId, string jobTitle, long amountPence, string successUrl, string cancelUrl)
    {
        var service = new SessionService(_client);
        var session = await service.CreateAsync(new SessionCreateOptions
        {
            Mode = "payment",
            LineItems = new List<SessionLineItemOptions>
            {
                new()
                {
                    PriceData = new SessionLineItemPriceDataOptions
                    {
                        Currency = "gbp",
                        UnitAmount = amountPence,
                        ProductData = new SessionLineItemPriceDataProductDataOptions
                        {
                            Name = $"Job: {jobTitle}",
                            Description = "Protected Payment — held securely until job completion and review.",
                        },
                    },
                    Quantity = 1,
                },
            },
            SuccessUrl = successUrl,
            CancelUrl = cancelUrl,
            Metadata = new Dictionary<string, string> { ["jobId"] = jobId.ToString() },
        });

        _logger.LogInformation(
            "Stripe Connect: Checkout Session {SessionId} for job {JobId}, £{Amount}",
            session.Id, jobId, amountPence / 100m);

        return (session.Id, session.Url);
    }

    public async Task<long> GetPaymentIntentAmountAsync(string paymentIntentId)
    {
        var service = new PaymentIntentService(_client);
        var pi = await service.GetAsync(paymentIntentId);
        _logger.LogInformation(
            "Stripe Connect: PaymentIntent {PiId} AmountReceived={Amount}p",
            paymentIntentId, pi.AmountReceived);
        return pi.AmountReceived;
    }

    public async Task<string> CreateTransferAsync(
        Guid jobId, string destinationAccountId, long netAmountPence, string? sourceTransaction = null)
    {
        var options = new TransferCreateOptions
        {
            Amount = netAmountPence,
            Currency = "gbp",
            Destination = destinationAccountId,
            Metadata = new Dictionary<string, string> { ["jobId"] = jobId.ToString() },
        };

        if (!string.IsNullOrEmpty(sourceTransaction))
            options.SourceTransaction = sourceTransaction;

        var service = new TransferService(_client);
        var transfer = await service.CreateAsync(options);

        _logger.LogInformation(
            "Stripe Connect: Transfer {TransferId} of £{Amount} to {AccountId} for job {JobId}",
            transfer.Id, netAmountPence / 100m, destinationAccountId, jobId);

        return transfer.Id;
    }
}
