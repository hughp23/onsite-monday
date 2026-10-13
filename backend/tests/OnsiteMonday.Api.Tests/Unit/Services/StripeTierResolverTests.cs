using FluentAssertions;
using OnsiteMonday.Api.Services;
using Stripe;

namespace OnsiteMonday.Api.Tests.Unit.Services;

public class StripeTierResolverTests
{
    private static readonly Dictionary<string, string> Configured = new()
    {
        ["Bronze"] = "price_b",
        ["Silver"] = "price_s",
        ["Gold"]   = "price_g",
    };

    [Theory]
    [InlineData("price_b", "bronze")]
    [InlineData("price_s", "silver")]
    [InlineData("price_g", "gold")]
    public void ConfiguredPriceId_ResolvesTier(string priceId, string expected)
    {
        StripeTierResolver.Resolve(new Price { Id = priceId }, Configured).Should().Be(expected);
    }

    [Fact]
    public void ConfiguredPriceId_WinsOverNicknameAndMetadata()
    {
        var price = new Price
        {
            Id = "price_s",
            Nickname = "Gold monthly",
            Metadata = new Dictionary<string, string> { ["tier"] = "gold" },
        };

        StripeTierResolver.Resolve(price, Configured).Should().Be("silver");
    }

    [Fact]
    public void UnconfiguredPrice_FallsBackToMetadataTier()
    {
        var price = new Price
        {
            Id = "price_dashboard_new",
            Metadata = new Dictionary<string, string> { ["tier"] = " Gold " },
        };

        StripeTierResolver.Resolve(price, Configured).Should().Be("gold");
    }

    [Fact]
    public void Nickname_IsNotUsed()
    {
        var price = new Price { Id = "price_unknown", Nickname = "Silver plan" };

        StripeTierResolver.Resolve(price, Configured).Should().BeNull();
    }

    [Fact]
    public void UnknownMetadataTier_ReturnsNull()
    {
        var price = new Price
        {
            Id = "price_unknown",
            Metadata = new Dictionary<string, string> { ["tier"] = "platinum" },
        };

        StripeTierResolver.Resolve(price, Configured).Should().BeNull();
    }

    [Fact]
    public void EmptyConfiguredPriceId_DoesNotMatchAPriceWithNoId()
    {
        var configured = new Dictionary<string, string> { ["Silver"] = "" };

        StripeTierResolver.Resolve(new Price { Id = "" }, configured).Should().BeNull();
        StripeTierResolver.Resolve(null, configured).Should().BeNull();
    }
}
