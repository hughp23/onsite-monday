using Microsoft.EntityFrameworkCore;
using OnsiteMonday.Api.Domain;

namespace OnsiteMonday.Api.Data;

public static class DataSeeder
{
    public static async Task SeedAsync(AppDbContext db)
    {
        // Only seed if no users exist yet
        if (await db.Users.AnyAsync()) return;

        var now = DateTimeOffset.UtcNow;

        // ── Tradespeople ──────────────────────────────────────────────────────

        var tp1 = new User
        {
            Id = Guid.NewGuid(),
            FirebaseUid = "seed-tp-1",
            FirstName = "Harry", LastName = "Webb",
            BusinessName = "HW Builds",
            Email = "harry@hwbuilds.co.uk", Phone = "07712345601",
            Trade = "Builder",
            Skills = new() { "Extensions", "Renovations", "New Builds", "Groundworks" },
            Accreditations = new() { "CSCS Card", "Public Liability Insurance", "City & Guilds" },
            DayRate = 220, DayRateVisible = true,
            Location = "York, UK", TravelRadius = 20,
            Rating = 4.8m, ReviewCount = 31,
            IsOnboarded = true, CreatedAt = now, UpdatedAt = now,
        };

        var tp2 = new User
        {
            Id = Guid.NewGuid(),
            FirebaseUid = "seed-tp-2",
            FirstName = "Joe", LastName = "Bloggs",
            BusinessName = null,
            Email = "joe.bloggs@email.co.uk", Phone = "07712345602",
            Trade = "Labourer",
            Skills = new() { "General Labour", "Site Clearance", "Loading/Unloading", "Assisting Trades" },
            Accreditations = new() { "CSCS Card", "First Aid" },
            DayRate = 120, DayRateVisible = true,
            Location = "Leeds, UK", TravelRadius = 15,
            Rating = 4.2m, ReviewCount = 14,
            IsOnboarded = true, CreatedAt = now, UpdatedAt = now,
        };

        var tp3 = new User
        {
            Id = Guid.NewGuid(),
            FirebaseUid = "seed-tp-3",
            FirstName = "Sarah", LastName = "Collins",
            BusinessName = "Collins Electrical",
            Email = "sarah@collinselectrical.co.uk", Phone = "07712345603",
            Trade = "Electrician",
            Skills = new() { "First Fix", "Second Fix", "Consumer Units", "EV Charger Install", "Solar PV", "Rewiring" },
            Accreditations = new() { "CSCS Card", "NICEIC", "Part P", "NVQ Level 3", "Public Liability Insurance" },
            DayRate = 280, DayRateVisible = true,
            Location = "Harrogate, UK", TravelRadius = 30,
            Rating = 4.9m, ReviewCount = 47,
            IsOnboarded = true, CreatedAt = now, UpdatedAt = now,
        };

        var tp4 = new User
        {
            Id = Guid.NewGuid(),
            FirebaseUid = "seed-tp-4",
            FirstName = "Mike", LastName = "Turner",
            BusinessName = "Turner Plumbing",
            Email = "mike@turnerplumbing.co.uk", Phone = "07712345604",
            Trade = "Plumber",
            Skills = new() { "Bathroom Fit", "Central Heating", "Emergency Repairs", "Underfloor Heating", "Gas Pipework" },
            Accreditations = new() { "CSCS Card", "Gas Safe", "Public Liability Insurance", "NVQ Level 3" },
            DayRate = 250, DayRateVisible = true,
            Location = "Sheffield, UK", TravelRadius = 20,
            Rating = 4.6m, ReviewCount = 28,
            IsOnboarded = true, CreatedAt = now, UpdatedAt = now,
        };

        var tp5 = new User
        {
            Id = Guid.NewGuid(),
            FirebaseUid = "seed-tp-5",
            FirstName = "Aisha", LastName = "Patel",
            BusinessName = "AP Plastering",
            Email = "aisha@appastering.co.uk", Phone = "07712345605",
            Trade = "Plasterer",
            Skills = new() { "Skimming", "Dry Lining", "External Render", "Screeding", "Coving" },
            Accreditations = new() { "CSCS Card", "City & Guilds", "Public Liability Insurance" },
            DayRate = 200, DayRateVisible = true,
            Location = "Wakefield, UK", TravelRadius = 25,
            Rating = 4.7m, ReviewCount = 19,
            IsOnboarded = true, CreatedAt = now, UpdatedAt = now,
        };

        var tp6 = new User
        {
            Id = Guid.NewGuid(),
            FirebaseUid = "seed-tp-6",
            FirstName = "Tom", LastName = "Bradley",
            BusinessName = "Bradley Roofing",
            Email = "tom@bradleyroofing.co.uk", Phone = "07712345606",
            Trade = "Roofer",
            Skills = new() { "Slate & Tile", "Flat Roofing", "GRP Fibreglass", "Lead Work", "Guttering", "Fascias & Soffits" },
            Accreditations = new() { "CSCS Card", "Public Liability Insurance", "NVQ Level 2", "First Aid" },
            DayRate = 240, DayRateVisible = true,
            Location = "York, UK", TravelRadius = 30,
            Rating = 4.5m, ReviewCount = 22,
            IsOnboarded = true, CreatedAt = now, UpdatedAt = now,
        };

        var tp7 = new User
        {
            Id = Guid.NewGuid(),
            FirebaseUid = "seed-tp-7",
            FirstName = "Ryan", LastName = "O'Connor",
            BusinessName = "O'Connor Joinery",
            Email = "ryan@oconnorjoinery.co.uk", Phone = "07712345607",
            Trade = "Joiner",
            Skills = new() { "First Fix", "Second Fix", "Staircases", "Roof Trusses", "Shopfitting", "Skirting & Architrave" },
            Accreditations = new() { "CSCS Card", "City & Guilds", "NVQ Level 3", "Public Liability Insurance" },
            DayRate = 230, DayRateVisible = true,
            Location = "Leeds, UK", TravelRadius = 20,
            Rating = 4.8m, ReviewCount = 35,
            IsOnboarded = true, CreatedAt = now, UpdatedAt = now,
        };

        var tp8 = new User
        {
            Id = Guid.NewGuid(),
            FirebaseUid = "seed-tp-8",
            FirstName = "Jim", LastName = "Blocks",
            BusinessName = "JB Bricklaying",
            Email = "jim@jbbricklaying.co.uk", Phone = "07712345608",
            Trade = "Bricklayer",
            Skills = new() { "Facing Brickwork", "Blockwork", "Repointing", "Retaining Walls", "Chimney Stacks" },
            Accreditations = new() { "CSCS Card", "Public Liability Insurance", "City & Guilds" },
            DayRate = 210, DayRateVisible = false,
            Location = "York, UK", TravelRadius = 15,
            Rating = 4.4m, ReviewCount = 17,
            IsOnboarded = true, CreatedAt = now, UpdatedAt = now,
        };

        var tp9 = new User
        {
            Id = Guid.NewGuid(),
            FirebaseUid = "seed-tp-9",
            FirstName = "Lucy", LastName = "Greenwood",
            BusinessName = "Greenwood Painters",
            Email = "lucy@greenwoodpainters.co.uk", Phone = "07712345609",
            Trade = "Painter & Decorator",
            Skills = new() { "Interior Painting", "Exterior Painting", "Wallpapering", "Spray Painting", "Wood Staining" },
            Accreditations = new() { "CSCS Card", "Public Liability Insurance" },
            DayRate = 160, DayRateVisible = true,
            Location = "Leeds, UK", TravelRadius = 20,
            Rating = 4.6m, ReviewCount = 26,
            IsOnboarded = true, CreatedAt = now, UpdatedAt = now,
        };

        // ── Job Posters ───────────────────────────────────────────────────────

        var poster1 = new User
        {
            Id = Guid.NewGuid(),
            FirebaseUid = "seed-poster-1",
            FirstName = "Dave", LastName = "C",
            BusinessName = "DC Joinery",
            Email = "dave@dcjoinery.co.uk", Phone = "07800000001",
            IsOnboarded = true, CreatedAt = now, UpdatedAt = now,
        };

        var poster2 = new User
        {
            Id = Guid.NewGuid(),
            FirebaseUid = "seed-poster-2",
            FirstName = "Sarah", LastName = "K",
            BusinessName = "SK Property Management",
            Email = "sarah@skproperty.co.uk", Phone = "07800000002",
            IsOnboarded = true, CreatedAt = now, UpdatedAt = now,
        };

        var poster3 = new User
        {
            Id = Guid.NewGuid(),
            FirebaseUid = "seed-poster-3",
            FirstName = "Neil", LastName = "B",
            BusinessName = "NB Developments",
            Email = "neil@nbdevelopments.co.uk", Phone = "07800000003",
            IsOnboarded = true, CreatedAt = now, UpdatedAt = now,
        };

        var allUsers = new[] { tp1, tp2, tp3, tp4, tp5, tp6, tp7, tp8, tp9, poster1, poster2, poster3 };
        db.Users.AddRange(allUsers);

        // ── Subscriptions ─────────────────────────────────────────────────────

        db.Subscriptions.AddRange(
            new Subscription { Id = Guid.NewGuid(), UserId = tp1.Id, Tier = "silver", PayoutDays = 14, IsActive = true, StartedAt = now },
            new Subscription { Id = Guid.NewGuid(), UserId = tp3.Id, Tier = "gold",   PayoutDays = 7,  IsActive = true, StartedAt = now },
            new Subscription { Id = Guid.NewGuid(), UserId = tp7.Id, Tier = "silver", PayoutDays = 14, IsActive = true, StartedAt = now }
        );

        // ── Jobs ──────────────────────────────────────────────────────────────

        var job1 = new Job
        {
            Id = Guid.NewGuid(),
            Title = "Garage Extension", Trade = "Labourer",
            Location = "York, UK", Postcode = "YO24 2PR",
            Duration = 3, Days = new() { "M", "T", "W" },
            StartDate = new DateOnly(2026, 3, 2), EndDate = new DateOnly(2026, 3, 4),
            StartTime = "8:00am", EndTime = "4:00pm",
            DayRate = 150,
            Description = "We are building a double garage extension to the side of a detached property in York. The labourer will assist the bricklayer and groundwork team with material movement, mixing, and site preparation. PPE required on site.",
            PostedById = poster1.Id,
            PaymentTerms = "Paid within 7 days of job completion, confirmed by both parties.",
            Status = "open", CreatedAt = now, UpdatedAt = now,
        };

        var job2 = new Job
        {
            Id = Guid.NewGuid(),
            Title = "Kitchen Refit", Trade = "Joiner",
            Location = "Leeds, UK", Postcode = "LS1 4AP",
            Duration = 5, Days = new() { "M", "T", "W", "Th", "F" },
            StartDate = new DateOnly(2026, 3, 9), EndDate = new DateOnly(2026, 3, 13),
            StartTime = "7:30am", EndTime = "3:30pm",
            DayRate = 200,
            Description = "Full kitchen refit on a Victorian terrace in Leeds city centre. Removal of old units, installation of new kitchen including fitting of carcase units, doors, drawers, and worktops. Sink installation included.",
            PostedById = poster2.Id,
            PaymentTerms = "Paid within 14 days of job completion, confirmed by both parties.",
            Status = "open", CreatedAt = now, UpdatedAt = now,
        };

        var job3 = new Job
        {
            Id = Guid.NewGuid(),
            Title = "Bathroom Renovation", Trade = "Plumber",
            Location = "Sheffield, UK", Postcode = "S1 2HE",
            Duration = 4, Days = new() { "M", "T", "W", "Th" },
            StartDate = new DateOnly(2026, 3, 16), EndDate = new DateOnly(2026, 3, 19),
            StartTime = "8:00am", EndTime = "5:00pm",
            DayRate = 220,
            Description = "Full bathroom strip-out and refit in a 3-bedroom semi in Sheffield. New bath, toilet, basin and shower enclosure. Tiling is handled by a separate subcontractor. Plumber to handle all supply and waste pipework.",
            PostedById = poster3.Id,
            PaymentTerms = "Paid within 7 days of job completion, confirmed by both parties.",
            Status = "open", CreatedAt = now, UpdatedAt = now,
        };

        var job4 = new Job
        {
            Id = Guid.NewGuid(),
            Title = "Loft Conversion", Trade = "Electrician",
            Location = "Harrogate, UK", Postcode = "HG1 1BS",
            Duration = 6, Days = new() { "M", "T", "W", "Th", "F" },
            StartDate = new DateOnly(2026, 3, 23), EndDate = new DateOnly(2026, 3, 28),
            StartTime = "8:00am", EndTime = "4:30pm",
            DayRate = 250,
            Description = "Loft conversion project on a large detached in Harrogate. Electrician required for full first and second fix including new consumer unit, all circuits for the new floor, smoke alarm installation and Velux window wiring.",
            PostedById = poster1.Id,
            PaymentTerms = "Paid within 7 days of job completion, confirmed by both parties.",
            Status = "open", CreatedAt = now, UpdatedAt = now,
        };

        var job5 = new Job
        {
            Id = Guid.NewGuid(),
            Title = "Garden Wall", Trade = "Bricklayer",
            Location = "York, UK", Postcode = "YO31 7RH",
            Duration = 2, Days = new() { "T", "W" },
            StartDate = new DateOnly(2026, 3, 3), EndDate = new DateOnly(2026, 3, 4),
            StartTime = "8:00am", EndTime = "4:00pm",
            DayRate = 180,
            Description = "New boundary wall to the front of a semi-detached property. Reclaimed York stone to match existing. Approximately 12 metres long, 600mm high, with a coping stone course on top.",
            PostedById = poster2.Id,
            PaymentTerms = "Paid within 30 days of job completion, confirmed by both parties.",
            Status = "open", CreatedAt = now, UpdatedAt = now,
        };

        var job6 = new Job
        {
            Id = Guid.NewGuid(),
            Title = "New Build Support", Trade = "Labourer",
            Location = "Wakefield, UK", Postcode = "WF1 2RA",
            Duration = 10, Days = new() { "M", "T", "W", "Th", "F" },
            StartDate = new DateOnly(2026, 3, 9), EndDate = new DateOnly(2026, 3, 20),
            StartTime = "7:30am", EndTime = "4:30pm",
            DayRate = 130,
            Description = "Ongoing labouring support needed on a new build housing development in Wakefield. 4-bed detached properties. Work includes groundworks assistance, material movement, general site duties and traffic management.",
            PostedById = poster3.Id,
            PaymentTerms = "Paid within 14 days of job completion, confirmed by both parties.",
            Status = "open", CreatedAt = now, UpdatedAt = now,
        };

        var job7 = new Job
        {
            Id = Guid.NewGuid(),
            Title = "Office Refurb", Trade = "Electrician",
            Location = "Leeds, UK", Postcode = "LS2 7HY",
            Duration = 8, Days = new() { "M", "T", "W", "Th", "F" },
            StartDate = new DateOnly(2026, 3, 30), EndDate = new DateOnly(2026, 4, 9),
            StartTime = "7:00am", EndTime = "3:30pm",
            DayRate = 240,
            Description = "Commercial office refurb on the 2nd floor of a city centre building in Leeds. New lighting circuits, data points, PAT testing and new consumer unit required. Works to be completed in sections to minimise disruption.",
            PostedById = poster1.Id,
            PaymentTerms = "Paid within 7 days of job completion, confirmed by both parties.",
            Status = "open", CreatedAt = now, UpdatedAt = now,
        };

        var job8 = new Job
        {
            Id = Guid.NewGuid(),
            Title = "Roofing Repair", Trade = "Roofer",
            Location = "York, UK", Postcode = "YO10 3LB",
            Duration = 2, Days = new() { "Th", "F" },
            StartDate = new DateOnly(2026, 2, 27), EndDate = new DateOnly(2026, 2, 28),
            StartTime = "8:00am", EndTime = "4:00pm",
            DayRate = 200,
            Description = "Storm damage repair to a detached property in York. Approximately 12 ridge tiles need repointing or replacing, and 3 sections of broken concrete tiles. Lead flashing around a chimney also needs attention.",
            PostedById = poster2.Id,
            PaymentTerms = "Paid within 7 days of job completion, confirmed by both parties.",
            Status = "open", CreatedAt = now, UpdatedAt = now,
        };

        var job9 = new Job
        {
            Id = Guid.NewGuid(),
            Title = "Extension Groundworks", Trade = "Builder",
            Location = "Leeds, UK", Postcode = "LS8 2HR",
            Duration = 5, Days = new() { "M", "T", "W", "Th", "F" },
            StartDate = new DateOnly(2026, 3, 16), EndDate = new DateOnly(2026, 3, 20),
            StartTime = "7:30am", EndTime = "4:30pm",
            DayRate = 190,
            Description = "Side extension groundworks on a terraced property in Leeds. Strip foundations, drainage connections and concrete slab to DPC level. Builder to supply all blockwork to DPC height.",
            PostedById = poster2.Id,
            PaymentTerms = "Paid within 14 days of job completion, confirmed by both parties.",
            Status = "open", CreatedAt = now, UpdatedAt = now,
        };

        var job10 = new Job
        {
            Id = Guid.NewGuid(),
            Title = "Plastering - New Build", Trade = "Plasterer",
            Location = "Sheffield, UK", Postcode = "S6 1GH",
            Duration = 7, Days = new() { "M", "T", "W", "Th", "F" },
            StartDate = new DateOnly(2026, 3, 23), EndDate = new DateOnly(2026, 3, 31),
            StartTime = "8:00am", EndTime = "4:00pm",
            DayRate = 185,
            Description = "Skim plaster to walls and ceilings throughout a new build 3-bed semi in Sheffield. Approximately 250m2 of skim. Boards are already fixed and taped. All materials supplied. Plasterer to bring own tools.",
            PostedById = poster3.Id,
            PaymentTerms = "Paid within 7 days of job completion, confirmed by both parties.",
            Status = "open", CreatedAt = now, UpdatedAt = now,
        };

        var job11 = new Job
        {
            Id = Guid.NewGuid(),
            Title = "First Fix Joinery", Trade = "Joiner",
            Location = "Harrogate, UK", Postcode = "HG2 0EL",
            Duration = 4, Days = new() { "M", "T", "W", "Th" },
            StartDate = new DateOnly(2026, 3, 9), EndDate = new DateOnly(2026, 3, 12),
            StartTime = "8:00am", EndTime = "5:00pm",
            DayRate = 210,
            Description = "First fix joinery on a 4-bed detached new build in Harrogate. Work includes roof trusses (pre-made, delivery to site), stud partitions, window boards, and all structural timber work. All timber supplied on site.",
            PostedById = poster1.Id,
            PaymentTerms = "Paid within 7 days of job completion, confirmed by both parties.",
            Status = "open", CreatedAt = now, UpdatedAt = now,
        };

        db.Jobs.AddRange(job1, job2, job3, job4, job5, job6, job7, job8, job9, job10, job11);

        await db.SaveChangesAsync();
    }
}
