using OnsiteMonday.Api.Domain;

namespace OnsiteMonday.Api.Tests.Infrastructure;

/// <summary>
/// Object-mother helpers for creating domain entities in tests.
/// </summary>
public static class TestBuilders
{
    public static User MakeUser(
        string firebaseUid = FakeAuthHandler.TestFirebaseUid,
        string email = FakeAuthHandler.TestEmail,
        string firstName = "Test",
        string lastName = "User",
        Guid? id = null)
    {
        return new User
        {
            Id = id ?? Guid.NewGuid(),
            FirebaseUid = firebaseUid,
            Email = email,
            FirstName = firstName,
            LastName = lastName,
            IsOnboarded = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
    }

    public static Job MakeJob(
        Guid postedById,
        string status = "open",
        string trade = "Builder",
        Guid? id = null)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return new Job
        {
            Id = id ?? Guid.NewGuid(),
            Title = "Test Job",
            Trade = trade,
            Location = "London",
            Postcode = "SW1A 1AA",
            Duration = 5,
            Days = new List<string> { "Monday", "Tuesday" },
            StartDate = today,
            EndDate = today.AddDays(4),
            StartTime = "08:00",
            EndTime = "17:00",
            DayRate = 250,
            Description = "A test job",
            PostedById = postedById,
            PaymentTerms = "30 days",
            Photos = new List<string>(),
            Status = status,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
    }

    public static Notification MakeNotification(
        Guid userId,
        bool isRead = false,
        Guid? id = null)
    {
        return new Notification
        {
            Id = id ?? Guid.NewGuid(),
            UserId = userId,
            Type = "application",
            Title = "New application",
            Description = "Someone applied to your job.",
            IsRead = isRead,
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }

    public static Review MakeReview(
        Guid revieweeId,
        Guid reviewerId,
        Guid jobId,
        int rating = 4,
        Guid? id = null)
    {
        return new Review
        {
            Id = id ?? Guid.NewGuid(),
            RevieweeId = revieweeId,
            ReviewerId = reviewerId,
            JobId = jobId,
            Rating = rating,
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }

    public static Conversation MakeConversation(
        Guid initiatorId,
        Guid participantId,
        Guid? id = null)
    {
        return new Conversation
        {
            Id = id ?? Guid.NewGuid(),
            InitiatorId = initiatorId,
            ParticipantId = participantId,
            CreatedAt = DateTimeOffset.UtcNow,
            LastActivityAt = DateTimeOffset.UtcNow,
            Messages = new List<Message>(),
        };
    }
}
