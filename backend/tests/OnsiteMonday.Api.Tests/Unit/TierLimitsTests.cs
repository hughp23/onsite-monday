using FluentAssertions;
using OnsiteMonday.Api.Domain;

namespace OnsiteMonday.Api.Tests.Unit;

public class TierLimitsTests
{
    [Theory]
    [InlineData("bronze", 2)]
    [InlineData("silver", 5)]
    public void PostsPerMonth_ReturnsTierLimit(string tier, int expected) =>
        TierLimits.PostsPerMonth(tier).Should().Be(expected);

    [Fact]
    public void PostsPerMonth_Gold_IsUnlimited() =>
        TierLimits.PostsPerMonth("gold").Should().BeNull();

    [Theory]
    [InlineData("bronze", 10)]
    [InlineData("silver", 30)]
    public void ApplicationsPerMonth_ReturnsTierLimit(string tier, int expected) =>
        TierLimits.ApplicationsPerMonth(tier).Should().Be(expected);

    [Fact]
    public void ApplicationsPerMonth_NullTier_IsBronze() =>
        TierLimits.ApplicationsPerMonth(null).Should().Be(10);

    [Fact]
    public void CurrentPeriodStart_LastMinuteOfMonth_IsFirstOfSameMonth() =>
        TierLimits.CurrentPeriodStart(new DateTimeOffset(2026, 10, 31, 23, 59, 0, TimeSpan.Zero))
            .Should().Be(new DateTimeOffset(2026, 10, 1, 0, 0, 0, TimeSpan.Zero));

    [Fact]
    public void CurrentPeriodStart_FirstInstantOfMonth_IsThatInstant() =>
        TierLimits.CurrentPeriodStart(new DateTimeOffset(2026, 11, 1, 0, 0, 0, TimeSpan.Zero))
            .Should().Be(new DateTimeOffset(2026, 11, 1, 0, 0, 0, TimeSpan.Zero));

    [Fact]
    public void CurrentPeriodStart_NonUtcOffset_UsesUtcMonth() =>
        // 00:30 on 1 Nov in UTC+1 is still 31 Oct in UTC
        TierLimits.CurrentPeriodStart(new DateTimeOffset(2026, 11, 1, 0, 30, 0, TimeSpan.FromHours(1)))
            .Should().Be(new DateTimeOffset(2026, 10, 1, 0, 0, 0, TimeSpan.Zero));
}
