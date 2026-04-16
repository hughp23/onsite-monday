using FluentAssertions;
using Moq;
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.Repositories;
using OnsiteMonday.Api.Services;
using OnsiteMonday.Api.Tests.Infrastructure;

namespace OnsiteMonday.Api.Tests.Unit.Services;

public class NotificationServiceTests
{
    private readonly Mock<INotificationRepository> _repoMock = new();
    private readonly NotificationService _sut;

    public NotificationServiceTests()
    {
        _sut = new NotificationService(_repoMock.Object);
    }

    [Fact]
    public async Task GetNotifications_ReturnsMappedDtos()
    {
        var userId = Guid.NewGuid();
        var notifications = new List<Notification>
        {
            TestBuilders.MakeNotification(userId, isRead: false),
            TestBuilders.MakeNotification(userId, isRead: true),
        };
        _repoMock.Setup(r => r.GetByUserIdAsync(userId)).ReturnsAsync(notifications);

        var result = await _sut.GetNotificationsAsync(userId);

        result.Should().HaveCount(2);
        result[0].IsRead.Should().BeFalse();
        result[1].IsRead.Should().BeTrue();
    }

    [Fact]
    public async Task MarkRead_DelegatesToRepository()
    {
        var notificationId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        _repoMock.Setup(r => r.MarkReadAsync(notificationId, userId)).Returns(Task.CompletedTask);

        await _sut.MarkReadAsync(notificationId, userId);

        _repoMock.Verify(r => r.MarkReadAsync(notificationId, userId), Times.Once);
    }

    [Fact]
    public async Task MarkAllRead_DelegatesToRepository()
    {
        var userId = Guid.NewGuid();
        _repoMock.Setup(r => r.MarkAllReadAsync(userId)).Returns(Task.CompletedTask);

        await _sut.MarkAllReadAsync(userId);

        _repoMock.Verify(r => r.MarkAllReadAsync(userId), Times.Once);
    }
}
