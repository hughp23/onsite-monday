using FluentAssertions;
using Moq;
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.Repositories;
using OnsiteMonday.Api.Services;
using OnsiteMonday.Api.Tests.Infrastructure;

namespace OnsiteMonday.Api.Tests.Unit.Services;

public class UsageServiceTests
{
    private readonly Mock<IJobRepository> _jobRepo = new();
    private readonly Mock<IUserRepository> _userRepo = new();
    private readonly UsageService _sut;
    private readonly User _user = TestBuilders.MakeUser();

    public UsageServiceTests()
    {
        _userRepo.Setup(r => r.GetByIdAsync(_user.Id)).ReturnsAsync(_user);
        _sut = new UsageService(_jobRepo.Object, _userRepo.Object);
    }

    private void WithTier(string tier) =>
        _user.Subscriptions.Add(new Subscription { Id = Guid.NewGuid(), UserId = _user.Id, Tier = tier, IsActive = true });

    [Fact]
    public async Task GetUsage_NoSubscription_ReturnsBronzeLimits()
    {
        var usage = await _sut.GetUsageAsync(_user.Id);

        usage.Tier.Should().Be("bronze");
        usage.PostsLimit.Should().Be(2);
        usage.ApplicationsLimit.Should().Be(10);
    }

    [Fact]
    public async Task GetUsage_ReturnsCountsSincePeriodStart()
    {
        WithTier("silver");
        _jobRepo.Setup(r => r.CountJobsPostedSinceAsync(_user.Id, It.IsAny<DateTimeOffset>())).ReturnsAsync(3);
        _jobRepo.Setup(r => r.CountApplicationsSinceAsync(_user.Id, It.IsAny<DateTimeOffset>())).ReturnsAsync(7);

        var usage = await _sut.GetUsageAsync(_user.Id);

        usage.PostsUsed.Should().Be(3);
        usage.ApplicationsUsed.Should().Be(7);
        usage.PeriodEnd.Should().Be(usage.PeriodStart.AddMonths(1));
    }

    [Fact]
    public async Task EnsureCanPost_AtLimit_Throws()
    {
        _jobRepo.Setup(r => r.CountJobsPostedSinceAsync(_user.Id, It.IsAny<DateTimeOffset>())).ReturnsAsync(2);

        var act = () => _sut.EnsureCanPostAsync(_user.Id);

        await act.Should().ThrowAsync<TierLimitExceededException>()
            .WithMessage("*2 job posts*");
    }

    [Fact]
    public async Task EnsureCanPost_Gold_NeverThrows()
    {
        WithTier("gold");
        _jobRepo.Setup(r => r.CountJobsPostedSinceAsync(_user.Id, It.IsAny<DateTimeOffset>())).ReturnsAsync(500);

        await _sut.Invoking(s => s.EnsureCanPostAsync(_user.Id)).Should().NotThrowAsync();
    }

    [Fact]
    public async Task EnsureCanApply_BelowLimit_DoesNotThrow()
    {
        _jobRepo.Setup(r => r.CountApplicationsSinceAsync(_user.Id, It.IsAny<DateTimeOffset>())).ReturnsAsync(9);

        await _sut.Invoking(s => s.EnsureCanApplyAsync(_user.Id)).Should().NotThrowAsync();
    }

    [Fact]
    public async Task EnsureCanApply_AtLimit_Throws()
    {
        _jobRepo.Setup(r => r.CountApplicationsSinceAsync(_user.Id, It.IsAny<DateTimeOffset>())).ReturnsAsync(10);

        await _sut.Invoking(s => s.EnsureCanApplyAsync(_user.Id))
            .Should().ThrowAsync<TierLimitExceededException>();
    }
}
