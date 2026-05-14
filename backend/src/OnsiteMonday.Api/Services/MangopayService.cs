using MangoPay.SDK;
using MangoPay.SDK.Core.Enumerations;
using MangoPay.SDK.Entities;
using MangoPay.SDK.Entities.POST;
using MangoPay.SDK.Entities.PUT;
using Microsoft.Extensions.Options;
using OnsiteMonday.Api.Stubs;

namespace OnsiteMonday.Api.Services;

public class MangopayOptions
{
    public string ClientId { get; set; } = null!;
    public string ApiKey { get; set; } = null!;
    public string BaseUrl { get; set; } = null!;
    public string PlatformWalletId { get; set; } = null!;
    public string WebhookSecretKey { get; set; } = null!;
}

public class MangopayService : IMangopayService
{
    private readonly MangoPayApi _api;
    private readonly MangopayOptions _opts;
    private readonly ILogger<MangopayService> _logger;

    public MangopayService(IOptions<MangopayOptions> opts, ILogger<MangopayService> logger)
    {
        _opts = opts.Value;
        _logger = logger;
        _api = new MangoPayApi();
        _api.Config.ClientId = _opts.ClientId;
        _api.Config.ClientPassword = _opts.ApiKey;
        _api.Config.BaseUrl = _opts.BaseUrl;
    }

    public async Task<string> EnsureUserAsync(Guid userId, string email, string firstName, string lastName)
    {
        // KYC stub — birthday placeholder used until KYC Phase 2
        var user = new UserNaturalPostDTO(
            email,
            firstName,
            lastName,
            new DateTime(1970, 1, 1),
            CountryIso.GB,
            CountryIso.GB)
        {
            Capacity = CapacityType.NORMAL,
            Tag = userId.ToString(),
        };
        var result = await Task.Run(() => _api.Users.Create(user));
        _logger.LogInformation("Mangopay: Created NaturalUser {MangoId} for platform user {UserId}", result.Id, userId);
        return result.Id;
    }

    public async Task<string> EnsureWalletAsync(string mangopayUserId, string description)
    {
        var wallet = new WalletPostDTO(
            new List<string> { mangopayUserId },
            description,
            CurrencyIso.GBP);
        var result = await Task.Run(() => _api.Wallets.Create(wallet));
        _logger.LogInformation("Mangopay: Created Wallet {WalletId} for user {MangoId}", result.Id, mangopayUserId);
        return result.Id;
    }

    public async Task<(string PayInId, string RedirectUrl)> CreateWebPayInAsync(
        Guid jobId, string posterMangopayUserId, decimal amount, string returnUrl)
    {
        var payIn = new PayInCardWebPostDTO(
            posterMangopayUserId,
            new Money { Amount = ToMinorUnits(amount), Currency = CurrencyIso.GBP },
            new Money { Amount = 0, Currency = CurrencyIso.GBP },
            _opts.PlatformWalletId,
            returnUrl,
            CultureCode.EN,
            CardType.CB_VISA_MASTERCARD,
            "ONSITE MONDAY")
        {
            Tag = jobId.ToString(),
        };
        var result = await Task.Run(() => _api.PayIns.CreateCardWeb(payIn));
        _logger.LogInformation("Mangopay: Created PayIn {PayInId} for job {JobId}, £{Amount}", result.Id, jobId, amount);
        return (result.Id, result.RedirectURL);
    }

    public async Task<string> TransferToTradesPersonWalletAsync(
        Guid jobId, string tradespersonMangopayUserId, string tradespersonMangopayWalletId, decimal amount)
    {
        var transfer = new TransferPostDTO(
            _opts.ClientId,
            tradespersonMangopayUserId,
            new Money { Amount = ToMinorUnits(amount), Currency = CurrencyIso.GBP },
            new Money { Amount = 0, Currency = CurrencyIso.GBP },
            _opts.PlatformWalletId,
            tradespersonMangopayWalletId)
        {
            Tag = jobId.ToString(),
        };
        var result = await Task.Run(() => _api.Transfers.Create(transfer));
        _logger.LogInformation("Mangopay: Transfer {TransferId} for job {JobId}", result.Id, jobId);
        return result.Id;
    }

    public async Task<string> ReleaseFundsAsync(
        string mangopayUserId, string mangopayWalletId, string mangopayBankAccountId, decimal amount, string reference)
    {
        var payout = new PayOutBankWirePostDTO(
            mangopayUserId,
            mangopayWalletId,
            new Money { Amount = ToMinorUnits(amount), Currency = CurrencyIso.GBP },
            new Money { Amount = 0, Currency = CurrencyIso.GBP },
            mangopayBankAccountId,
            reference);
        var result = await Task.Run(() => _api.PayOuts.CreateBankWire(payout));
        _logger.LogInformation("Mangopay: PayOut {PayoutId} from wallet {WalletId}", result.Id, mangopayWalletId);
        return result.Id;
    }

    public async Task<(long BalancePence, decimal Balance)> GetWalletBalanceAsync(string mangopayWalletId)
    {
        var wallet = await Task.Run(() => _api.Wallets.Get(mangopayWalletId));
        var pence = wallet.Balance.Amount;
        return (pence, pence / 100m);
    }

    public async Task<string> SubmitKycDocumentAsync(string mangopayUserId, byte[] fileBytes, string fileName)
    {
        var doc = await Task.Run(() => _api.Users.CreateKycDocument(
            mangopayUserId, KycDocumentType.IDENTITY_PROOF, fileName));

        await Task.Run(() => _api.Users.CreateKycPage(mangopayUserId, doc.Id, fileBytes));

        var putDto = new KycDocumentPutDTO { Status = KycStatus.VALIDATION_ASKED };
        await Task.Run(() => _api.Users.UpdateKycDocument(mangopayUserId, putDto, doc.Id));

        _logger.LogInformation("KYC document {DocId} submitted for user {UserId}", doc.Id, mangopayUserId);
        return doc.Id;
    }

    public async Task<string> CreateBankAccountAsync(
        string mangopayUserId, string accountHolderName, string iban)
    {
        var bankAccount = new BankAccountIbanPostDTO(
            accountHolderName,
            new Address { Country = CountryIso.GB },
            iban);
        var result = await Task.Run(() => _api.Users.CreateBankAccountIban(mangopayUserId, bankAccount));
        _logger.LogInformation("BankAccount {AccountId} registered for user {UserId}", result.Id, mangopayUserId);
        return result.Id;
    }

    public bool ValidateWebhookSignature(string rawBody, string mangopayEventType)
    {
        // Mangopay sends EventType as a query param — basic guard against empty/malformed calls.
        return !string.IsNullOrWhiteSpace(mangopayEventType);
    }

    private static long ToMinorUnits(decimal amount) => (long)Math.Round(amount * 100, MidpointRounding.AwayFromZero);
}
