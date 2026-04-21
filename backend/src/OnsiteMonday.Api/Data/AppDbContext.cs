using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using OnsiteMonday.Api.Domain;

namespace OnsiteMonday.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();
    public DbSet<Job> Jobs => Set<Job>();
    public DbSet<JobApplication> JobApplications => Set<JobApplication>();
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        var isNpgsql = Database.ProviderName?.Contains("Npgsql") == true;

        // JSON value converter for List<string> used by non-Npgsql providers (SQLite in tests)
        var listConverter = new ValueConverter<List<string>, string>(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
            v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>());

        // EF Core 8 SQLite throws when DateTimeOffset is used in ORDER BY.
        // Store as Unix milliseconds (long) so sorting works correctly in tests.
        if (!isNpgsql)
        {
            var dtoConverter = new ValueConverter<DateTimeOffset, long>(
                v => v.ToUnixTimeMilliseconds(),
                v => DateTimeOffset.FromUnixTimeMilliseconds(v));
            var nullableDtoConverter = new ValueConverter<DateTimeOffset?, long?>(
                v => v == null ? null : v.Value.ToUnixTimeMilliseconds(),
                v => v == null ? null : DateTimeOffset.FromUnixTimeMilliseconds(v.Value));

            foreach (var entityType in mb.Model.GetEntityTypes())
            {
                foreach (var property in entityType.GetProperties().Where(p => p.ClrType == typeof(DateTimeOffset)))
                    property.SetValueConverter(dtoConverter);
                foreach (var property in entityType.GetProperties().Where(p => p.ClrType == typeof(DateTimeOffset?)))
                    property.SetValueConverter(nullableDtoConverter);
            }
        }

        // ── User ──────────────────────────────────────────────────────────────
        mb.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();
            e.HasIndex(u => u.FirebaseUid).IsUnique();
            if (isNpgsql)
            {
                e.Property(u => u.Skills).HasColumnType("text[]");
                e.Property(u => u.Accreditations).HasColumnType("text[]");
                e.Property(u => u.Gallery).HasColumnType("text[]");
            }
            else
            {
                e.Property(u => u.Skills).HasConversion(listConverter);
                e.Property(u => u.Accreditations).HasConversion(listConverter);
                e.Property(u => u.Gallery).HasConversion(listConverter);
            }
            e.Property(u => u.Rating).HasPrecision(3, 2);
            e.Property(u => u.DayRate).HasPrecision(10, 2);
        });

        // ── Subscription ──────────────────────────────────────────────────────
        mb.Entity<Subscription>(e =>
        {
            e.HasOne(s => s.User)
             .WithMany(u => u.Subscriptions)
             .HasForeignKey(s => s.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ── Job ───────────────────────────────────────────────────────────────
        mb.Entity<Job>(e =>
        {
            if (isNpgsql)
            {
                e.Property(j => j.Days).HasColumnType("text[]");
                e.Property(j => j.Photos).HasColumnType("text[]");
            }
            else
            {
                e.Property(j => j.Days).HasConversion(listConverter);
                e.Property(j => j.Photos).HasConversion(listConverter);
            }
            e.Property(j => j.DayRate).HasPrecision(10, 2);
            e.Property(j => j.PaymentStatus).HasDefaultValue("none");

            e.HasOne(j => j.PostedBy)
             .WithMany(u => u.PostedJobs)
             .HasForeignKey(j => j.PostedById)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── JobApplication ────────────────────────────────────────────────────
        mb.Entity<JobApplication>(e =>
        {
            e.HasIndex(a => new { a.JobId, a.ApplicantId }).IsUnique();

            e.HasOne(a => a.Job)
             .WithMany(j => j.Applications)
             .HasForeignKey(a => a.JobId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(a => a.Applicant)
             .WithMany(u => u.Applications)
             .HasForeignKey(a => a.ApplicantId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── Conversation ──────────────────────────────────────────────────────
        mb.Entity<Conversation>(e =>
        {
            e.HasIndex(c => new { c.InitiatorId, c.ParticipantId }).IsUnique();

            e.HasOne(c => c.Initiator)
             .WithMany()
             .HasForeignKey(c => c.InitiatorId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(c => c.Participant)
             .WithMany()
             .HasForeignKey(c => c.ParticipantId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── Message ───────────────────────────────────────────────────────────
        mb.Entity<Message>(e =>
        {
            e.HasOne(m => m.Conversation)
             .WithMany(c => c.Messages)
             .HasForeignKey(m => m.ConversationId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(m => m.Sender)
             .WithMany()
             .HasForeignKey(m => m.SenderId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── Review ────────────────────────────────────────────────────────────
        mb.Entity<Review>(e =>
        {
            e.HasIndex(r => r.JobId).IsUnique(); // one review per job

            e.HasOne(r => r.Reviewee)
             .WithMany(u => u.ReviewsReceived)
             .HasForeignKey(r => r.RevieweeId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(r => r.Reviewer)
             .WithMany(u => u.ReviewsGiven)
             .HasForeignKey(r => r.ReviewerId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(r => r.Job)
             .WithOne(j => j.Review)
             .HasForeignKey<Review>(r => r.JobId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── Notification ──────────────────────────────────────────────────────
        mb.Entity<Notification>(e =>
        {
            e.HasOne(n => n.User)
             .WithMany(u => u.Notifications)
             .HasForeignKey(n => n.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
