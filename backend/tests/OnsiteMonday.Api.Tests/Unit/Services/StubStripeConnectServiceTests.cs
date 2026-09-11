using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using OnsiteMonday.Api.Stubs;

namespace OnsiteMonday.Api.Tests.Unit.Services;

public class StubStripeConnectServiceTests
{
    private readonly StubStripeConnectService _sut = new(NullLogger<StubStripeConnectService>.Instance);

    [Fact]
    public async Task CreateConnectedAccount_ReturnsStubId()
    {
        var id = await _sut.CreateConnectedAccountAsync(Guid.NewGuid(), "test@example.com");
        id.Should().StartWith("stub_acct_");
    }

    [Fact]
    public async Task CreateAccountLink_ReturnsUrl()
    {
        var url = await _sut.CreateAccountLinkAsync("acct_stub", "https://refresh", "https://return");
        url.Should().StartWith("https://stub-connect.stripe.com/");
    }

    [Fact]
    public async Task CreateJobCheckout_ReturnsSessionIdAndUrl()
    {
        var (sessionId, url) = await _sut.CreateJobCheckoutSessionAsync(
            Guid.NewGuid(), "Test Job", 50000L, "https://success", "https://cancel");
        sessionId.Should().StartWith("stub_cs_");
        url.Should().StartWith("https://stub-checkout.stripe.com/");
    }

    [Fact]
    public async Task CreateTransfer_ReturnsTransferId()
    {
        var transferId = await _sut.CreateTransferAsync(Guid.NewGuid(), "acct_stub", 45000L);
        transferId.Should().StartWith("stub_tr_");
    }
}
