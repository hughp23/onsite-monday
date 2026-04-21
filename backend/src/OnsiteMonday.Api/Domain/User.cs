using System.ComponentModel.DataAnnotations.Schema;

namespace OnsiteMonday.Api.Domain;

public class User
{
    public Guid Id { get; set; }
    public string FirebaseUid { get; set; } = null!;
    public string FirstName { get; set; } = null!;
    public string LastName { get; set; } = null!;
    public string? BusinessName { get; set; }
    public string Email { get; set; } = null!;
    public string? Phone { get; set; }
    public string? Trade { get; set; }
    public List<string> Skills { get; set; } = new();
    public List<string> Accreditations { get; set; } = new();
    public decimal? DayRate { get; set; }
    public bool DayRateVisible { get; set; } = true;
    public string? Location { get; set; }
    public int TravelRadius { get; set; } = 25;
    public decimal Rating { get; set; } = 0;
    public int ReviewCount { get; set; } = 0;
    public string? ProfileImageUrl { get; set; }
    public List<string> Gallery { get; set; } = new();
    public bool IsOnboarded { get; set; } = false;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    // Payment provider identifiers
    public string? MangopayUserId { get; set; }
    public string? MangopayWalletId { get; set; }
    public string? StripeCustomerId { get; set; } // Phase B — Stripe Billing

    // Navigation
    public ICollection<Subscription> Subscriptions { get; set; } = new List<Subscription>();

    [NotMapped]
    public Subscription? ActiveSubscription => Subscriptions.FirstOrDefault(s => s.IsActive);
    public ICollection<Job> PostedJobs { get; set; } = new List<Job>();
    public ICollection<JobApplication> Applications { get; set; } = new List<JobApplication>();
    public ICollection<Review> ReviewsReceived { get; set; } = new List<Review>();
    public ICollection<Review> ReviewsGiven { get; set; } = new List<Review>();
    public ICollection<Notification> Notifications { get; set; } = new List<Notification>();
}
