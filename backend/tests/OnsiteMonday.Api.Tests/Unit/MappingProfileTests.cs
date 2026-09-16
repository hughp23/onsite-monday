using AutoMapper;
using FluentAssertions;
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.DTOs.Users;
using OnsiteMonday.Api.Mapping;

namespace OnsiteMonday.Api.Tests.Unit;

public class MappingProfileTests
{
    private readonly IMapper _mapper;

    public MappingProfileTests()
    {
        var config = new MapperConfiguration(cfg => cfg.AddProfile<MappingProfile>());
        _mapper = config.CreateMapper();
    }

    [Fact]
    public void KycStatus_IsNone_WhenNoStripeAccountId()
    {
        var user = new User { StripeConnectAccountId = null, StripeConnectOnboardingComplete = false };
        var dto = _mapper.Map<UserDto>(user);
        dto.KycStatus.Should().Be("none");
    }

    [Fact]
    public void KycStatus_IsPending_WhenHasAccountIdButOnboardingIncomplete()
    {
        var user = new User { StripeConnectAccountId = "acct_test", StripeConnectOnboardingComplete = false };
        var dto = _mapper.Map<UserDto>(user);
        dto.KycStatus.Should().Be("pending");
    }

    [Fact]
    public void KycStatus_IsVerified_WhenOnboardingComplete()
    {
        var user = new User { StripeConnectAccountId = "acct_test", StripeConnectOnboardingComplete = true };
        var dto = _mapper.Map<UserDto>(user);
        dto.KycStatus.Should().Be("verified");
    }

    [Fact]
    public void HasBankAccount_IsFalse_WhenOnboardingIncomplete()
    {
        var user = new User { StripeConnectAccountId = "acct_test", StripeConnectOnboardingComplete = false };
        var dto = _mapper.Map<UserDto>(user);
        dto.HasBankAccount.Should().BeFalse();
    }

    [Fact]
    public void HasBankAccount_IsTrue_WhenOnboardingComplete()
    {
        var user = new User { StripeConnectAccountId = "acct_test", StripeConnectOnboardingComplete = true };
        var dto = _mapper.Map<UserDto>(user);
        dto.HasBankAccount.Should().BeTrue();
    }
}
