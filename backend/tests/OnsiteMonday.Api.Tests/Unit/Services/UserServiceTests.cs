using AutoMapper;
using FluentAssertions;
using Moq;
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.DTOs.Users;
using OnsiteMonday.Api.Mapping;
using OnsiteMonday.Api.Repositories;
using OnsiteMonday.Api.Services;
using OnsiteMonday.Api.Tests.Infrastructure;

namespace OnsiteMonday.Api.Tests.Unit.Services;

public class UserServiceTests
{
    private readonly Mock<IUserRepository> _repoMock = new();
    private readonly IMapper _mapper;
    private readonly UserService _sut;

    public UserServiceTests()
    {
        var config = new MapperConfiguration(cfg => cfg.AddProfile<MappingProfile>());
        _mapper = config.CreateMapper();
        _sut = new UserService(_repoMock.Object, _mapper);
    }

    [Fact]
    public async Task GetOrCreateCurrentUser_WhenUserDoesNotExist_CreatesAndReturnsUser()
    {
        var user = TestBuilders.MakeUser(firstName: "Jane");
        _repoMock
            .Setup(r => r.GetOrCreateByCognitoSubAsync(FakeAuthHandler.TestFirebaseUid, FakeAuthHandler.TestEmail, null, null, null))
            .ReturnsAsync(user);

        var result = await _sut.GetOrCreateCurrentUserAsync(FakeAuthHandler.TestFirebaseUid, FakeAuthHandler.TestEmail);

        result.Should().NotBeNull();
        result.Id.Should().Be(user.Id);
        result.FirstName.Should().Be("Jane");
        _repoMock.Verify(r => r.GetOrCreateByCognitoSubAsync(FakeAuthHandler.TestFirebaseUid, FakeAuthHandler.TestEmail, null, null, null), Times.Once);
    }

    [Fact]
    public async Task GetOrCreateCurrentUser_WhenGoogleClaimsPresent_PassesThemToRepository()
    {
        var user = TestBuilders.MakeUser(firstName: "Jane", lastName: "Smith");
        user.ProfileImageUrl = "https://example.com/photo.jpg";
        _repoMock
            .Setup(r => r.GetOrCreateByCognitoSubAsync(
                FakeAuthHandler.TestFirebaseUid, FakeAuthHandler.TestEmail,
                "Jane", "Smith", "https://example.com/photo.jpg"))
            .ReturnsAsync(user);

        var result = await _sut.GetOrCreateCurrentUserAsync(
            FakeAuthHandler.TestFirebaseUid, FakeAuthHandler.TestEmail,
            "Jane", "Smith", "https://example.com/photo.jpg");

        result.FirstName.Should().Be("Jane");
        result.LastName.Should().Be("Smith");
        _repoMock.Verify(r => r.GetOrCreateByCognitoSubAsync(
            FakeAuthHandler.TestFirebaseUid, FakeAuthHandler.TestEmail,
            "Jane", "Smith", "https://example.com/photo.jpg"), Times.Once);
    }

    [Fact]
    public async Task GetOrCreateCurrentUser_WhenUserExists_ReturnsExistingUser()
    {
        var existingUser = TestBuilders.MakeUser();
        _repoMock
            .Setup(r => r.GetOrCreateByCognitoSubAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .ReturnsAsync(existingUser);

        var result = await _sut.GetOrCreateCurrentUserAsync(existingUser.CognitoSub, existingUser.Email);

        result.Id.Should().Be(existingUser.Id);
        _repoMock.Verify(r => r.GetOrCreateByCognitoSubAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()), Times.Once);
    }

    [Fact]
    public async Task GetById_WhenUserExists_ReturnsMappedDto()
    {
        var user = TestBuilders.MakeUser(firstName: "Bob", lastName: "Builder");
        _repoMock.Setup(r => r.GetByIdAsync(user.Id)).ReturnsAsync(user);

        var result = await _sut.GetByIdAsync(user.Id);

        result.Should().BeOfType<UserDto>();
        result.FirstName.Should().Be("Bob");
        result.LastName.Should().Be("Builder");
    }

    [Fact]
    public async Task GetById_WhenUserNotFound_ThrowsKeyNotFoundException()
    {
        _repoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>())).ReturnsAsync((User?)null);

        var act = () => _sut.GetByIdAsync(Guid.NewGuid());

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task UpdateCurrentUser_PatchesOnlyProvidedFields()
    {
        var user = TestBuilders.MakeUser(firstName: "Old", lastName: "Name");
        _repoMock.Setup(r => r.GetOrCreateByCognitoSubAsync(user.CognitoSub, user.Email, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>())).ReturnsAsync(user);
        _repoMock.Setup(r => r.UpdateAsync(It.IsAny<User>())).Returns(Task.CompletedTask);

        var request = new UpdateUserRequest { FirstName = "New" }; // LastName intentionally null

        var result = await _sut.UpdateCurrentUserAsync(user.CognitoSub, user.Email, request);

        result.FirstName.Should().Be("New");
        result.LastName.Should().Be("Name"); // untouched
        _repoMock.Verify(r => r.UpdateAsync(It.IsAny<User>()), Times.Once);
    }

    [Fact]
    public async Task UpdateCurrentUser_WhenUserNotFound_ThrowsKeyNotFoundException()
    {
        _repoMock.Setup(r => r.GetOrCreateByCognitoSubAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()))
            .ThrowsAsync(new KeyNotFoundException());

        var act = () => _sut.UpdateCurrentUserAsync("unknown-uid", "x@x.com", new UpdateUserRequest());

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task CompleteOnboarding_SetsIsOnboardedTrue()
    {
        var user = TestBuilders.MakeUser();
        user.IsOnboarded = false;
        _repoMock.Setup(r => r.GetOrCreateByCognitoSubAsync(user.CognitoSub, user.Email, It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>())).ReturnsAsync(user);
        _repoMock.Setup(r => r.UpdateAsync(It.IsAny<User>())).Returns(Task.CompletedTask);

        var result = await _sut.CompleteOnboardingAsync(user.CognitoSub, user.Email);

        result.IsOnboarded.Should().BeTrue();
        _repoMock.Verify(r => r.UpdateAsync(It.Is<User>(u => u.IsOnboarded)), Times.Once);
    }

    [Fact]
    public async Task GetTradespeople_DelegatesToRepository_ReturnsAllMapped()
    {
        var users = new List<User>
        {
            TestBuilders.MakeUser("uid1", "a@b.com"),
            TestBuilders.MakeUser("uid2", "c@d.com"),
        };
        _repoMock.Setup(r => r.GetTradespeopleAsync("Builder", "London")).ReturnsAsync(users);

        var result = await _sut.GetTradespeopleAsync("Builder", "London");

        result.Should().HaveCount(2);
        _repoMock.Verify(r => r.GetTradespeopleAsync("Builder", "London"), Times.Once);
    }
}
