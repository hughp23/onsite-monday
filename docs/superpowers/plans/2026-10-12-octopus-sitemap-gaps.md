# Octopus Sitemap Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build every page and content block that appears in the Octopus.do sitemap (https://octopus.do/igaujipfuvn) but is missing or only partly built in the app.

**Architecture:** Backend changes follow the existing .NET pattern: domain entity, DTO, repository, service, controller, then an xUnit test for each. Each schema change gets its own EF migration. Frontend changes follow the Expo Router pattern (`frontend/app/` screens, `frontend/src/services/` API clients, `frontend/context/AppContext.tsx` state). Any non-trivial frontend logic goes in a pure function under `frontend/src/utils/` with a Jest test. Screens stay thin and are checked by type-check plus a manual run.

**Tech Stack:** .NET 8 / ASP.NET Core, EF Core (Postgres, SQLite in tests), xUnit + Moq + FluentAssertions; Expo 54 / React Native 0.81 / Expo Router 6 / TypeScript 5.9; Jest via `jest-expo` (added in Task 0).

**Spec:** [`docs/octopus-gap-checklist.md`](../../octopus-gap-checklist.md), section 1. The source diagram is https://octopus.do/igaujipfuvn.

## Decisions to confirm before starting

The diagram leaves these open. Each has a default so work can start, and each lives in **one place** so it's a one-line change if you decide otherwise.

| # | Decision | Default used in this plan | Where it lives |
|---|---|---|---|
| D1 | Monthly job **postings** per tier | Bronze 2, Silver 5, Gold unlimited (matches the copy in `SubscriptionCard`) | `backend/.../Domain/TierLimits.cs` |
| D2 | Monthly job **applications** per tier | Bronze 10, Silver 30, Gold unlimited | `TierLimits.cs` |
| D3 | Usage period | Calendar month, UTC. A user with no active subscription gets Bronze limits (same as `SubscriptionsController.GetCurrent`). | `TierLimits.CurrentPeriodStart` |
| D4 | What "Hire Now" does from a profile | Invites the tradesperson to apply to one of the poster's open jobs (sends a notification). Hiring itself still happens on the applicants screen, which keeps the Stripe escrow flow intact. | Task 4 |
| D5 | Application form fields | One optional cover note, 1,000 characters max | Task 6 |
| D6 | Featured jobs | Open jobs not posted by the viewer, in the viewer's trade first, then highest day rate. Top 5. | `frontend/src/utils/featuredJobs.ts` |
| D7 | Dashboard | A new **Home** tab, placed first. After sign-in, users land on Home instead of Jobs. | Task 13 |
| D8 | Message categories | All / Unread / Job chats (conversations linked to a job) | `frontend/src/utils/conversationFilters.ts` |
| D9 | Notification preferences | One toggle: message push notifications. Only chat messages send push today, so other toggles would do nothing. | Task 17 |

**Out of scope:** the marketing website and landing page (separate web project), and breadcrumbs / "Go back" (the native header back button covers these).

## Global Constraints

- App name is **Onsite Monday** / **OM**. Never use the circumflex (Ô) in UI copy, code or comments.
- Brand colours come from `frontend/constants/colors.ts` only (`colors.primary` `#8B2020`, `colors.accent` `#D4A843`, `colors.background` `#FFF8F6`). Don't hard-code hex values in new screens.
- UK English in all copy ("organise", "£").
- Keep tier logic centralised. Backend limits live only in `TierLimits.cs`. The frontend reads limits from `GET /api/subscriptions/usage` and never hard-codes them.
- Every screen must consider the active role (Tradesperson vs Job Poster). Applications are a tradesperson action and postings are a poster action.
- Every schema change ships with an EF migration made by `dotnet ef migrations add <Name> --project backend/src/OnsiteMonday.Api`.
- Per CLAUDE.md, update `docs/journeys/user-journeys.html` after any change to a user-facing flow (Task 20).
- Backend tests: `cd backend && dotnet test`. Frontend checks: `cd frontend && npx jest && npx tsc --noEmit`.

## Review Focus

1. **Month rollover.** A job posted at 23:59 UTC on the 31st counts against that month, and the count resets at 00:00 UTC on the 1st. *(Task 1 test `CurrentPeriodStart_*`)*
2. **No active subscription.** A user with no subscription row gets Bronze limits, not unlimited and not a crash. *(Task 1 test `ApplicationsPerMonth_NullTier_IsBronze`, Task 2 test `GetUsage_NoSubscription_ReturnsBronzeLimits`)*
3. **Re-applying at the limit.** Applying again to a job you've already applied to is idempotent. It must not throw at the limit or use up another application. *(Task 1 test `ApplyToJob_AlreadyApplied_AtLimit_DoesNotThrow`)*
4. **Gallery cap.** At 12 images the add tile is hidden, and the backend rejects a 13th URL. *(Task 8 validator test, Task 9 util test)*
5. **Duplicate rows on load more.** A job posted between page loads shifts the pages, so the same job can arrive twice. Merging must dedupe by id. *(Task 11 `mergePage` test)*

---

## File Structure

**Backend (new)**
- `backend/src/OnsiteMonday.Api/Domain/TierLimits.cs`: per-tier monthly limits and period maths
- `backend/src/OnsiteMonday.Api/Domain/TierLimitExceededException.cs`: mapped to HTTP 402
- `backend/src/OnsiteMonday.Api/Services/Interfaces/IUsageService.cs`, `Services/UsageService.cs`: counts usage and enforces limits
- `backend/src/OnsiteMonday.Api/DTOs/Subscriptions/UsageDto.cs`
- `backend/src/OnsiteMonday.Api/DTOs/Jobs/InviteToJobRequest.cs`, `DTOs/Jobs/ApplyToJobRequest.cs`
- `backend/src/OnsiteMonday.Api/Validators/ApplyToJobRequestValidator.cs`
- `backend/src/OnsiteMonday.Api/DTOs/Users/GalleryImageUploadUrlResponse.cs` (reuses `ProfileImageUploadUrlResponse`'s shape; see Task 8)
- Migrations: `AddApplicationCoverNote`, `AddUserBio`, `AddMutedNotificationTypes`
- Tests: `Unit/TierLimitsTests.cs`, `Unit/Services/UsageServiceTests.cs`, `Integration/SubscriptionUsageTests.cs`, plus additions to existing test files

**Frontend (new)**
- `frontend/src/utils/`: `tierUsage.ts`, `featuredJobs.ts`, `pagination.ts`, `profileCompleteness.ts`, `likedJobs.ts`, `gallery.ts`, `conversationFilters.ts`, `notificationRoute.ts`, each with a `__tests__/*.test.ts`
- `frontend/src/services/usageService.ts`
- `frontend/constants/tiers.ts`: tier display info moved out of `SubscriptionCard.tsx`
- `frontend/components/UsageBanner.tsx`, `HireModal.tsx`, `FeaturedJobsStrip.tsx`, `InfoCard.tsx`
- Screens: `frontend/app/(tabs)/home.tsx`, `frontend/app/apply/[id].tsx`, `frontend/app/notification-settings.tsx`, `frontend/app/faqs.tsx`, `frontend/app/+not-found.tsx`

---

### Task 0: Frontend Jest setup

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/utils/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: `npx jest` runs `*.test.ts` under `frontend/`, with the `@/` alias mapped to `frontend/`.

- [ ] **Step 1: Install Jest**

```bash
cd frontend && npx expo install jest-expo jest @types/jest -- --save-dev
```

- [ ] **Step 2: Add config and script to `frontend/package.json`**

Add to `"scripts"`:
```json
"test": "jest"
```
Add a top-level key:
```json
"jest": {
  "preset": "jest-expo",
  "moduleNameMapper": { "^@/(.*)$": "<rootDir>/$1" },
  "testPathIgnorePatterns": ["/node_modules/", "/android/", "/ios/"]
}
```

- [ ] **Step 3: Write a smoke test**

`frontend/src/utils/__tests__/smoke.test.ts`:
```ts
import { colors } from '@/constants/colors';

test('alias resolves', () => {
  expect(colors.primary).toBe('#8B2020');
});
```

- [ ] **Step 4: Run it**

Run: `cd frontend && npx jest`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/utils/__tests__/smoke.test.ts
git commit -m "chore: add jest-expo for frontend unit tests"
```

---

## Phase 1: Subscription usage limits

### Task 1: Tier limits and enforcement on post/apply (backend)

**Files:**
- Create: `backend/src/OnsiteMonday.Api/Domain/TierLimits.cs`
- Create: `backend/src/OnsiteMonday.Api/Domain/TierLimitExceededException.cs`
- Create: `backend/src/OnsiteMonday.Api/Services/Interfaces/IUsageService.cs`
- Create: `backend/src/OnsiteMonday.Api/Services/UsageService.cs`
- Modify: `backend/src/OnsiteMonday.Api/Repositories/Interfaces/IJobRepository.cs`
- Modify: `backend/src/OnsiteMonday.Api/Repositories/JobRepository.cs`
- Modify: `backend/src/OnsiteMonday.Api/Services/JobService.cs` (constructor, `CreateJobAsync`, `ApplyToJobAsync`)
- Modify: `backend/src/OnsiteMonday.Api/Middleware/ErrorHandlingMiddleware.cs`
- Modify: `backend/src/OnsiteMonday.Api/Program.cs` (DI)
- Test: `backend/tests/OnsiteMonday.Api.Tests/Unit/TierLimitsTests.cs`, `Unit/Services/UsageServiceTests.cs`, `Unit/Services/JobServiceTests.cs`

**Interfaces:**
- Produces:
  - `TierLimits.PostsPerMonth(string? tier) : int?` (null means unlimited)
  - `TierLimits.ApplicationsPerMonth(string? tier) : int?`
  - `TierLimits.CurrentPeriodStart(DateTimeOffset now) : DateTimeOffset`
  - `IUsageService.GetUsageAsync(Guid userId) : Task<UsageDto>` (`UsageDto` is defined in this task and served by Task 2)
  - `IUsageService.EnsureCanPostAsync(Guid userId) : Task` and `EnsureCanApplyAsync(Guid userId) : Task`, which throw `TierLimitExceededException`
  - `IJobRepository.CountJobsPostedSinceAsync(Guid posterId, DateTimeOffset since) : Task<int>`
  - `IJobRepository.CountApplicationsSinceAsync(Guid applicantId, DateTimeOffset since) : Task<int>`
  - HTTP 402 with body `{ "error": "<message>" }` when a limit is hit

- [ ] **Step 1: Write failing `TierLimits` tests**

`backend/tests/OnsiteMonday.Api.Tests/Unit/TierLimitsTests.cs`:
```csharp
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
```

- [ ] **Step 2: Run and confirm they fail**

Run: `cd backend && dotnet test --filter "FullyQualifiedName~TierLimitsTests"`
Expected: build error, `TierLimits` does not exist.

- [ ] **Step 3: Implement `TierLimits` and the exception**

`backend/src/OnsiteMonday.Api/Domain/TierLimits.cs`:
```csharp
namespace OnsiteMonday.Api.Domain;

/// <summary>
/// Single source of truth for per-tier monthly usage limits.
/// null = unlimited. Unknown or missing tier falls back to bronze.
/// </summary>
public static class TierLimits
{
    private static readonly Dictionary<string, (int? Posts, int? Applications)> ByTier = new()
    {
        ["bronze"] = (2, 10),
        ["silver"] = (5, 30),
        ["gold"]   = (null, null),
    };

    private static (int? Posts, int? Applications) For(string? tier) =>
        tier != null && ByTier.TryGetValue(tier, out var limits) ? limits : ByTier["bronze"];

    public static int? PostsPerMonth(string? tier) => For(tier).Posts;
    public static int? ApplicationsPerMonth(string? tier) => For(tier).Applications;

    public static DateTimeOffset CurrentPeriodStart(DateTimeOffset now)
    {
        var utc = now.ToUniversalTime();
        return new DateTimeOffset(utc.Year, utc.Month, 1, 0, 0, 0, TimeSpan.Zero);
    }
}
```

`backend/src/OnsiteMonday.Api/Domain/TierLimitExceededException.cs`:
```csharp
namespace OnsiteMonday.Api.Domain;

public class TierLimitExceededException : InvalidOperationException
{
    public TierLimitExceededException(string message) : base(message) { }
}
```

- [ ] **Step 4: Run the `TierLimits` tests**

Run: `cd backend && dotnet test --filter "FullyQualifiedName~TierLimitsTests"`
Expected: all pass.

- [ ] **Step 5: Add the repository count methods**

In `IJobRepository.cs`, under `// Review block checks`:
```csharp
    // Tier usage counts (calendar-month window supplied by caller)
    Task<int> CountJobsPostedSinceAsync(Guid posterId, DateTimeOffset since);
    Task<int> CountApplicationsSinceAsync(Guid applicantId, DateTimeOffset since);
```

In `JobRepository.cs`:
```csharp
    public Task<int> CountJobsPostedSinceAsync(Guid posterId, DateTimeOffset since) =>
        _db.Jobs.CountAsync(j => j.PostedById == posterId && j.CreatedAt >= since);

    // "interested" is a like, not an application, so it doesn't count
    public Task<int> CountApplicationsSinceAsync(Guid applicantId, DateTimeOffset since) =>
        _db.JobApplications.CountAsync(a =>
            a.ApplicantId == applicantId && a.Status != "interested" && a.AppliedAt >= since);
```

Deleted jobs disappear from the count. That's acceptable: deleting is only allowed while a job has no hire.

- [ ] **Step 6: Write failing `UsageService` tests**

First create `backend/src/OnsiteMonday.Api/DTOs/Subscriptions/UsageDto.cs`:
```csharp
namespace OnsiteMonday.Api.DTOs.Subscriptions;

public class UsageDto
{
    public string Tier { get; set; } = "bronze";
    public int PostsUsed { get; set; }
    public int? PostsLimit { get; set; }          // null = unlimited
    public int ApplicationsUsed { get; set; }
    public int? ApplicationsLimit { get; set; }   // null = unlimited
    public DateTimeOffset PeriodStart { get; set; }
    public DateTimeOffset PeriodEnd { get; set; }
}
```

`backend/tests/OnsiteMonday.Api.Tests/Unit/Services/UsageServiceTests.cs`:
```csharp
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
```

- [ ] **Step 7: Run and confirm they fail**

Run: `cd backend && dotnet test --filter "FullyQualifiedName~UsageServiceTests"`
Expected: build error, `UsageService` does not exist.

- [ ] **Step 8: Implement `UsageService`**

`backend/src/OnsiteMonday.Api/Services/Interfaces/IUsageService.cs`:
```csharp
using OnsiteMonday.Api.DTOs.Subscriptions;

namespace OnsiteMonday.Api.Services;

public interface IUsageService
{
    Task<UsageDto> GetUsageAsync(Guid userId);
    Task EnsureCanPostAsync(Guid userId);
    Task EnsureCanApplyAsync(Guid userId);
}
```

`backend/src/OnsiteMonday.Api/Services/UsageService.cs`:
```csharp
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.DTOs.Subscriptions;
using OnsiteMonday.Api.Repositories;

namespace OnsiteMonday.Api.Services;

public class UsageService : IUsageService
{
    private readonly IJobRepository _jobRepo;
    private readonly IUserRepository _userRepo;

    public UsageService(IJobRepository jobRepo, IUserRepository userRepo)
    {
        _jobRepo = jobRepo;
        _userRepo = userRepo;
    }

    public async Task<UsageDto> GetUsageAsync(Guid userId)
    {
        var user = await _userRepo.GetByIdAsync(userId)
            ?? throw new KeyNotFoundException("User not found.");
        var tier = user.ActiveSubscription?.Tier ?? "bronze";
        var periodStart = TierLimits.CurrentPeriodStart(DateTimeOffset.UtcNow);

        return new UsageDto
        {
            Tier = tier,
            PostsUsed = await _jobRepo.CountJobsPostedSinceAsync(userId, periodStart),
            PostsLimit = TierLimits.PostsPerMonth(tier),
            ApplicationsUsed = await _jobRepo.CountApplicationsSinceAsync(userId, periodStart),
            ApplicationsLimit = TierLimits.ApplicationsPerMonth(tier),
            PeriodStart = periodStart,
            PeriodEnd = periodStart.AddMonths(1),
        };
    }

    public async Task EnsureCanPostAsync(Guid userId)
    {
        var usage = await GetUsageAsync(userId);
        if (usage.PostsLimit is int limit && usage.PostsUsed >= limit)
            throw new TierLimitExceededException(
                $"You've used all {limit} job posts on your {Capitalise(usage.Tier)} plan this month. Upgrade to post more.");
    }

    public async Task EnsureCanApplyAsync(Guid userId)
    {
        var usage = await GetUsageAsync(userId);
        if (usage.ApplicationsLimit is int limit && usage.ApplicationsUsed >= limit)
            throw new TierLimitExceededException(
                $"You've used all {limit} applications on your {Capitalise(usage.Tier)} plan this month. Upgrade to apply for more jobs.");
    }

    private static string Capitalise(string s) => char.ToUpperInvariant(s[0]) + s[1..];
}
```

- [ ] **Step 9: Run the `UsageService` tests**

Run: `cd backend && dotnet test --filter "FullyQualifiedName~UsageServiceTests"`
Expected: all pass.

- [ ] **Step 10: Write failing `JobService` enforcement tests**

In `JobServiceTests.cs`, add a field `private readonly Mock<IUsageService> _usageMock = new();` and change the constructor's last line to:
```csharp
        _sut = new JobService(_jobRepoMock.Object, _userRepoMock.Object, _notificationRepoMock.Object, _stripeConnectMock.Object, _backgroundJobsMock.Object, _usageMock.Object, _mapper);
```
Add the tests:
```csharp
    [Fact]
    public async Task CreateJob_AtPostLimit_ThrowsAndDoesNotCreate()
    {
        var poster = TestBuilders.MakeUser();
        _usageMock.Setup(u => u.EnsureCanPostAsync(poster.Id))
            .ThrowsAsync(new TierLimitExceededException("limit"));

        var act = () => _sut.CreateJobAsync(poster.Id, new CreateJobRequest { Title = "x", Trade = "Builder", Location = "York", Postcode = "YO1 1AA", Duration = 1, Days = new() { "M" }, StartTime = "08:00", EndTime = "17:00", DayRate = 100, PaymentTerms = "7 days" });

        await act.Should().ThrowAsync<TierLimitExceededException>();
        _jobRepoMock.Verify(r => r.CreateAsync(It.IsAny<Job>()), Times.Never);
    }

    [Fact]
    public async Task ApplyToJob_AtLimit_NewApplication_Throws()
    {
        var poster = TestBuilders.MakeUser();
        var applicantId = Guid.NewGuid();
        var job = TestBuilders.MakeJob(poster.Id);
        _jobRepoMock.Setup(r => r.GetByIdAsync(job.Id, applicantId)).ReturnsAsync((job, false, 0));
        _jobRepoMock.Setup(r => r.GetApplicationAsync(job.Id, applicantId)).ReturnsAsync((JobApplication?)null);
        _usageMock.Setup(u => u.EnsureCanApplyAsync(applicantId)).ThrowsAsync(new TierLimitExceededException("limit"));

        await _sut.Invoking(s => s.ApplyToJobAsync(job.Id, applicantId))
            .Should().ThrowAsync<TierLimitExceededException>();
        _jobRepoMock.Verify(r => r.AddApplicationAsync(It.IsAny<JobApplication>()), Times.Never);
    }

    [Fact]
    public async Task ApplyToJob_AlreadyApplied_AtLimit_DoesNotThrow()
    {
        var poster = TestBuilders.MakeUser();
        var applicantId = Guid.NewGuid();
        var job = TestBuilders.MakeJob(poster.Id);
        _jobRepoMock.Setup(r => r.GetByIdAsync(job.Id, applicantId)).ReturnsAsync((job, true, 1));
        _jobRepoMock.Setup(r => r.GetApplicationAsync(job.Id, applicantId))
            .ReturnsAsync(new JobApplication { JobId = job.Id, ApplicantId = applicantId, Status = "applied" });
        _usageMock.Setup(u => u.EnsureCanApplyAsync(applicantId)).ThrowsAsync(new TierLimitExceededException("limit"));

        await _sut.Invoking(s => s.ApplyToJobAsync(job.Id, applicantId)).Should().NotThrowAsync();
    }

    [Fact]
    public async Task ApplyToJob_FromInterested_ResetsAppliedAtToNow()
    {
        var poster = TestBuilders.MakeUser();
        var applicantId = Guid.NewGuid();
        var job = TestBuilders.MakeJob(poster.Id);
        var liked = new JobApplication { JobId = job.Id, ApplicantId = applicantId, Status = "interested", AppliedAt = DateTimeOffset.UtcNow.AddMonths(-2) };
        _jobRepoMock.Setup(r => r.GetByIdAsync(job.Id, applicantId)).ReturnsAsync((job, true, 1));
        _jobRepoMock.Setup(r => r.GetApplicationAsync(job.Id, applicantId)).ReturnsAsync(liked);

        await _sut.ApplyToJobAsync(job.Id, applicantId);

        liked.AppliedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(5));
    }
```
(Add `using OnsiteMonday.Api.Services;` if it isn't already imported. `TierLimitExceededException` lives in `OnsiteMonday.Api.Domain`, which is already imported.)

- [ ] **Step 11: Run and confirm they fail**

Run: `cd backend && dotnet test --filter "FullyQualifiedName~JobServiceTests"`
Expected: build error, because the `JobService` constructor doesn't take `IUsageService` yet.

- [ ] **Step 12: Wire `IUsageService` into `JobService`**

In `JobService.cs`, add the field `private readonly IUsageService _usage;`. Then add an `IUsageService usage` parameter to the constructor just before `IMapper mapper`, and assign `_usage = usage;`.

In `CreateJobAsync`, after the outstanding-review check:
```csharp
        await _usage.EnsureCanPostAsync(posterId);
```

In `ApplyToJobAsync`, replace the block from `var existing = ...` through the closing `}` of the `else if` with:
```csharp
        var existing = await _jobRepo.GetApplicationAsync(jobId, userId);
        var isNewApplication = existing == null || existing.Status == "interested";

        // Only a brand-new application uses up the monthly allowance; re-applying is idempotent
        if (isNewApplication)
            await _usage.EnsureCanApplyAsync(userId);

        if (existing == null)
        {
            await _jobRepo.AddApplicationAsync(new JobApplication
            {
                Id = Guid.NewGuid(),
                JobId = jobId,
                ApplicantId = userId,
                Status = "applied",
                AppliedAt = DateTimeOffset.UtcNow,
            });
        }
        else if (existing.Status == "interested")
        {
            existing.Status = "applied";
            existing.AppliedAt = DateTimeOffset.UtcNow; // count against the month of applying, not of liking
            await _jobRepo.UpdateApplicationAsync(existing);
        }
        // Already applied or accepted — idempotent, do nothing
```
Then change the notification guard below it from `if (existing == null || existing.Status == "interested")` to `if (isNewApplication)`. The guard has to use the flag because `existing.Status` has already been changed to "applied" by this point.

> Note: the original code had the same mutation-before-check bug, so the "new application" notification never fired on the interested → applied path. Using `isNewApplication` fixes that too.

- [ ] **Step 13: Register the service in DI and map the exception**

In `Program.cs`, next to `AddScoped<IJobService, JobService>()`:
```csharp
builder.Services.AddScoped<IUsageService, UsageService>();
```

In `ErrorHandlingMiddleware.cs`, add this catch **before** the `InvalidOperationException` catch, because `TierLimitExceededException` is a subclass of it:
```csharp
        catch (TierLimitExceededException ex)
        {
            await WriteErrorAsync(context, HttpStatusCode.PaymentRequired, ex.Message);
        }
```
Add `using OnsiteMonday.Api.Domain;`.

- [ ] **Step 14: Run the full backend suite**

Run: `cd backend && dotnet test`
Expected: all pass. If any integration test creates more than 2 jobs or 10 applications as one Bronze test user, seed a Gold subscription for that user in the test's arrange step. Don't raise the limits to make tests pass.

- [ ] **Step 15: Commit**

```bash
git add backend
git commit -m "feat: enforce monthly post/application limits per subscription tier"
```

---

### Task 2: Usage endpoint (backend)

**Files:**
- Modify: `backend/src/OnsiteMonday.Api/Controllers/SubscriptionsController.cs`
- Test: `backend/tests/OnsiteMonday.Api.Tests/Integration/SubscriptionUsageTests.cs`

**Interfaces:**
- Consumes: `IUsageService.GetUsageAsync` (Task 1)
- Produces: `GET /api/subscriptions/usage` returns `UsageDto` as camelCase JSON: `{ tier, postsUsed, postsLimit, applicationsUsed, applicationsLimit, periodStart, periodEnd }`

- [ ] **Step 1: Write a failing integration test**

`backend/tests/OnsiteMonday.Api.Tests/Integration/SubscriptionUsageTests.cs`:
```csharp
using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using OnsiteMonday.Api.DTOs.Subscriptions;
using OnsiteMonday.Api.Tests.Infrastructure;

namespace OnsiteMonday.Api.Tests.Integration;

public class SubscriptionUsageTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public SubscriptionUsageTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateAuthenticatedClient();
    }

    public async Task InitializeAsync()
    {
        await _factory.SeedAsync(async db =>
        {
            if (!db.Users.Any(u => u.CognitoSub == FakeAuthHandler.TestFirebaseUid))
            {
                db.Users.Add(TestBuilders.MakeUser());
                await db.SaveChangesAsync();
            }
        });
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task GetUsage_Returns200WithLimits()
    {
        var response = await _client.GetAsync("/api/subscriptions/usage");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var usage = await response.Content.ReadFromJsonAsync<UsageDto>();
        usage!.PeriodEnd.Should().BeAfter(usage.PeriodStart);
        usage.PostsUsed.Should().BeGreaterThanOrEqualTo(0);
    }
}
```

- [ ] **Step 2: Run and confirm it fails**

Run: `cd backend && dotnet test --filter "FullyQualifiedName~SubscriptionUsageTests"`
Expected: FAIL with 404 Not Found (route not found).

- [ ] **Step 3: Add the endpoint**

In `SubscriptionsController.cs`, inject `IUsageService usageService` into the constructor (store it as `_usageService`) and add:
```csharp
    // GET /api/subscriptions/usage
    [HttpGet("usage")]
    public async Task<ActionResult<UsageDto>> GetUsage()
    {
        var userId = await GetCurrentUserIdAsync();
        return Ok(await _usageService.GetUsageAsync(userId));
    }
```

- [ ] **Step 4: Run the test**

Run: `cd backend && dotnet test --filter "FullyQualifiedName~SubscriptionUsageTests"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "feat: add GET /api/subscriptions/usage"
```

---

### Task 3: Usage banners and upgrade prompts (frontend)

**Files:**
- Create: `frontend/src/utils/tierUsage.ts`, `frontend/src/utils/__tests__/tierUsage.test.ts`
- Create: `frontend/src/services/usageService.ts`
- Create: `frontend/constants/tiers.ts`
- Create: `frontend/components/UsageBanner.tsx`
- Modify: `frontend/components/SubscriptionCard.tsx` (import `TIER_INFO` from `constants/tiers.ts`)
- Modify: `frontend/context/AppContext.tsx` (`usage`, `refreshUsage`)
- Modify: `frontend/app/(tabs)/jobs.tsx`, `frontend/app/(tabs)/my-jobs.tsx`, `frontend/app/create-job.tsx`

**Interfaces:**
- Consumes: `GET /api/subscriptions/usage` (Task 2)
- Produces:
  - `type Usage = { tier: SubscriptionTier; postsUsed: number; postsLimit: number | null; applicationsUsed: number; applicationsLimit: number | null; periodEnd: string }`
  - `usageBannerText(usage: Usage | null, kind: UsageKind): string | null`
  - `isAtLimit(usage: Usage | null, kind: UsageKind): boolean`, with `UsageKind = 'posts' | 'applications'`
  - In AppContext: `usage: Usage | null` and `refreshUsage(): Promise<void>`
  - `<UsageBanner kind="posts" | "applications" />`
  - `TIER_INFO` exported from `@/constants/tiers`

- [ ] **Step 1: Write failing util tests**

`frontend/src/utils/__tests__/tierUsage.test.ts`:
```ts
import { usageBannerText, isAtLimit, Usage } from '@/src/utils/tierUsage';

const base: Usage = {
  tier: 'bronze', postsUsed: 0, postsLimit: 2,
  applicationsUsed: 0, applicationsLimit: 10, periodEnd: '2026-11-01T00:00:00Z',
};

describe('usageBannerText', () => {
  it('shows remaining applications', () => {
    expect(usageBannerText({ ...base, applicationsUsed: 7 }, 'applications'))
      .toBe('3 of 10 applications left this month');
  });
  it('uses singular for one post left', () => {
    expect(usageBannerText({ ...base, postsUsed: 1 }, 'posts'))
      .toBe('1 of 2 job posts left this month');
  });
  it('prompts upgrade at the limit', () => {
    expect(usageBannerText({ ...base, postsUsed: 2 }, 'posts'))
      .toBe("You've used all 2 job posts this month. Upgrade to post more.");
  });
  it('returns null when unlimited', () => {
    expect(usageBannerText({ ...base, tier: 'gold', postsLimit: null }, 'posts')).toBeNull();
  });
  it('returns null before usage has loaded', () => {
    expect(usageBannerText(null, 'posts')).toBeNull();
  });
});

describe('isAtLimit', () => {
  it('is true when used equals limit', () => {
    expect(isAtLimit({ ...base, applicationsUsed: 10 }, 'applications')).toBe(true);
  });
  it('is false when unlimited', () => {
    expect(isAtLimit({ ...base, applicationsLimit: null, applicationsUsed: 999 }, 'applications')).toBe(false);
  });
  it('is false before usage has loaded', () => {
    expect(isAtLimit(null, 'posts')).toBe(false);
  });
});
```

- [ ] **Step 2: Run and confirm they fail**

Run: `cd frontend && npx jest tierUsage`
Expected: FAIL, cannot find module `@/src/utils/tierUsage`.

- [ ] **Step 3: Implement the util**

`frontend/src/utils/tierUsage.ts`:
```ts
import { SubscriptionTier } from '@/constants/types';

export type UsageKind = 'posts' | 'applications';

export interface Usage {
  tier: SubscriptionTier;
  postsUsed: number;
  postsLimit: number | null;        // null = unlimited
  applicationsUsed: number;
  applicationsLimit: number | null; // null = unlimited
  periodEnd: string;
}

function counts(usage: Usage, kind: UsageKind) {
  return kind === 'posts'
    ? { used: usage.postsUsed, limit: usage.postsLimit, noun: 'job posts', verb: 'post more' }
    : { used: usage.applicationsUsed, limit: usage.applicationsLimit, noun: 'applications', verb: 'apply for more jobs' };
}

export function isAtLimit(usage: Usage | null, kind: UsageKind): boolean {
  if (!usage) return false;
  const { used, limit } = counts(usage, kind);
  return limit !== null && used >= limit;
}

export function usageBannerText(usage: Usage | null, kind: UsageKind): string | null {
  if (!usage) return null;
  const { used, limit, noun, verb } = counts(usage, kind);
  if (limit === null) return null;
  if (used >= limit) return `You've used all ${limit} ${noun} this month. Upgrade to ${verb}.`;
  return `${limit - used} of ${limit} ${noun} left this month`;
}
```

- [ ] **Step 4: Run the util tests**

Run: `cd frontend && npx jest tierUsage`
Expected: all pass.

- [ ] **Step 5: Add the service and AppContext state**

`frontend/src/services/usageService.ts`:
```ts
import { apiRequest } from './api';
import { Usage } from '@/src/utils/tierUsage';

export const usageService = {
  get: (): Promise<Usage> => apiRequest<Usage>('GET', '/subscriptions/usage'),
};
```

In `AppContext.tsx`:
- Add `usage: Usage | null;` and `refreshUsage: () => Promise<void>;` to the context type.
- Add `const [usage, setUsage] = useState<Usage | null>(null);`
- Add:
  ```ts
  const refreshUsage = useCallback(async () => {
    try { setUsage(await usageService.get()); } catch { /* banner just stays hidden */ }
  }, []);
  ```
- Call `refreshUsage()` wherever the initial data load runs (next to `call('getJobs', ...)`). Also call it at the end of `applyToJob`, `addJob` and `updateSubscription`, after they succeed.
- Add `usage` and `refreshUsage` to the provider value.

- [ ] **Step 6: Move tier display info into `constants/tiers.ts`**

Cut the `TIER_INFO` object from `components/SubscriptionCard.tsx` into `frontend/constants/tiers.ts`, export it, and add an `applications` field to each tier:
```ts
import { SubscriptionTier } from './types';

export const TIER_INFO: Record<SubscriptionTier, {
  name: string;
  price: string;
  paymentDays: string;
  posts: string;
  applications: string;
  features: string[];
  popular?: boolean;
}> = {
  bronze: { name: 'Bronze', price: '£29', paymentDays: '30 days', posts: '2 per month', applications: '10 per month',
    features: ['Basic invoice tools', 'Standard reporting', 'Email support'] },
  silver: { name: 'Silver', price: '£59', paymentDays: '14 days', posts: 'Up to 5 per month', applications: '30 per month', popular: true,
    features: ['Invoice tools', 'Analytics dashboard', 'Priority support'] },
  gold: { name: 'Gold', price: '£129', paymentDays: '7 days', posts: 'Unlimited', applications: 'Unlimited',
    features: ['Advanced invoicing', 'Discounted insurance', 'Compliance tracking', 'Dedicated support'] },
};
```
In `SubscriptionCard.tsx`, import it with `import { TIER_INFO } from '@/constants/tiers';`. Wherever the card renders the `info.posts` row, render a matching row for `info.applications`, labelled "Applications".

The Bronze copy changes from "1-2 per month" to "2 per month" so it matches the enforced limit (D1).

- [ ] **Step 7: Create `UsageBanner`**

`frontend/components/UsageBanner.tsx`:
```tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { usageBannerText, isAtLimit, UsageKind } from '@/src/utils/tierUsage';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';

export default function UsageBanner({ kind }: { kind: UsageKind }) {
  const { usage } = useApp();
  const text = usageBannerText(usage, kind);
  if (!text) return null;
  const atLimit = isAtLimit(usage, kind);

  return (
    <TouchableOpacity
      style={[styles.banner, atLimit && styles.bannerLimit]}
      onPress={() => router.push('/subscription')}
      activeOpacity={0.85}
    >
      <MaterialCommunityIcons name={atLimit ? 'lock-outline' : 'information-outline'} size={16} color={atLimit ? colors.white : colors.primary} />
      <Text style={[styles.text, atLimit && styles.textLimit]}>{text}</Text>
      <Text style={[styles.cta, atLimit && styles.textLimit]}>Upgrade</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, backgroundColor: colors.chipBg,
  },
  bannerLimit: { backgroundColor: colors.primary },
  text: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  textLimit: { color: colors.white },
  cta: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.primary },
});
```
(Check that `fonts.bodyMedium` and `fonts.bodyBold` exist in `constants/typography.ts`. `app/(tabs)/_layout.tsx` already uses both.)

- [ ] **Step 8: Place the banners**

- `app/(tabs)/jobs.tsx`: render `<UsageBanner kind="applications" />` directly above the sort/filter bar (`{/* Sort + filter bar */}`).
- `app/(tabs)/my-jobs.tsx`: directly below the segmented control's closing `</View>`, add:
  ```tsx
  <UsageBanner kind={activeTab === 'posted' ? 'posts' : 'applications'} />
  ```
- `app/(tabs)/my-jobs.tsx` Posted tab upgrade prompt: change the FAB's `onPress` to
  ```tsx
  onPress={() => isAtLimit(usage, 'posts') ? router.push('/subscription') : router.push('/create-job')}
  ```
  and pull `usage` from `useApp()`.
- `app/create-job.tsx`: at the top of the scroll content, render `<UsageBanner kind="posts" />`. Disable the submit button when `isAtLimit(usage, 'posts')`.

- [ ] **Step 9: Type-check and run**

Run: `cd frontend && npx tsc --noEmit && npx jest`
Expected: no type errors, and all tests pass.

Manual check (`npm run dev`), signed in as a Bronze user:
1. The Jobs tab shows "10 of 10 applications left this month".
2. Apply to a job. The banner shows 9.
3. Posted tab, after posting 2 jobs: the banner turns dark red, and the + button opens Subscription.

- [ ] **Step 10: Commit**

```bash
git add frontend
git commit -m "feat: show monthly usage banners and upgrade prompts"
```

---

## Phase 2: Hire Now

### Task 4: Invite a tradesperson to apply (backend)

**Files:**
- Create: `backend/src/OnsiteMonday.Api/DTOs/Jobs/InviteToJobRequest.cs`
- Modify: `backend/src/OnsiteMonday.Api/Services/Interfaces/IJobService.cs`, `Services/JobService.cs`, `Controllers/JobsController.cs`
- Test: `backend/tests/OnsiteMonday.Api.Tests/Unit/Services/JobServiceTests.cs`

**Interfaces:**
- Produces: `POST /api/jobs/{id}/invite` with body `{ "tradespersonId": "<guid>" }` returns 204. It creates a `Notification` with `Type = "job_invite"` and `LinkedId = jobId` for the tradesperson.
- `IJobService.InviteToJobAsync(Guid jobId, Guid posterId, Guid tradespersonId) : Task`

- [ ] **Step 1: Write failing tests**

Add to `JobServiceTests.cs`:
```csharp
    [Fact]
    public async Task InviteToJob_CreatesJobInviteNotification()
    {
        var poster = TestBuilders.MakeUser(firstName: "Pat");
        var tradie = TestBuilders.MakeUser(firebaseUid: "tp", email: "tp@test.com");
        var job = TestBuilders.MakeJob(poster.Id);
        _jobRepoMock.Setup(r => r.GetByIdRawAsync(job.Id)).ReturnsAsync(job);
        _userRepoMock.Setup(r => r.GetByIdAsync(tradie.Id)).ReturnsAsync(tradie);
        _userRepoMock.Setup(r => r.GetByIdAsync(poster.Id)).ReturnsAsync(poster);

        await _sut.InviteToJobAsync(job.Id, poster.Id, tradie.Id);

        _notificationRepoMock.Verify(r => r.CreateAsync(It.Is<Notification>(n =>
            n.UserId == tradie.Id && n.Type == "job_invite" && n.LinkedId == job.Id)), Times.Once);
    }

    [Fact]
    public async Task InviteToJob_NotPoster_Throws()
    {
        var job = TestBuilders.MakeJob(Guid.NewGuid());
        _jobRepoMock.Setup(r => r.GetByIdRawAsync(job.Id)).ReturnsAsync(job);

        await _sut.Invoking(s => s.InviteToJobAsync(job.Id, Guid.NewGuid(), Guid.NewGuid()))
            .Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task InviteToJob_JobNotOpen_Throws()
    {
        var poster = TestBuilders.MakeUser();
        var job = TestBuilders.MakeJob(poster.Id, status: "accepted");
        _jobRepoMock.Setup(r => r.GetByIdRawAsync(job.Id)).ReturnsAsync(job);

        await _sut.Invoking(s => s.InviteToJobAsync(job.Id, poster.Id, Guid.NewGuid()))
            .Should().ThrowAsync<InvalidOperationException>().WithMessage("*no longer open*");
    }

    [Fact]
    public async Task InviteToJob_Self_Throws()
    {
        var poster = TestBuilders.MakeUser();
        var job = TestBuilders.MakeJob(poster.Id);
        _jobRepoMock.Setup(r => r.GetByIdRawAsync(job.Id)).ReturnsAsync(job);

        await _sut.Invoking(s => s.InviteToJobAsync(job.Id, poster.Id, poster.Id))
            .Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task InviteToJob_AlreadyApplied_Throws()
    {
        var poster = TestBuilders.MakeUser();
        var tradieId = Guid.NewGuid();
        var job = TestBuilders.MakeJob(poster.Id);
        _jobRepoMock.Setup(r => r.GetByIdRawAsync(job.Id)).ReturnsAsync(job);
        _userRepoMock.Setup(r => r.GetByIdAsync(tradieId)).ReturnsAsync(TestBuilders.MakeUser(id: tradieId, firebaseUid: "x", email: "x@test.com"));
        _jobRepoMock.Setup(r => r.GetApplicationAsync(job.Id, tradieId))
            .ReturnsAsync(new JobApplication { Status = "applied" });

        await _sut.Invoking(s => s.InviteToJobAsync(job.Id, poster.Id, tradieId))
            .Should().ThrowAsync<InvalidOperationException>().WithMessage("*already applied*");
    }
```

- [ ] **Step 2: Run and confirm they fail**

Run: `cd backend && dotnet test --filter "FullyQualifiedName~InviteToJob"`
Expected: build error, `InviteToJobAsync` is not defined.

- [ ] **Step 3: Implement**

`DTOs/Jobs/InviteToJobRequest.cs`:
```csharp
namespace OnsiteMonday.Api.DTOs.Jobs;

public class InviteToJobRequest
{
    public Guid TradespersonId { get; set; }
}
```

`IJobService.cs`: add `Task InviteToJobAsync(Guid jobId, Guid posterId, Guid tradespersonId);`

`JobService.cs`:
```csharp
    public async Task InviteToJobAsync(Guid jobId, Guid posterId, Guid tradespersonId)
    {
        var job = await _jobRepo.GetByIdRawAsync(jobId)
            ?? throw new KeyNotFoundException($"Job {jobId} not found.");

        if (job.PostedById != posterId)
            throw new UnauthorizedAccessException("Only the job poster can invite tradespeople.");
        if (tradespersonId == posterId)
            throw new ArgumentException("You cannot invite yourself.");
        if (job.Status != "open")
            throw new InvalidOperationException("This job is no longer open.");

        var tradesperson = await _userRepo.GetByIdAsync(tradespersonId)
            ?? throw new KeyNotFoundException("Tradesperson not found.");

        var existing = await _jobRepo.GetApplicationAsync(jobId, tradespersonId);
        if (existing != null && existing.Status != "interested")
            throw new InvalidOperationException($"{tradesperson.FirstName} has already applied for this job.");

        var poster = await _userRepo.GetByIdAsync(posterId);
        var posterName = poster?.BusinessName ?? $"{poster?.FirstName} {poster?.LastName}".Trim();

        await _notificationRepo.CreateAsync(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = tradespersonId,
            Type = "job_invite",
            Title = "You've been invited to apply",
            Description = $"{posterName} would like you to apply for \"{job.Title}\".",
            LinkedId = jobId,
            CreatedAt = DateTimeOffset.UtcNow,
        });
    }
```

`JobsController.cs`:
```csharp
    // POST /api/jobs/{id}/invite
    [HttpPost("{id:guid}/invite")]
    public async Task<IActionResult> InviteToJob(Guid id, [FromBody] InviteToJobRequest request)
    {
        var userId = await GetCurrentUserIdAsync();
        await _jobService.InviteToJobAsync(id, userId, request.TradespersonId);
        return NoContent();
    }
```

Update the comment on `Notification.Type` in `Domain/Notification.cs` so it lists every type in use: `application | accepted | payment | review | review_required | job_completion_pending | job_autocompleted | cancelled | job_invite`.

- [ ] **Step 4: Run the tests**

Run: `cd backend && dotnet test --filter "FullyQualifiedName~JobServiceTests"`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "feat: add job invite endpoint for Hire Now"
```

---

### Task 5: Shared HireModal on the People list and profile (frontend)

**Files:**
- Create: `frontend/components/HireModal.tsx`
- Modify: `frontend/src/services/jobService.ts` (add `inviteToJob`)
- Modify: `frontend/app/(tabs)/people.tsx` (replace the inline modal and the fake `handleHireConfirm`)
- Modify: `frontend/app/person/[id].tsx:201` (wire up the Hire button)

**Interfaces:**
- Consumes: `POST /api/jobs/{id}/invite` (Task 4)
- Produces:
  - `jobService.inviteToJob(jobId: string, tradespersonId: string): Promise<void>`
  - `<HireModal person={{ id, firstName } | null} onClose={() => void} onInvited={(message: string) => void} />`

- [ ] **Step 1: Add the service call**

In `jobService.ts`, inside `jobService`:
```ts
  inviteToJob: async (jobId: string, tradespersonId: string): Promise<void> => {
    await apiRequest<void>('POST', `/jobs/${jobId}/invite`, { tradespersonId });
  },
```

- [ ] **Step 2: Create `HireModal`**

`frontend/components/HireModal.tsx`:
```tsx
import React, { useState } from 'react';
import { Modal, Pressable, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { jobService } from '@/src/services/jobService';
import { colors } from '@/constants/colors';

interface Props {
  person: { id: string; firstName: string } | null;
  onClose: () => void;
  onInvited: (message: string) => void;
}

export default function HireModal({ person, onClose, onInvited }: Props) {
  const { myJobs } = useApp();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openJobs = myJobs.posted.filter(j => j.status === 'open');

  const close = () => { setSelectedJobId(null); setError(null); onClose(); };

  const confirm = async () => {
    if (!person || !selectedJobId) return;
    setSending(true);
    setError(null);
    try {
      await jobService.inviteToJob(selectedJobId, person.id);
      onInvited(`Invite sent to ${person.firstName}`);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send invite.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={!!person} transparent animationType="slide">
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable style={styles.sheet}>
          <Text style={styles.title}>Invite {person?.firstName} to a job</Text>
          {openJobs.length === 0 ? (
            <>
              <Text style={styles.empty}>You have no open jobs. Post one first, then invite {person?.firstName} to apply.</Text>
              <TouchableOpacity style={styles.confirmBtn} onPress={() => { close(); router.push('/create-job'); }}>
                <Text style={styles.confirmText}>Post a job</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ScrollView style={{ maxHeight: 280 }}>
                {openJobs.map(job => (
                  <TouchableOpacity
                    key={job.id}
                    style={[styles.option, selectedJobId === job.id && styles.optionSelected]}
                    onPress={() => setSelectedJobId(job.id)}
                  >
                    <Text style={styles.optionTitle}>{job.title}</Text>
                    <Text style={styles.optionMeta}>{job.location} · £{job.dayRate}/day</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {error && <Text style={styles.error}>{error}</Text>}
              <TouchableOpacity
                style={[styles.confirmBtn, (!selectedJobId || sending) && { opacity: 0.5 }]}
                onPress={confirm}
                disabled={!selectedJobId || sending}
              >
                <Text style={styles.confirmText}>{sending ? 'Sending…' : 'Send invite'}</Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surfaceRaised, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  empty: { fontSize: 14, color: colors.textSecondary },
  option: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.chipBg },
  optionTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  optionMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  error: { color: colors.error, fontSize: 13 },
  confirmBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  confirmText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
```

- [ ] **Step 3: Use it on the People list**

In `app/(tabs)/people.tsx`:
- Delete `selectedJobForHire`, `handleHireConfirm`, the `{/* Hire modal */}` `<Modal>` block, and any styles that only it used.
- Keep `hireModalPerson`, but store the person object instead of an id: `useState<{ id: string; firstName: string } | null>(null)`. Change `onHire` to `onHire={() => setHireModalPerson({ id: item.id, firstName: item.firstName })}`.
- Render:
  ```tsx
  <HireModal
    person={hireModalPerson}
    onClose={() => setHireModalPerson(null)}
    onInvited={msg => { setToastMsg(msg); setToastVisible(true); }}
  />
  ```

- [ ] **Step 4: Use it on the person detail**

In `app/person/[id].tsx`:
- Add `const [hireOpen, setHireOpen] = useState(false);` and the toast state (`toastVisible`, `toastMsg`), using the same pattern as `people.tsx`.
- Change the Hire button to `onPress={() => setHireOpen(true)}`.
- Render `<HireModal person={hireOpen ? { id: person.id, firstName: person.firstName } : null} onClose={() => setHireOpen(false)} onInvited={...} />` and `<Toast ... />` just before the outer `</View>` closes.

- [ ] **Step 5: Type-check and run manually**

Run: `cd frontend && npx tsc --noEmit`
Manual check:
1. As a poster with an open job, open People, tap Hire on a card, choose the job and send. A toast appears.
2. Sign in as that tradesperson. Notifications shows "You've been invited to apply". Tapping it is wired up in Task 18.
3. With no open jobs, the modal shows "Post a job".

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "feat: wire Hire Now to job invites on people list and profile"
```

---

## Phase 3: Apply for a job page

### Task 6: Cover note on applications (backend)

**Files:**
- Modify: `backend/src/OnsiteMonday.Api/Domain/JobApplication.cs`
- Create: `backend/src/OnsiteMonday.Api/DTOs/Jobs/ApplyToJobRequest.cs`
- Create: `backend/src/OnsiteMonday.Api/Validators/ApplyToJobRequestValidator.cs`
- Modify: `DTOs/Jobs/ApplicantDto.cs`, `Services/Interfaces/IJobService.cs`, `Services/JobService.cs`, `Controllers/JobsController.cs`
- Create: migration `AddApplicationCoverNote`
- Test: `Unit/Services/JobServiceTests.cs`, `Unit/Validators/ApplyToJobRequestValidatorTests.cs`

**Interfaces:**
- Produces:
  - `POST /api/jobs/{id}/apply` with optional body `{ "coverNote": string | null }`
  - `IJobService.ApplyToJobAsync(Guid jobId, Guid userId, string? coverNote = null)`
  - `ApplicantDto.CoverNote : string?`

- [ ] **Step 1: Write failing tests**

`backend/tests/OnsiteMonday.Api.Tests/Unit/Validators/ApplyToJobRequestValidatorTests.cs`:
```csharp
using FluentAssertions;
using OnsiteMonday.Api.DTOs.Jobs;
using OnsiteMonday.Api.Validators;

namespace OnsiteMonday.Api.Tests.Unit.Validators;

public class ApplyToJobRequestValidatorTests
{
    private readonly ApplyToJobRequestValidator _sut = new();

    [Fact]
    public void NullCoverNote_IsValid() =>
        _sut.Validate(new ApplyToJobRequest()).IsValid.Should().BeTrue();

    [Fact]
    public void CoverNoteOver1000Chars_IsInvalid() =>
        _sut.Validate(new ApplyToJobRequest { CoverNote = new string('a', 1001) }).IsValid.Should().BeFalse();
}
```

Add to `JobServiceTests.cs`:
```csharp
    [Fact]
    public async Task ApplyToJob_WithCoverNote_StoresTrimmedNote()
    {
        var poster = TestBuilders.MakeUser();
        var applicantId = Guid.NewGuid();
        var job = TestBuilders.MakeJob(poster.Id);
        _jobRepoMock.Setup(r => r.GetByIdAsync(job.Id, applicantId)).ReturnsAsync((job, false, 0));
        _jobRepoMock.Setup(r => r.GetApplicationAsync(job.Id, applicantId)).ReturnsAsync((JobApplication?)null);

        await _sut.ApplyToJobAsync(job.Id, applicantId, "  Available from Monday, own van.  ");

        _jobRepoMock.Verify(r => r.AddApplicationAsync(It.Is<JobApplication>(a =>
            a.CoverNote == "Available from Monday, own van.")), Times.Once);
    }

    [Fact]
    public async Task ApplyToJob_WhitespaceCoverNote_StoresNull()
    {
        var poster = TestBuilders.MakeUser();
        var applicantId = Guid.NewGuid();
        var job = TestBuilders.MakeJob(poster.Id);
        _jobRepoMock.Setup(r => r.GetByIdAsync(job.Id, applicantId)).ReturnsAsync((job, false, 0));
        _jobRepoMock.Setup(r => r.GetApplicationAsync(job.Id, applicantId)).ReturnsAsync((JobApplication?)null);

        await _sut.ApplyToJobAsync(job.Id, applicantId, "   ");

        _jobRepoMock.Verify(r => r.AddApplicationAsync(It.Is<JobApplication>(a => a.CoverNote == null)), Times.Once);
    }
```

- [ ] **Step 2: Run and confirm they fail**

Run: `cd backend && dotnet test --filter "FullyQualifiedName~ApplyToJob"`
Expected: build errors.

- [ ] **Step 3: Implement**

`JobApplication.cs`: add `public string? CoverNote { get; set; }`

`DTOs/Jobs/ApplyToJobRequest.cs`:
```csharp
namespace OnsiteMonday.Api.DTOs.Jobs;

public class ApplyToJobRequest
{
    public string? CoverNote { get; set; }
}
```

`Validators/ApplyToJobRequestValidator.cs`:
```csharp
using FluentValidation;
using OnsiteMonday.Api.DTOs.Jobs;

namespace OnsiteMonday.Api.Validators;

public class ApplyToJobRequestValidator : AbstractValidator<ApplyToJobRequest>
{
    public ApplyToJobRequestValidator()
    {
        RuleFor(x => x.CoverNote).MaximumLength(1000);
    }
}
```
(Check how the other validators are registered in `Program.cs`. If it uses `AddValidatorsFromAssemblyContaining`, nothing more is needed. Otherwise register this one the same way.)

`ApplicantDto.cs`: add `public string? CoverNote { get; set; }`. In `JobService.GetApplicantsAsync`'s projection, add `CoverNote = a.Application.CoverNote,`.

`IJobService.cs`: change the signature to `Task<JobDto> ApplyToJobAsync(Guid jobId, Guid userId, string? coverNote = null);`

`JobService.ApplyToJobAsync`: add the `string? coverNote = null` parameter. At the top, add `var note = string.IsNullOrWhiteSpace(coverNote) ? null : coverNote.Trim();`. Set `CoverNote = note` in the `new JobApplication { ... }` initialiser, and `existing.CoverNote = note;` in the interested → applied branch.

`JobsController.ApplyToJob`:
```csharp
    public async Task<ActionResult<JobDto>> ApplyToJob(Guid id, [FromBody] ApplyToJobRequest? request = null)
    {
        var userId = await GetCurrentUserIdAsync();
        var job = await _jobService.ApplyToJobAsync(id, userId, request?.CoverNote);
        return Ok(job);
    }
```

- [ ] **Step 4: Add the migration**

Run: `dotnet ef migrations add AddApplicationCoverNote --project backend/src/OnsiteMonday.Api`
Expected: a new migration that adds a nullable `CoverNote` column to `JobApplications`. Open it and confirm it changes nothing else.

- [ ] **Step 5: Run the backend suite**

Run: `cd backend && dotnet test`
Expected: all pass. Existing callers of `ApplyToJobAsync(jobId, userId)` still compile because of the default parameter.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "feat: accept optional cover note when applying for a job"
```

---

### Task 7: Apply page, 03C (frontend)

**Files:**
- Create: `frontend/app/apply/[id].tsx`
- Modify: `frontend/src/services/jobService.ts` (`applyToJob` body), `frontend/context/AppContext.tsx` (`applyToJob(jobId, coverNote?)`)
- Modify: `frontend/constants/types.ts` (`Applicant.coverNote`)
- Modify: `frontend/app/job/[id].tsx` (Apply goes to the page; remove the confirmation modal)
- Modify: `frontend/app/(tabs)/my-jobs.tsx` (Liked tab Apply goes to the page)
- Modify: `frontend/app/job-applicants/[id].tsx` (show the cover note)

**Interfaces:**
- Consumes: `POST /api/jobs/{id}/apply { coverNote }` (Task 6), `<UsageBanner kind="applications" />` and `isAtLimit` (Task 3)
- Produces: route `/apply/[id]`, and `applyToJob(jobId: string, coverNote?: string): Promise<void>` in AppContext

- [ ] **Step 1: Thread the cover note through**

In `jobService.ts`, find the existing apply call and change it so it sends the body:
```ts
  applyToJob: async (jobId: string, coverNote?: string): Promise<Job> => {
    const data = await apiRequest<ApiJob>('POST', `/jobs/${jobId}/apply`, { coverNote: coverNote ?? null });
    return toJob(data);
  },
```
Then in `AppContext.tsx`:
- Change the context type to `applyToJob: (jobId: string, coverNote?: string) => Promise<void>;`
- Add the `coverNote` parameter to the implementation and pass it through to `jobService.applyToJob`.

In `constants/types.ts`, add `coverNote?: string | null;` to `Applicant`. Map it wherever `job-applicants` turns the API response into an `Applicant` (search for `applicationStatus:` in `jobService.ts`).

- [ ] **Step 2: Create the page**

`frontend/app/apply/[id].tsx`:
```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/context/AppContext';
import UsageBanner from '@/components/UsageBanner';
import { isAtLimit } from '@/src/utils/tierUsage';
import { colors } from '@/constants/colors';

const MAX = 1000;

export default function ApplyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getJob, applyToJob, usage } = useApp();
  const job = getJob(id);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = isAtLimit(usage, 'applications');

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await applyToJob(id, note);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Apply for job' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <UsageBanner kind="applications" />
        {job && (
          <View style={styles.jobCard}>
            <Text style={styles.jobTitle}>{job.title}</Text>
            <Text style={styles.jobMeta}>{job.location} · £{job.dayRate}/day · {job.duration} days</Text>
          </View>
        )}

        <Text style={styles.label}>Message to the job poster (optional)</Text>
        <TextInput
          style={styles.input}
          value={note}
          onChangeText={t => setNote(t.slice(0, MAX))}
          placeholder="Your availability, relevant experience, tickets and cards…"
          placeholderTextColor={colors.textMuted}
          multiline
        />
        <Text style={styles.counter}>{note.length}/{MAX}</Text>

        <Text style={styles.sectionTitle}>What happens next</Text>
        <Text style={styles.step}>1. The poster reviews your profile and message.</Text>
        <Text style={styles.step}>2. If they accept you, the job moves to My Work.</Text>
        <Text style={styles.step}>3. The poster pays into escrow before the job starts.</Text>
        <Text style={styles.step}>4. After completion and reviews, your payout is released on your plan's schedule.</Text>

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submit, (submitting || blocked) && { opacity: 0.5 }]}
          onPress={submit}
          disabled={submitting || blocked}
        >
          <Text style={styles.submitText}>{submitting ? 'Submitting…' : 'Submit application'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 8 },
  jobCard: { backgroundColor: colors.surfaceRaised, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, marginTop: 8 },
  jobTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  jobMeta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 12 },
  input: { minHeight: 140, backgroundColor: colors.surfaceRaised, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, fontSize: 15, color: colors.text, textAlignVertical: 'top' },
  counter: { alignSelf: 'flex-end', fontSize: 12, color: colors.textMuted },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 16 },
  step: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  error: { color: colors.error, fontSize: 14, marginTop: 8 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceRaised },
  submit: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
```

- [ ] **Step 3: Route Apply buttons to the page**

- `app/job/[id].tsx`: change the footer Apply button to `onPress={() => router.push(`/apply/${job.id}`)}` and rename its label to "Apply Now" to match the diagram. Delete `showApplyModal`, `applying`, `confirmApply`, the `{/* Apply confirmation modal */}` block, and any styles that only it used.
- `app/(tabs)/my-jobs.tsx`: in `renderLiked`, change the Apply button's `onPress` to `() => router.push(`/apply/${item.id}`)`.

- [ ] **Step 4: Show the cover note to the poster**

In `app/job-applicants/[id].tsx`, inside each applicant card and below the skills row, add:
```tsx
{item.coverNote ? (
  <Text style={styles.coverNote} numberOfLines={4}>"{item.coverNote}"</Text>
) : null}
```
with the style `coverNote: { fontSize: 13, fontStyle: 'italic', color: colors.textSecondary, marginTop: 8 }`.

- [ ] **Step 5: Type-check and run manually**

Run: `cd frontend && npx tsc --noEmit`
Manual check:
1. Job detail → Apply Now opens the page.
2. Type a note and submit. You return to job detail, which shows the applied state.
3. As the poster, the applicants list shows the note in italics.

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "feat: add Apply for a job page with cover note"
```

---

## Phase 4: Profile biography and work gallery

### Task 8: Bio field and gallery upload URL (backend)

**Files:**
- Modify: `Domain/User.cs`, `DTOs/Users/UserDto.cs`, `DTOs/Users/TradespersonDto.cs`, `DTOs/Users/UpdateUserRequest.cs`, `Services/UserService.cs`, `Validators/UpdateUserRequestValidator.cs`
- Modify: `Services/Interfaces/IStorageService.cs`, `Services/S3StorageService.cs`, `Controllers/UsersController.cs`
- Modify: `backend/tests/.../Infrastructure/TestWebApplicationFactory.cs` (storage mock)
- Create: migration `AddUserBio`
- Test: `Unit/Validators/UpdateUserRequestValidatorTests.cs`, `Unit/Services/UserServiceTests.cs`, `Unit/StorageServiceTests.cs`, `Integration/UsersControllerTests.cs`

**Interfaces:**
- Produces:
  - `User.Bio : string?`, exposed on `UserDto.Bio` and `TradespersonDto.Bio`, and settable through `UpdateUserRequest.Bio`
  - `IStorageService.GenerateGalleryImageUploadUrlAsync(string userId, string contentType) : Task<(string UploadUrl, string PublicUrl)>`, using the key `gallery/{userId}/{guid}.{ext}`
  - `POST /api/users/me/gallery-image-upload-url` with body `{ contentType }` returns `{ uploadUrl, publicUrl }`
  - `UserLimits.MaxGalleryImages = 12` (a const on `UpdateUserRequestValidator`)

- [ ] **Step 1: Write failing tests**

Add to `UpdateUserRequestValidatorTests.cs`:
```csharp
    [Fact]
    public void Bio_Over1000Chars_IsInvalid() =>
        new UpdateUserRequestValidator().Validate(new UpdateUserRequest { Bio = new string('a', 1001) })
            .IsValid.Should().BeFalse();

    [Fact]
    public void Gallery_13Images_IsInvalid() =>
        new UpdateUserRequestValidator().Validate(new UpdateUserRequest { Gallery = Enumerable.Repeat("https://x/y.jpg", 13).ToList() })
            .IsValid.Should().BeFalse();

    [Fact]
    public void Gallery_12Images_IsValid() =>
        new UpdateUserRequestValidator().Validate(new UpdateUserRequest { Gallery = Enumerable.Repeat("https://x/y.jpg", 12).ToList() })
            .IsValid.Should().BeTrue();
```

Add to `UserServiceTests.cs`:
```csharp
    [Fact]
    public async Task UpdateCurrentUser_SetsBio()
    {
        var user = TestBuilders.MakeUser();
        _repoMock.Setup(r => r.GetOrCreateByCognitoSubAsync(FakeAuthHandler.TestFirebaseUid, FakeAuthHandler.TestEmail, null, null, null))
            .ReturnsAsync(user);

        var result = await _sut.UpdateCurrentUserAsync(FakeAuthHandler.TestFirebaseUid, FakeAuthHandler.TestEmail,
            new UpdateUserRequest { Bio = "Time-served joiner, 15 years." });

        result.Bio.Should().Be("Time-served joiner, 15 years.");
    }
```

Add to `StorageServiceTests.cs`:
```csharp
    [Fact]
    public async Task GenerateGalleryImageUploadUrlAsync_UsesUniqueGalleryKey()
    {
        var s3Mock = new Mock<IAmazonS3>();
        var captured = new List<string>();
        s3Mock.Setup(m => m.GetPreSignedURL(It.IsAny<GetPreSignedUrlRequest>()))
            .Callback<GetPreSignedUrlRequest>(r => captured.Add(r.Key))
            .Returns("https://signed");
        var sut = new S3StorageService(s3Mock.Object, MakeConfig());

        var (_, url1) = await sut.GenerateGalleryImageUploadUrlAsync("user-123", "image/jpeg");
        var (_, url2) = await sut.GenerateGalleryImageUploadUrlAsync("user-123", "image/png");

        captured[0].Should().StartWith("gallery/user-123/").And.EndWith(".jpg");
        captured[1].Should().EndWith(".png");
        url1.Should().NotBe(url2);
    }
```

Add to `UsersControllerTests.cs`:
```csharp
    [Fact]
    public async Task GalleryUploadUrl_Jpeg_Returns200()
    {
        var response = await _client.PostAsJsonAsync("/api/users/me/gallery-image-upload-url", new { contentType = "image/jpeg" });
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GalleryUploadUrl_Gif_Returns400()
    {
        var response = await _client.PostAsJsonAsync("/api/users/me/gallery-image-upload-url", new { contentType = "image/gif" });
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
```

- [ ] **Step 2: Run and confirm they fail**

Run: `cd backend && dotnet test --filter "FullyQualifiedName~Bio|FullyQualifiedName~Gallery"`
Expected: build errors.

- [ ] **Step 3: Implement**

- `User.cs`: add `public string? Bio { get; set; }` after `BusinessName`.
- `UserDto.cs`, `TradespersonDto.cs`, `UpdateUserRequest.cs`: add `public string? Bio { get; set; }`. AutoMapper maps it by name.
- `UserService.UpdateCurrentUserAsync`: add `if (request.Bio != null) user.Bio = request.Bio.Trim();`
- `UpdateUserRequestValidator`: add
  ```csharp
      public const int MaxGalleryImages = 12;
  ```
  as a class member, and in the constructor:
  ```csharp
          When(x => x.Bio != null, () =>
              RuleFor(x => x.Bio).MaximumLength(1000));

          When(x => x.Gallery != null, () =>
              RuleFor(x => x.Gallery!.Count).LessThanOrEqualTo(MaxGalleryImages)
                  .WithMessage($"You can add up to {MaxGalleryImages} gallery photos."));
  ```
- `IStorageService.cs`: add
  ```csharp
      Task<(string UploadUrl, string PublicUrl)> GenerateGalleryImageUploadUrlAsync(
          string userId, string contentType);
  ```
- `S3StorageService.cs`: pull the body of `GenerateProfileImageUploadUrlAsync` out into a `private Task<(string, string)> PresignAsync(string key, string contentType)`. Then:
  ```csharp
      public Task<(string UploadUrl, string PublicUrl)> GenerateProfileImageUploadUrlAsync(string userId, string contentType) =>
          PresignAsync($"profile-images/{userId}.{Ext(contentType)}", contentType);

      public Task<(string UploadUrl, string PublicUrl)> GenerateGalleryImageUploadUrlAsync(string userId, string contentType) =>
          PresignAsync($"gallery/{userId}/{Guid.NewGuid():N}.{Ext(contentType)}", contentType);

      private static string Ext(string contentType) => contentType == "image/png" ? "png" : "jpg";
  ```
- `UsersController.cs`:
  ```csharp
      // POST /api/users/me/gallery-image-upload-url
      [HttpPost("me/gallery-image-upload-url")]
      public async Task<ActionResult<ProfileImageUploadUrlResponse>> GetGalleryImageUploadUrl(
          [FromBody] ProfileImageUploadUrlRequest request)
      {
          if (request.ContentType is not ("image/jpeg" or "image/png"))
              return BadRequest(new { error = "contentType must be image/jpeg or image/png" });

          var (uploadUrl, publicUrl) = await _storageService.GenerateGalleryImageUploadUrlAsync(
              CognitoSub, request.ContentType);

          return Ok(new ProfileImageUploadUrlResponse(uploadUrl, publicUrl));
      }
  ```
  This reuses the existing request and response records. Don't create `GalleryImageUploadUrlResponse`.
- `TestWebApplicationFactory.cs`: next to the profile-image setups, add
  ```csharp
              storageMock
                  .Setup(m => m.GenerateGalleryImageUploadUrlAsync(It.IsAny<string>(), It.IsAny<string>()))
                  .ReturnsAsync(("https://fake-presigned-url?sig=abc",
                      "https://onsite-monday-media.s3.eu-west-2.amazonaws.com/gallery/test/abc.jpg"));
  ```

- [ ] **Step 4: Add the migration**

Run: `dotnet ef migrations add AddUserBio --project backend/src/OnsiteMonday.Api`
Expected: it adds a nullable `Bio` column to `Users` and nothing else.

- [ ] **Step 5: Run the backend suite**

Run: `cd backend && dotnet test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "feat: add profile bio and gallery image upload URL"
```

---

### Task 9: Edit bio and gallery, and show them (frontend)

**Files:**
- Create: `frontend/src/utils/gallery.ts`, `frontend/src/utils/__tests__/gallery.test.ts`
- Modify: `frontend/src/services/imageService.ts` (add `uploadGalleryImage`)
- Modify: `frontend/constants/types.ts` (`User.bio`, `Tradesperson.bio`)
- Modify: `frontend/src/services/userService.ts` (`ApiUser.bio`, `toUser`, `UpdateUserPayload.bio`)
- Modify: `frontend/context/AppContext.tsx` (`loadTradespeople` maps `bio`)
- Modify: `frontend/app/edit-profile.tsx`, `frontend/app/(tabs)/profile.tsx`, `frontend/app/person/[id].tsx`

**Interfaces:**
- Consumes: `POST /api/users/me/gallery-image-upload-url` and `PUT /api/users/me { bio, gallery }` (Task 8)
- Produces:
  - `MAX_GALLERY = 12`
  - `addToGallery(gallery: string[], url: string): string[]`
  - `removeFromGallery(gallery: string[], index: number): string[]`
  - `canAddToGallery(gallery: string[]): boolean`
  - `uploadGalleryImage(source: 'library' | 'camera'): Promise<string | typeof CANCELLED>`

- [ ] **Step 1: Write failing util tests**

`frontend/src/utils/__tests__/gallery.test.ts`:
```ts
import { addToGallery, removeFromGallery, canAddToGallery, MAX_GALLERY } from '@/src/utils/gallery';

const full = Array.from({ length: MAX_GALLERY }, (_, i) => `https://x/${i}.jpg`);

test('adds to the end', () => {
  expect(addToGallery(['a'], 'b')).toEqual(['a', 'b']);
});
test('ignores duplicates', () => {
  expect(addToGallery(['a'], 'a')).toEqual(['a']);
});
test('does not exceed the max', () => {
  expect(addToGallery(full, 'extra')).toHaveLength(MAX_GALLERY);
});
test('removes by index', () => {
  expect(removeFromGallery(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
});
test('out-of-range remove is a no-op', () => {
  expect(removeFromGallery(['a'], 5)).toEqual(['a']);
});
test('canAddToGallery is false when full', () => {
  expect(canAddToGallery(full)).toBe(false);
  expect(canAddToGallery([])).toBe(true);
});
```

- [ ] **Step 2: Run and confirm they fail**

Run: `cd frontend && npx jest gallery`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the util**

`frontend/src/utils/gallery.ts`:
```ts
// Must match UpdateUserRequestValidator.MaxGalleryImages on the backend
export const MAX_GALLERY = 12;

export const canAddToGallery = (gallery: string[]) => gallery.length < MAX_GALLERY;

export function addToGallery(gallery: string[], url: string): string[] {
  if (gallery.includes(url) || !canAddToGallery(gallery)) return gallery;
  return [...gallery, url];
}

export function removeFromGallery(gallery: string[], index: number): string[] {
  if (index < 0 || index >= gallery.length) return gallery;
  return gallery.filter((_, i) => i !== index);
}
```

- [ ] **Step 4: Run the util tests**

Run: `cd frontend && npx jest gallery`
Expected: all pass.

- [ ] **Step 5: Generalise `imageService`**

In `imageService.ts`, rename the body of `uploadProfileImage` into:
```ts
async function pickAndUpload(
  source: 'library' | 'camera',
  endpoint: string,
  options: ImagePicker.ImagePickerOptions,
): Promise<string | typeof CANCELLED> {
  // …existing body, using `options` instead of PICKER_OPTIONS and `endpoint` instead of the hard-coded path…
}
```
Keep the permission error messages generic ("…to upload a photo"). Then:
```ts
export const uploadProfileImage = (source: 'library' | 'camera') =>
  pickAndUpload(source, '/users/me/profile-image-upload-url', PICKER_OPTIONS);

export const uploadGalleryImage = (source: 'library' | 'camera') =>
  pickAndUpload(source, '/users/me/gallery-image-upload-url', {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });
```

- [ ] **Step 6: Add `bio` to types and mapping**

- `constants/types.ts`: add `bio: string;` to both `User` and `Tradesperson`.
- `userService.ts`: add `bio?: string;` to `ApiUser` and `UpdateUserPayload`, and `bio: u.bio ?? '',` in `toUser`.
- `AppContext.tsx` `loadTradespeople`: add `bio: u.bio ?? '',` to the mapped object.
- Run `cd frontend && npx tsc --noEmit` and fix every place the compiler flags as missing `bio`. These will be `data/seedData.ts` and any object literals building a `User` or `Tradesperson`. Use `bio: ''` there.

- [ ] **Step 7: Edit Profile, bio and gallery sections**

In `app/edit-profile.tsx`:
- Add the state `const [bio, setBio] = useState(currentUser?.bio ?? '');` and `const [gallery, setGallery] = useState<string[]>(currentUser?.gallery ?? []);` plus `const [uploadingGallery, setUploadingGallery] = useState(false);`.
- Add a "About you" section after the name fields:
  ```tsx
  <Text style={styles.label}>About you</Text>
  <TextInput
    style={[styles.input, { minHeight: 110, textAlignVertical: 'top' }]}
    value={bio}
    onChangeText={t => setBio(t.slice(0, 1000))}
    placeholder="Your experience, the kind of work you take on, tickets and cards…"
    placeholderTextColor={colors.textMuted}
    multiline
  />
  ```
- Add a "Work gallery" section: a wrapping row of 96×96 thumbnails (`<Image source={{ uri }} />`), each with a small ✕ `TouchableOpacity` that calls `setGallery(g => removeFromGallery(g, i))`. When `canAddToGallery(gallery)`, add a final dashed "+" tile. Its `onPress` copies `handleChangePhoto`'s Library/Camera alert and then calls:
  ```ts
  const addGalleryPhoto = async (source: 'library' | 'camera') => {
    setUploadingGallery(true);
    try {
      const url = await uploadGalleryImage(source);
      if (url !== CANCELLED) setGallery(g => addToGallery(g, url));
    } catch (e) {
      Alert.alert('Photo upload failed', e instanceof Error ? e.message : 'Could not upload photo.');
    } finally {
      setUploadingGallery(false);
    }
  };
  ```
  Below the grid, show `{gallery.length}/{MAX_GALLERY} photos`.
- In the existing save handler, add `bio` and `gallery` to the `updateCurrentUser({...})` payload.

- [ ] **Step 8: Profile tab and person detail**

- `app/(tabs)/profile.tsx`:
  - Add an "About" section above Skills that renders `currentUser.bio`, or "Add a short bio from Edit Profile." in `styles.emptyText` when it's empty.
  - Replace the fixed Gallery text with the same thumbnail grid as `person/[id].tsx:184-191`. Show the existing empty text only when `currentUser.gallery.length === 0`.
- `app/person/[id].tsx`: add an "About" section above Skills that renders `person.bio`, and hide the whole section when it's empty. Map `bio: u.bio ?? ''` wherever line 58 builds `person`.

- [ ] **Step 9: Type-check and run manually**

Run: `cd frontend && npx tsc --noEmit && npx jest`
Manual check:
1. Edit Profile: add a bio and 2 gallery photos, then save.
2. The Profile tab shows the bio and both photos.
3. Another user viewing your People profile sees the About section and the photos.
4. With 12 photos, the + tile disappears.

- [ ] **Step 10: Commit**

```bash
git add frontend
git commit -m "feat: edit and display profile bio and work gallery"
```

---

## Phase 5: Discovery (Jobs board, People, Dashboard)

### Task 10: Paginate tradespeople (backend)

**Files:**
- Modify: `Repositories/Interfaces/IUserRepository.cs`, `Repositories/UserRepository.cs`, `Services/Interfaces/IUserService.cs`, `Services/UserService.cs`, `Controllers/UsersController.cs`
- Test: `Unit/Services/UserServiceTests.cs`

**Interfaces:**
- Produces: `GET /api/users/tradespeople?trade=&location=&page=1&pageSize=20`, ordered by rating (descending) then id. `pageSize` is clamped to 1–50.
- `IUserService.GetTradespeopleAsync(string? trade, string? location, int page = 1, int pageSize = 20)`
- `IUserRepository.GetTradespeopleAsync(string? trade, string? location, int page, int pageSize)`

- [ ] **Step 1: Write a failing test**

```csharp
    [Fact]
    public async Task GetTradespeople_ClampsPageSizeTo50()
    {
        _repoMock.Setup(r => r.GetTradespeopleAsync(null, null, 1, 50)).ReturnsAsync(new List<User>());

        await _sut.GetTradespeopleAsync(null, null, 1, 500);

        _repoMock.Verify(r => r.GetTradespeopleAsync(null, null, 1, 50), Times.Once);
    }

    [Fact]
    public async Task GetTradespeople_PageBelowOne_UsesOne()
    {
        _repoMock.Setup(r => r.GetTradespeopleAsync(null, null, 1, 20)).ReturnsAsync(new List<User>());

        await _sut.GetTradespeopleAsync(null, null, 0, 20);

        _repoMock.Verify(r => r.GetTradespeopleAsync(null, null, 1, 20), Times.Once);
    }
```

- [ ] **Step 2: Run and confirm they fail**

Run: `cd backend && dotnet test --filter "FullyQualifiedName~GetTradespeople"`
Expected: build error (the signature doesn't match).

- [ ] **Step 3: Implement**

- `IUserRepository`: change the signature to `Task<List<User>> GetTradespeopleAsync(string? trade, string? location, int page, int pageSize);`
- `UserRepository.GetTradespeopleAsync`: add the parameters, and replace `return await query.ToListAsync();` with
  ```csharp
          return await query
              .OrderByDescending(u => u.Rating).ThenBy(u => u.Id)
              .Skip((page - 1) * pageSize).Take(pageSize)
              .ToListAsync();
  ```
- `IUserService`/`UserService`:
  ```csharp
      public async Task<List<TradespersonDto>> GetTradespeopleAsync(string? trade, string? location, int page = 1, int pageSize = 20)
      {
          page = Math.Max(1, page);
          pageSize = Math.Clamp(pageSize, 1, 50);
          var users = await _repo.GetTradespeopleAsync(trade, location, page, pageSize);
          return _mapper.Map<List<TradespersonDto>>(users);
      }
  ```
- `UsersController.GetTradespeople`: add `[FromQuery] int page = 1, [FromQuery] int pageSize = 20` and pass them through.

- [ ] **Step 4: Run the backend suite**

Run: `cd backend && dotnet test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "feat: paginate tradespeople listing"
```

---

### Task 11: Jobs board load more, featured jobs and Create Job shortcut (frontend)

**Files:**
- Create: `frontend/src/utils/pagination.ts`, `frontend/src/utils/__tests__/pagination.test.ts`
- Create: `frontend/src/utils/featuredJobs.ts`, `frontend/src/utils/__tests__/featuredJobs.test.ts`
- Create: `frontend/components/FeaturedJobsStrip.tsx`
- Modify: `frontend/src/services/jobService.ts` (`getJobs` accepts `page` and `pageSize`)
- Modify: `frontend/context/AppContext.tsx` (`loadMoreJobs`, `hasMoreJobs`)
- Modify: `frontend/app/(tabs)/jobs.tsx`

**Interfaces:**
- Produces:
  - `PAGE_SIZE = 20`
  - `mergePage<T extends { id: string }>(existing: T[], incoming: T[], pageSize: number): { items: T[]; hasMore: boolean }`
  - `selectFeaturedJobs(jobs: Job[], viewer: { id: string; trade: string } | null, limit?: number): Job[]`
  - In AppContext: `hasMoreJobs: boolean` and `loadMoreJobs(): Promise<void>`. `refreshJobs()` resets to page 1.
  - `<FeaturedJobsStrip jobs={Job[]} />`

- [ ] **Step 1: Write failing tests**

`frontend/src/utils/__tests__/pagination.test.ts`:
```ts
import { mergePage } from '@/src/utils/pagination';

const ids = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ id: String(from + i) }));

test('appends a full page and reports more', () => {
  const r = mergePage(ids(20), ids(20, 20), 20);
  expect(r.items).toHaveLength(40);
  expect(r.hasMore).toBe(true);
});
test('short page means no more', () => {
  expect(mergePage(ids(20), ids(5, 20), 20).hasMore).toBe(false);
});
test('dedupes items that shifted between pages', () => {
  const r = mergePage(ids(20), ids(20, 19), 20); // id "19" appears twice
  expect(r.items).toHaveLength(39);
  expect(new Set(r.items.map(i => i.id)).size).toBe(39);
});
```

`frontend/src/utils/__tests__/featuredJobs.test.ts`:
```ts
import { selectFeaturedJobs } from '@/src/utils/featuredJobs';
import { Job } from '@/constants/types';

const job = (over: Partial<Job>): Job => ({
  id: Math.random().toString(), title: 't', trade: 'Joiner', location: 'York', postcode: 'YO1',
  duration: 1, days: ['M'], startDate: '', endDate: '', startTime: '', endTime: '', dayRate: 100,
  description: '', postedById: 'other', postedByName: '', postedByBusiness: '', paymentTerms: '',
  status: 'open', photos: [], createdAt: '2026-10-01T00:00:00Z', isInterested: false,
  interestedCount: 0, applicantCount: 0, ...over,
} as Job);

const viewer = { id: 'me', trade: 'Joiner' };

test('excludes own and non-open jobs', () => {
  const r = selectFeaturedJobs([job({ postedById: 'me' }), job({ status: 'accepted' }), job({ id: 'ok' })], viewer);
  expect(r.map(j => j.id)).toEqual(['ok']);
});
test('puts own trade first, then highest day rate', () => {
  const r = selectFeaturedJobs([
    job({ id: 'plumb', trade: 'Plumber', dayRate: 400 }),
    job({ id: 'join-low', dayRate: 150 }),
    job({ id: 'join-high', dayRate: 250 }),
  ], viewer);
  expect(r.map(j => j.id)).toEqual(['join-high', 'join-low', 'plumb']);
});
test('caps at the limit', () => {
  const many = Array.from({ length: 9 }, (_, i) => job({ id: String(i) }));
  expect(selectFeaturedJobs(many, viewer)).toHaveLength(5);
});
test('works with no trade or no viewer', () => {
  expect(selectFeaturedJobs([job({ id: 'a' })], null)).toHaveLength(1);
  expect(selectFeaturedJobs([job({ id: 'a' })], { id: 'me', trade: '' })).toHaveLength(1);
});
```

- [ ] **Step 2: Run and confirm they fail**

Run: `cd frontend && npx jest pagination featuredJobs`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`frontend/src/utils/pagination.ts`:
```ts
export const PAGE_SIZE = 20;

export function mergePage<T extends { id: string }>(existing: T[], incoming: T[], pageSize: number) {
  const seen = new Set(existing.map(i => i.id));
  const items = [...existing, ...incoming.filter(i => !seen.has(i.id))];
  return { items, hasMore: incoming.length === pageSize };
}
```

`frontend/src/utils/featuredJobs.ts`:
```ts
import { Job } from '@/constants/types';

export function selectFeaturedJobs(
  jobs: Job[],
  viewer: { id: string; trade: string } | null,
  limit = 5,
): Job[] {
  const trade = viewer?.trade?.trim();
  return jobs
    .filter(j => j.status === 'open' && j.postedById !== viewer?.id)
    .sort((a, b) => {
      const aMatch = trade && a.trade === trade ? 1 : 0;
      const bMatch = trade && b.trade === trade ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      if (a.dayRate !== b.dayRate) return b.dayRate - a.dayRate;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, limit);
}
```

- [ ] **Step 4: Run the tests**

Run: `cd frontend && npx jest pagination featuredJobs`
Expected: all pass.

- [ ] **Step 5: Page the jobs fetch**

`jobService.getJobs`: widen the params type to `{ trade?: string; location?: string; status?: string; page?: number; pageSize?: number }`. Convert the number values to strings when building `URLSearchParams`: `Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])`.

In `AppContext.tsx`:
```ts
  const [jobsPage, setJobsPage] = useState(1);
  const [hasMoreJobs, setHasMoreJobs] = useState(true);

  const refreshJobs = useCallback(async () => {
    const first = await jobService.getJobs({ page: 1, pageSize: PAGE_SIZE });
    setJobs(first);
    setJobsPage(1);
    setHasMoreJobs(first.length === PAGE_SIZE);
  }, []);

  const loadMoreJobs = useCallback(async () => {
    if (!hasMoreJobs) return;
    const next = jobsPage + 1;
    const incoming = await jobService.getJobs({ page: next, pageSize: PAGE_SIZE });
    setJobs(prev => {
      const { items, hasMore } = mergePage(prev, incoming, PAGE_SIZE);
      setHasMoreJobs(hasMore);
      return items;
    });
    setJobsPage(next);
  }, [hasMoreJobs, jobsPage]);
```
Change the initial-load call `call('getJobs', () => jobService.getJobs())` so it sets page state the same way `refreshJobs` does: call `refreshJobs` itself, or inline the same three setters. Add `hasMoreJobs` and `loadMoreJobs` to the context type and value.

- [ ] **Step 6: `FeaturedJobsStrip` and the jobs board UI**

`frontend/components/FeaturedJobsStrip.tsx`: a horizontal `ScrollView` of compact cards, 220 wide. Each card shows title, trade, location and `£{dayRate}/day`, and `onPress` goes to `router.push(`/job/${job.id}`)`. Above the cards is a "Featured for you" heading styled like the existing section titles. If `jobs.length === 0`, return `null`.

In `app/(tabs)/jobs.tsx`:
- `const featured = useMemo(() => selectFeaturedJobs(jobs, currentUser ? { id: currentUser.id, trade: currentUser.trade } : null), [jobs, currentUser]);`
- On the `FlatList`, add `ListHeaderComponent={!anyFilterActive ? <FeaturedJobsStrip jobs={featured} /> : null}`.
- Add `onEndReached={() => { if (!anyFilterActive) loadMoreJobs(); }}`, `onEndReachedThreshold={0.4}`, and a `ListFooterComponent` showing "Load more jobs" (a `TouchableOpacity` that calls `loadMoreJobs`) when `hasMoreJobs`. Infinite scroll is off while filters are active because filtering is client-side; the button still works.
- Create Job shortcut: in the sort bar's right-hand group, before the Filters button, add an icon button (`Ionicons name="add-circle-outline"`, label "Post job") that goes to `router.push('/create-job')`, using the existing `styles.iconBtn`.

- [ ] **Step 7: Type-check and run manually**

Run: `cd frontend && npx tsc --noEmit && npx jest`
Manual check:
1. Seed more than 20 open jobs (`DataSeeder` or the Postman collection). The board loads 20, and scrolling loads the rest. No duplicates appear.
2. "Featured for you" shows jobs in your trade first.
3. Applying a filter hides the strip.

- [ ] **Step 8: Commit**

```bash
git add frontend
git commit -m "feat: jobs board pagination, featured jobs and post-job shortcut"
```

---

### Task 12: People load more (frontend)

**Files:**
- Modify: `frontend/src/services/userService.ts`, `frontend/context/AppContext.tsx`, `frontend/app/(tabs)/people.tsx`

**Interfaces:**
- Consumes: `GET /api/users/tradespeople?page&pageSize` (Task 10), `mergePage` and `PAGE_SIZE` (Task 11)
- Produces: AppContext `hasMoreTradespeople: boolean` and `loadMoreTradespeople(): Promise<void>`. `loadTradespeople(params)` resets to page 1 and remembers `params` for later pages.

- [ ] **Step 1: Implement**

- `userService.getTradespeople`: accept `page?: number; pageSize?: number` and stringify them as in Task 11 Step 5.
- `AppContext.tsx`: pull the existing `u => ({...})` mapper inside `loadTradespeople` out into a module-level `toTradesperson(u: ApiUser): Tradesperson`. Then:
  ```ts
  const [peopleParams, setPeopleParams] = useState<{ trade?: string; location?: string }>({});
  const [peoplePage, setPeoplePage] = useState(1);
  const [hasMoreTradespeople, setHasMoreTradespeople] = useState(true);

  const loadTradespeople = useCallback(async (params: { trade?: string; location?: string } = {}) => {
    const data = await userService.getTradespeople({ ...params, page: 1, pageSize: PAGE_SIZE });
    setTradespeople(data.map(toTradesperson));
    setPeopleParams(params);
    setPeoplePage(1);
    setHasMoreTradespeople(data.length === PAGE_SIZE);
  }, []);

  const loadMoreTradespeople = useCallback(async () => {
    if (!hasMoreTradespeople) return;
    const next = peoplePage + 1;
    const data = await userService.getTradespeople({ ...peopleParams, page: next, pageSize: PAGE_SIZE });
    setTradespeople(prev => {
      const { items, hasMore } = mergePage(prev, data.map(toTradesperson), PAGE_SIZE);
      setHasMoreTradespeople(hasMore);
      return items;
    });
    setPeoplePage(next);
  }, [hasMoreTradespeople, peoplePage, peopleParams]);
  ```
  Add both new values to the context type and value.
- `app/(tabs)/people.tsx`: on the `FlatList`, add `onEndReached={loadMoreTradespeople}`, `onEndReachedThreshold={0.4}`, and a "Load more" footer button when `hasMoreTradespeople` and `search === ''`.

- [ ] **Step 2: Type-check and run manually**

Run: `cd frontend && npx tsc --noEmit`
Manual check: with more than 20 tradespeople seeded, scrolling to the end loads the next 20.

- [ ] **Step 3: Commit**

```bash
git add frontend
git commit -m "feat: load more on people listing"
```

---

### Task 13: Home dashboard tab, 02 (frontend)

**Files:**
- Create: `frontend/src/utils/profileCompleteness.ts`, `frontend/src/utils/__tests__/profileCompleteness.test.ts`
- Create: `frontend/components/InfoCard.tsx`
- Create: `frontend/app/(tabs)/home.tsx`
- Modify: `frontend/app/(tabs)/_layout.tsx` (add the Home tab first)
- Modify: `frontend/app/index.tsx:60`, `frontend/app/sign-in.tsx:47,117,148`, `frontend/app/sign-up.tsx:211` (redirect to `/(tabs)/home`)

**Interfaces:**
- Consumes: `selectFeaturedJobs` and `FeaturedJobsStrip` (Task 11), `TIER_INFO` (Task 3), `usage` (Task 3)
- Produces:
  - `getMissingProfileItems(user: User): string[]`
  - `<InfoCard icon title body ctaLabel? onPress? />`, reused by Task 14

- [ ] **Step 1: Write a failing test**

`frontend/src/utils/__tests__/profileCompleteness.test.ts`:
```ts
import { getMissingProfileItems } from '@/src/utils/profileCompleteness';
import { User } from '@/constants/types';

const complete = {
  profileImage: 'https://x/me.jpg', trade: 'Joiner', skills: ['Second fix'],
  dayRate: 180, location: 'York', bio: 'Joiner of 15 years', gallery: ['https://x/1.jpg'],
} as unknown as User;

test('complete profile has nothing missing', () => {
  expect(getMissingProfileItems(complete)).toEqual([]);
});
test('lists each missing item in display order', () => {
  const u = { ...complete, profileImage: null, skills: [], dayRate: 0, bio: '  ' } as User;
  expect(getMissingProfileItems(u)).toEqual(['Profile photo', 'Skills', 'Day rate', 'Bio']);
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `cd frontend && npx jest profileCompleteness`
Expected: FAIL.

- [ ] **Step 3: Implement**

`frontend/src/utils/profileCompleteness.ts`:
```ts
import { User } from '@/constants/types';

const CHECKS: [string, (u: User) => boolean][] = [
  ['Profile photo', u => !!u.profileImage],
  ['Trade', u => !!u.trade?.trim()],
  ['Skills', u => u.skills.length > 0],
  ['Day rate', u => u.dayRate > 0],
  ['Location', u => !!u.location?.trim()],
  ['Bio', u => !!u.bio?.trim()],
  ['Work gallery', u => u.gallery.length > 0],
];

export function getMissingProfileItems(user: User): string[] {
  return CHECKS.filter(([, ok]) => !ok(user)).map(([label]) => label);
}
```

- [ ] **Step 4: Run the test**

Run: `cd frontend && npx jest profileCompleteness`
Expected: PASS.

- [ ] **Step 5: `InfoCard` component**

`frontend/components/InfoCard.tsx`:
```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';

interface Props {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  body: string | string[];
  ctaLabel?: string;
  onPress?: () => void;
}

export default function InfoCard({ icon, title, body, ctaLabel, onPress }: Props) {
  const lines = Array.isArray(body) ? body : [body];
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {lines.map((l, i) => <Text key={i} style={styles.body}>{l}</Text>)}
      {ctaLabel && onPress && (
        <TouchableOpacity onPress={onPress} style={styles.cta}>
          <Text style={styles.ctaText}>{ctaLabel} →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceRaised, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginHorizontal: 16, marginTop: 12, gap: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  cta: { marginTop: 4 },
  ctaText: { fontSize: 14, fontWeight: '700', color: colors.primary },
});
```

- [ ] **Step 6: Home screen**

`frontend/app/(tabs)/home.tsx`, a `ScrollView` with `RefreshControl` (on refresh, run `refreshJobs()` and `refreshUsage()`), containing in order:
1. Greeting: `Morning, {currentUser.firstName}` with a sub-line `{TIER_INFO[currentUser.subscription].name} plan`.
2. Finish setting up your profile. Show this only when `missing.length > 0`:
   `<InfoCard icon="account-alert-outline" title="Finish setting up your profile" body={`Missing: ${missing.join(', ')}`} ctaLabel="Edit profile" onPress={() => router.push('/edit-profile')} />`
3. `<FeaturedJobsStrip jobs={featured} />` (same `useMemo` as Task 11), followed by a "See all jobs →" link to `/(tabs)/jobs`.
4. A Create Job card: `<InfoCard icon="briefcase-plus-outline" title="Need a tradesperson?" body="Post a job and get applications from local trades." ctaLabel="Post a job" onPress={() => router.push('/create-job')} />`
5. A subscription card:
   ```tsx
   <InfoCard
     icon="crown-outline"
     title={`Your ${TIER_INFO[tier].name} plan`}
     body={[
       `Payouts within ${TIER_INFO[tier].paymentDays}`,
       `Job posts: ${TIER_INFO[tier].posts}`,
       `Applications: ${TIER_INFO[tier].applications}`,
     ]}
     ctaLabel={tier === 'gold' ? 'Manage plan' : 'Compare plans'}
     onPress={() => router.push('/subscription')}
   />
   ```
6. `<UsageBanner kind="applications" />` and `<UsageBanner kind="posts" />`

- [ ] **Step 7: Register the tab and redirect after sign-in**

In `app/(tabs)/_layout.tsx`, add this as the **first** `Tabs.Screen`:
```tsx
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
```
Replace `'/(tabs)/jobs'` with `'/(tabs)/home'` at `app/index.tsx:60`, `app/sign-in.tsx:47,117,148` and `app/sign-up.tsx:211`. Leave the "Find more jobs" links in `my-jobs.tsx` pointing at Jobs.

- [ ] **Step 8: Type-check and run manually**

Run: `cd frontend && npx tsc --noEmit && npx jest`
Manual check:
1. Sign in. You land on Home.
2. A new account shows the profile checklist. It disappears once every item is filled in.
3. The tier card matches the current plan.

- [ ] **Step 9: Commit**

```bash
git add frontend
git commit -m "feat: add Home dashboard tab"
```

---

## Phase 6: My Jobs and Create Job details

### Task 14: Liked tips, archived jobs and My Work process reminder (frontend)

**Files:**
- Create: `frontend/src/utils/likedJobs.ts`, `frontend/src/utils/__tests__/likedJobs.test.ts`
- Modify: `frontend/app/(tabs)/my-jobs.tsx`

**Interfaces:**
- Consumes: `InfoCard` (Task 13), `TIER_INFO` (Task 3)
- Produces: `splitLikedJobs(jobs: Job[]): { active: Job[]; archived: Job[] }`

- [ ] **Step 1: Write a failing test**

`frontend/src/utils/__tests__/likedJobs.test.ts`:
```ts
import { splitLikedJobs } from '@/src/utils/likedJobs';
import { Job } from '@/constants/types';

const j = (id: string, status: Job['status']) => ({ id, status } as Job);

test('open jobs are active, everything else archived', () => {
  const r = splitLikedJobs([j('a', 'open'), j('b', 'accepted'), j('c', 'cancelled'), j('d', 'open')]);
  expect(r.active.map(x => x.id)).toEqual(['a', 'd']);
  expect(r.archived.map(x => x.id)).toEqual(['b', 'c']);
});
```

- [ ] **Step 2: Run, implement, re-run**

Run: `cd frontend && npx jest likedJobs` (expected to FAIL).

`frontend/src/utils/likedJobs.ts`:
```ts
import { Job } from '@/constants/types';

// A liked job is archived once it's no longer open (filled, cancelled or completed)
export function splitLikedJobs(jobs: Job[]) {
  return {
    active: jobs.filter(j => j.status === 'open'),
    archived: jobs.filter(j => j.status !== 'open'),
  };
}
```
Run: `cd frontend && npx jest likedJobs` (expected to PASS).

- [ ] **Step 3: Liked tab**

In `renderLiked`:
- `const { active, archived } = splitLikedJobs(myJobs.liked);` and add `const [showArchived, setShowArchived] = useState(false);` at component level.
- `data={active}`.
- `ListHeaderComponent`:
  ```tsx
  <InfoCard
    icon="lightbulb-on-outline"
    title="Tips for success"
    body={[
      'Complete your profile: a photo, bio and work gallery get more replies.',
      'Apply early. Posters often hire from the first few applicants.',
      'Add a short message saying when you can start.',
    ]}
  />
  ```
- In `ListFooterComponent`, keep the existing "Find more jobs" link. Above it, when `archived.length > 0`, show a toggle row `Archived jobs ({archived.length})` with a chevron. When expanded, render each archived job as a `JobCard` with `showStatus` and `opacity: 0.6`, with only a Remove action in the footer.
- Change `ListEmptyComponent` so it only shows when `active.length === 0 && archived.length === 0`.

- [ ] **Step 4: My Work tab process reminder**

In `renderAccepted`, add a `ListHeaderComponent`:
```tsx
<InfoCard
  icon="clipboard-check-outline"
  title="How it works"
  body={[
    '1. The poster starts the job and pays into escrow.',
    '2. Do the work, then the poster marks it complete.',
    '3. Both of you leave a review.',
    `4. Your payout is released within ${TIER_INFO[currentUser?.subscription ?? 'bronze'].paymentDays}.`,
  ]}
/>
```

- [ ] **Step 5: Type-check and run manually**

Run: `cd frontend && npx tsc --noEmit && npx jest`
Manual check:
1. Like a job, then have the poster hire someone else. The job moves into "Archived jobs".
2. The tips card shows on Liked and the process card on My Work.

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "feat: liked-job tips and archive, My Work process reminder"
```

---

### Task 15: Company information on Create Job, 04B (frontend)

**Files:**
- Modify: `frontend/app/create-job.tsx`

**Interfaces:**
- Consumes: `updateCurrentUser({ businessName })` (existing), `currentUser.businessName`

The company shown on a job comes from the poster's profile (`JobDto.PostedByBusiness` ← `User.BusinessName`). No backend change is needed.

- [ ] **Step 1: Add the section**

Above the "Job Title" field, add:
```tsx
<Text style={styles.sectionHeading}>Company information</Text>
<Text style={styles.label}>Business name</Text>
<TextInput
  style={styles.input}
  value={businessName}
  onChangeText={setBusinessName}
  placeholder="e.g. Smith & Sons Builders (leave blank to post as yourself)"
  placeholderTextColor={colors.textMuted}
/>
<Text style={styles.hint}>
  Shown on the job as "Posted by {businessName.trim() || `${currentUser?.firstName} ${currentUser?.lastName}`}". Saved to your profile.
</Text>
<Text style={styles.sectionHeading}>Job details</Text>
```
with state `const [businessName, setBusinessName] = useState(currentUser?.businessName ?? '');`. Add the styles `sectionHeading: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 16, marginBottom: 4 }` and `hint: { fontSize: 12, color: colors.textMuted, marginTop: 4 }`, unless equivalents already exist.

- [ ] **Step 2: Save on submit**

In the submit handler, **before** `addJob(...)`:
```ts
if (businessName.trim() !== (currentUser?.businessName ?? '')) {
  await updateCurrentUser({ businessName: businessName.trim() });
}
```

- [ ] **Step 3: Type-check and run manually**

Run: `cd frontend && npx tsc --noEmit`
Manual check: post a job with a business name. The job card and job detail show it, and Edit Profile shows the same name.

- [ ] **Step 4: Commit**

```bash
git add frontend
git commit -m "feat: company information section on create job"
```

---

## Phase 7: Messages and notifications

### Task 16: Message categories, 06A (backend and frontend)

**Files:**
- Modify: `backend/src/OnsiteMonday.Api/DTOs/Conversations/ConversationDto.cs`, `Services/ConversationService.cs`
- Test: `backend/tests/.../Unit/Services/ConversationServiceTests.cs`
- Create: `frontend/src/utils/conversationFilters.ts`, `frontend/src/utils/__tests__/conversationFilters.test.ts`
- Modify: `frontend/constants/types.ts` (`Conversation.relatedJobId`), `frontend/src/services/conversationService.ts`, `frontend/app/(tabs)/messages.tsx`

**Interfaces:**
- Produces:
  - `ConversationDto.RelatedJobId : Guid?`, which reaches the client as `relatedJobId: string | null`
  - `type ConversationFilter = 'all' | 'unread' | 'jobs'`
  - `filterConversations(list: Conversation[], filter: ConversationFilter): Conversation[]`

- [ ] **Step 1: Backend test (write it failing, then implement)**

In `ConversationServiceTests.cs`, add a test that builds a conversation with `RelatedJobId = jobId` through whatever setup the file already uses for `GetConversationsAsync`, then asserts `result[0].RelatedJobId.Should().Be(jobId);`. Run `cd backend && dotnet test --filter "FullyQualifiedName~ConversationServiceTests"` and confirm it fails at build.

Implement: add `public Guid? RelatedJobId { get; set; }` to `ConversationDto`, and `RelatedJobId = c.RelatedJobId,` in the `new ConversationDto { ... }` initialiser (`ConversationService.cs:151`). Re-run and confirm it passes.

- [ ] **Step 2: Write a failing frontend test**

`frontend/src/utils/__tests__/conversationFilters.test.ts`:
```ts
import { filterConversations } from '@/src/utils/conversationFilters';
import { Conversation } from '@/constants/types';

const c = (id: string, unreadCount: number, relatedJobId: string | null) =>
  ({ id, unreadCount, relatedJobId } as Conversation);
const list = [c('a', 0, null), c('b', 2, 'job1'), c('c', 1, null)];

test('all', () => expect(filterConversations(list, 'all')).toHaveLength(3));
test('unread', () => expect(filterConversations(list, 'unread').map(x => x.id)).toEqual(['b', 'c']));
test('jobs', () => expect(filterConversations(list, 'jobs').map(x => x.id)).toEqual(['b']));
```

- [ ] **Step 3: Implement**

`frontend/src/utils/conversationFilters.ts`:
```ts
import { Conversation } from '@/constants/types';

export type ConversationFilter = 'all' | 'unread' | 'jobs';

export const CONVERSATION_FILTER_LABELS: Record<ConversationFilter, string> = {
  all: 'All',
  unread: 'Unread',
  jobs: 'Job chats',
};

export function filterConversations(list: Conversation[], filter: ConversationFilter): Conversation[] {
  if (filter === 'unread') return list.filter(c => c.unreadCount > 0);
  if (filter === 'jobs') return list.filter(c => !!c.relatedJobId);
  return list;
}
```
- `constants/types.ts`: add `relatedJobId: string | null;` to `Conversation`.
- `conversationService.ts`: add `relatedJobId?: string | null;` to `ApiConversation`, and `relatedJobId: c.relatedJobId ?? null,` in `toConversation`.
- Run `npx tsc --noEmit` and add `relatedJobId: null` to any `Conversation` literal the compiler flags.

Run: `cd frontend && npx jest conversationFilters` and confirm it passes.

- [ ] **Step 4: Messages screen chips**

In `app/(tabs)/messages.tsx`, add `const [filter, setFilter] = useState<ConversationFilter>('all');`. Above the `FlatList`, render a horizontal row of three chips, styled like the trade chips in `people.tsx:95-113` (`filterChip`, `filterChipActive`). Use `CONVERSATION_FILTER_LABELS`, and add the unread count to "Unread" when it's above 0. Set `data={filterConversations(conversations, filter)}`. Give `EmptyState` a subtitle for each filter (for example, "No unread messages" when the filter is `unread`).

- [ ] **Step 5: Run everything**

Run: `cd backend && dotnet test` and `cd frontend && npx tsc --noEmit && npx jest`
Manual check: start a chat from a job detail ("Got a question?"). It appears under Job chats. A chat started from a profile doesn't.

- [ ] **Step 6: Commit**

```bash
git add backend frontend
git commit -m "feat: message categories (all, unread, job chats)"
```

---

### Task 17: Notification preferences, 08 (backend and frontend)

**Files:**
- Modify: `backend/src/OnsiteMonday.Api/Domain/User.cs`, `Data/AppDbContext.cs`, `DTOs/Users/UserDto.cs`, `DTOs/Users/UpdateUserRequest.cs`, `Services/UserService.cs`, `Services/ConversationService.cs`
- Create: migration `AddMutedNotificationTypes`
- Test: `Unit/Services/ConversationServiceTests.cs`, `Unit/Services/UserServiceTests.cs`
- Create: `frontend/app/notification-settings.tsx`
- Modify: `frontend/constants/types.ts`, `frontend/src/services/userService.ts`, `frontend/app/notifications.tsx`

**Interfaces:**
- Produces:
  - `User.MutedNotificationTypes : List<string>` (values: `"message"`). Exposed on `UserDto` and settable through `UpdateUserRequest`.
  - Frontend: `User.mutedNotificationTypes: string[]` and the route `/notification-settings`

- [ ] **Step 1: Write failing backend tests**

In `ConversationServiceTests.cs`, add a test where the recipient's `MutedNotificationTypes = new() { "message" }`. Call `SendMessageAsync` with whatever setup the file already uses for sending, and assert:
```csharp
_pushServiceMock.Verify(p => p.SendPushAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()), Times.Never);
```
Add a matching test where the recipient isn't muted, and assert `Times.Once`.

In `UserServiceTests.cs`:
```csharp
    [Fact]
    public async Task UpdateCurrentUser_SetsMutedNotificationTypes()
    {
        var user = TestBuilders.MakeUser();
        _repoMock.Setup(r => r.GetOrCreateByCognitoSubAsync(FakeAuthHandler.TestFirebaseUid, FakeAuthHandler.TestEmail, null, null, null))
            .ReturnsAsync(user);

        var result = await _sut.UpdateCurrentUserAsync(FakeAuthHandler.TestFirebaseUid, FakeAuthHandler.TestEmail,
            new UpdateUserRequest { MutedNotificationTypes = new() { "message" } });

        result.MutedNotificationTypes.Should().Equal("message");
    }
```

Run: `cd backend && dotnet test --filter "FullyQualifiedName~Muted|FullyQualifiedName~ConversationServiceTests"` and confirm it fails at build.

- [ ] **Step 2: Implement the backend**

- `User.cs`: add `public List<string> MutedNotificationTypes { get; set; } = new();`
- `AppDbContext.cs`: in the `User` block, add `e.Property(u => u.MutedNotificationTypes).HasColumnType("text[]");` to the `isNpgsql` branch and `e.Property(u => u.MutedNotificationTypes).HasConversion(listConverter);` to the `else` branch, following the `Gallery` lines.
- `UserDto.cs`: `public List<string> MutedNotificationTypes { get; set; } = new();`
- `UpdateUserRequest.cs`: `public List<string>? MutedNotificationTypes { get; set; }`
- `UserService.UpdateCurrentUserAsync`: `if (request.MutedNotificationTypes != null) user.MutedNotificationTypes = request.MutedNotificationTypes;`
- `ConversationService.SendMessageAsync`: just before `_ = _pushService.SendPushAsync(`, add
  ```csharp
          var recipient = await _userRepo.GetByIdAsync(recipientId);
          if (recipient?.MutedNotificationTypes.Contains("message") == true)
              return dto;
  ```

Run: `dotnet ef migrations add AddMutedNotificationTypes --project backend/src/OnsiteMonday.Api`. Check that the migration only adds that column. On Postgres the default should be `'{}'`; if the generated column is NOT NULL with no default, add `defaultValueSql: "'{}'"`.

Run: `cd backend && dotnet test` and confirm everything passes.

- [ ] **Step 3: Frontend settings screen**

- `constants/types.ts`: add `mutedNotificationTypes: string[];` to `User`.
- `userService.ts`: add `mutedNotificationTypes?: string[]` to `ApiUser` and `UpdateUserPayload`, and `mutedNotificationTypes: u.mutedNotificationTypes ?? [],` in `toUser`. Fix any `User` literal the compiler flags.
- `frontend/app/notification-settings.tsx`:
  ```tsx
  import React, { useState } from 'react';
  import { View, Text, Switch, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
  import { Stack } from 'expo-router';
  import { useApp } from '@/context/AppContext';
  import { colors } from '@/constants/colors';

  export default function NotificationSettingsScreen() {
    const { currentUser, updateCurrentUser } = useApp();
    const muted = currentUser?.mutedNotificationTypes ?? [];
    const [saving, setSaving] = useState(false);
    const messagesOn = !muted.includes('message');

    const toggleMessages = async (on: boolean) => {
      setSaving(true);
      try {
        await updateCurrentUser({
          mutedNotificationTypes: on ? muted.filter(t => t !== 'message') : [...muted, 'message'],
        });
      } catch (e) {
        Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
      } finally {
        setSaving(false);
      }
    };

    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Notification settings' }} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Message notifications</Text>
            <Text style={styles.sub}>Get a push notification when someone messages you.</Text>
          </View>
          <Switch
            value={messagesOn}
            onValueChange={toggleMessages}
            disabled={saving}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
        <Text style={styles.note}>
          Job, payment and review updates always appear in your notifications list.
        </Text>
        <TouchableOpacity onPress={() => Linking.openSettings()}>
          <Text style={styles.link}>Open device notification settings →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 16 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surfaceRaised, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
    label: { fontSize: 15, fontWeight: '600', color: colors.text },
    sub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    note: { fontSize: 13, color: colors.textSecondary },
    link: { fontSize: 14, fontWeight: '700', color: colors.primary },
  });
  ```
  Check that `updateCurrentUser`'s `Partial<User>` reaches `userService.updateMe` with `mutedNotificationTypes` intact. If AppContext picks fields off one by one, add this one.
- `app/notifications.tsx`: add a header-right gear button to the screen options that goes to `router.push('/notification-settings')`. If the screen has no `Stack.Screen` yet, add `<Stack.Screen options={{ headerRight: () => (...) }} />`.

- [ ] **Step 4: Type-check and run manually**

Run: `cd frontend && npx tsc --noEmit`
Manual check on two devices or simulators:
1. Turn off message notifications on device A.
2. Send a message from B. A gets no push, but the message still appears in its chat list.
3. Turn notifications back on. The next message pushes.

- [ ] **Step 5: Commit**

```bash
git add backend frontend
git commit -m "feat: notification settings with message push toggle"
```

---

### Task 18: Review prompt and invite notification routing (frontend)

**Files:**
- Create: `frontend/src/utils/notificationRoute.ts`, `frontend/src/utils/__tests__/notificationRoute.test.ts`
- Modify: `frontend/constants/types.ts` (`NotificationType`), `frontend/components/NotificationItem.tsx` (icons), `frontend/app/notifications.tsx` (`handlePress`)

**Interfaces:**
- Consumes: the notification types sent by the backend, including `job_invite` from Task 4
- Produces: `notificationRoute(n: { type: NotificationType; linkedId?: string }, postedJobIds: string[]): string | null`

- [ ] **Step 1: Write a failing test**

`frontend/src/utils/__tests__/notificationRoute.test.ts`:
```ts
import { notificationRoute } from '@/src/utils/notificationRoute';

const posted = ['p1'];

test.each([
  ['application', 'p1', '/job-applicants/p1'],
  ['accepted', 'j1', '/job/j1'],
  ['job_invite', 'j1', '/job/j1'],
  ['payment', 'j1', '/job/j1'],
  ['cancelled', 'j1', '/job/j1'],
  ['job_autocompleted', 'j1', '/job/j1'],
  ['review_required', 'p1', '/review/p1'],
  ['review', 'r1', '/(tabs)/profile'],
] as const)('%s → %s', (type, linkedId, expected) => {
  expect(notificationRoute({ type, linkedId }, posted)).toBe(expected);
});

test('job_completion_pending: poster goes to My Jobs to mark complete', () => {
  expect(notificationRoute({ type: 'job_completion_pending', linkedId: 'p1' }, posted)).toBe('/(tabs)/my-jobs');
});
test('job_completion_pending: tradesperson goes to review the poster', () => {
  expect(notificationRoute({ type: 'job_completion_pending', linkedId: 'j9' }, posted)).toBe('/review-poster/j9');
});
test('no linkedId and not review → null', () => {
  expect(notificationRoute({ type: 'accepted' }, posted)).toBeNull();
});
test('unknown type → null', () => {
  expect(notificationRoute({ type: 'something_new' as never, linkedId: 'x' }, posted)).toBeNull();
});
```

- [ ] **Step 2: Run, implement, re-run**

Run: `cd frontend && npx jest notificationRoute` (expected to FAIL).

In `constants/types.ts`, widen the type:
```ts
export type NotificationType =
  | 'application' | 'accepted' | 'payment' | 'review' | 'profile_view'
  | 'job_completion_pending' | 'job_autocompleted'
  | 'review_required' | 'cancelled' | 'job_invite';
```

`frontend/src/utils/notificationRoute.ts`:
```ts
import { NotificationType } from '@/constants/types';

export function notificationRoute(
  n: { type: NotificationType; linkedId?: string },
  postedJobIds: string[],
): string | null {
  // "review" links to a review id on one path and a job id on the other, so send it to the profile where reviews show
  if (n.type === 'review') return '/(tabs)/profile';
  if (!n.linkedId) return null;
  const id = n.linkedId;

  switch (n.type) {
    case 'application':
      return `/job-applicants/${id}`;
    case 'accepted':
    case 'job_invite':
    case 'payment':
    case 'cancelled':
    case 'job_autocompleted':
      return `/job/${id}`;
    case 'review_required':
      return `/review/${id}`;
    case 'job_completion_pending':
      return postedJobIds.includes(id) ? '/(tabs)/my-jobs' : `/review-poster/${id}`;
    default:
      return null;
  }
}
```
Run: `cd frontend && npx jest notificationRoute` (expected to PASS).

- [ ] **Step 3: Wire it up**

- `components/NotificationItem.tsx`: add `ICONS` entries `review_required: 'star-half'`, `cancelled: 'close-circle'` and `job_invite: 'mail-unread'`. Check each name exists in the icon set the component uses (Ionicons). Keep every key typed so the `Record<NotificationType, string>` stays exhaustive.
- `app/notifications.tsx`: replace the body of `handlePress` with
  ```ts
    markNotificationRead(id);
    const route = notificationRoute({ type: type as NotificationType, linkedId }, myJobs.posted.map(j => j.id));
    if (route) router.push(route as any);
  ```
  and pull `myJobs` from `useApp()`.

- [ ] **Step 4: Type-check and run manually**

Run: `cd frontend && npx tsc --noEmit && npx jest`
Manual check:
1. As a poster, mark a job complete. Tapping "Submit your review to release payment" opens the review screen.
2. As the tradesperson, tapping "Your job has ended" opens review-poster.
3. A job invite opens job detail.

- [ ] **Step 5: Commit**

```bash
git add frontend
git commit -m "feat: route review prompts and invites from notifications"
```

---

## Phase 8: Other pages

### Task 19: 404 and FAQs (frontend)

**Files:**
- Create: `frontend/app/+not-found.tsx`, `frontend/app/faqs.tsx`
- Modify: `frontend/app/(tabs)/profile.tsx` (FAQs row)

**Interfaces:**
- Produces: the Expo Router not-found route, and the route `/faqs`

- [ ] **Step 1: 404**

`frontend/app/+not-found.tsx`:
```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Link, Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Not found' }} />
      <MaterialCommunityIcons name="hard-hat" size={56} color={colors.primary} />
      <Text style={styles.title}>Nothing on site here</Text>
      <Text style={styles.body}>This page doesn't exist or has moved.</Text>
      <Link href="/" style={styles.link}>Back to Onsite Monday</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, backgroundColor: colors.background },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
  link: { marginTop: 12, fontSize: 15, fontWeight: '700', color: colors.primary },
});
```

- [ ] **Step 2: FAQs**

`frontend/app/faqs.tsx`: a `ScrollView` of expandable rows. Tapping a question toggles its answer; keep the open index in `useState<number | null>`. Content:
```ts
const FAQS: { q: string; a: string }[] = [
  { q: 'How do I get paid?', a: 'When you are hired, the job poster pays into escrow before the job starts. After the job is marked complete and both reviews are in, your payout is released to your bank account through Stripe.' },
  { q: 'How long do payouts take?', a: 'It depends on your plan: Bronze 30 days, Silver 14 days, Gold 7 days after release.' },
  { q: 'Why do I have to leave a review?', a: 'Reviews keep the marketplace trustworthy. Payment is released only after the job poster reviews the tradesperson, and you cannot post or apply for new jobs while a review is outstanding.' },
  { q: 'How many jobs can I post or apply for?', a: 'Each plan includes a monthly allowance, shown on your Home screen and Subscription page. Limits reset on the 1st of each month.' },
  { q: 'Can I cancel a job?', a: 'An accepted job can be cancelled by either side before it starts. If funds are held, they are refunded to the job poster.' },
  { q: 'Why do I need to verify my identity?', a: 'Stripe needs to verify tradespeople before paying out, to meet UK financial regulations. You can do this from Wallet.' },
  { q: 'How do I contact support?', a: 'Email support@onsitemonday.co.uk and we will get back to you within one working day.' },
];
```
> Confirm the support email address and the cancellation/refund wording with the product owner before release. These are placeholders taken from the existing payment flow and CLAUDE.md.

- [ ] **Step 3: Link from Profile**

In `app/(tabs)/profile.tsx`, add a menu row just like the Wallet row (`profile.tsx:236-242`) with the icon `help-circle-outline`, label "FAQs" and `onPress={() => router.push('/faqs')}`. Show it to every role (the Wallet row is tradesperson-only).

- [ ] **Step 4: Type-check and run manually**

Run: `cd frontend && npx tsc --noEmit`
Manual check:
1. In dev, open a bad deep link: `npx uri-scheme open "onsitemonday://nope" --ios`, or use the scheme from `app.json`. The 404 page shows.
2. Profile → FAQs. Questions expand and collapse.

- [ ] **Step 5: Commit**

```bash
git add frontend
git commit -m "feat: add 404 and FAQs pages"
```

---

## Phase 9: Documentation

### Task 20: Update the journey diagrams and checklist

**Files:**
- Modify: `docs/journeys/user-journeys.html`
- Modify: `docs/octopus-gap-checklist.md`

- [ ] **Step 1: Update the Mermaid diagrams**

In `docs/journeys/user-journeys.html`:
- `<section id="auth">`: after sign-in, users now land on the **Home** dashboard. Add the Home node with its profile-completeness prompt (green).
- `<section id="tradesperson">`:
  - Add Featured jobs → Job detail.
  - Add Job detail → **Apply page (cover note)** → Applied.
  - Add Job invite notification → Job detail.
  - Add Liked → Archived when the job is no longer open.
  - Add the application-limit gate leading to the Subscription upgrade.
  - Mark every new node green.
- `<section id="poster">`:
  - Add People / profile → **Hire Now (invite)** → notification to the tradesperson.
  - Add the Create Job company info step.
  - Add the post-limit gate leading to the Subscription upgrade.
  - Add the review_required notification → Review screen.
- `<section id="subscription">`: add the usage banner and the "limit reached → upgrade" path.
- `<section id="messaging">`: add the category chips (All / Unread / Job chats) and the notification settings / message mute.
- Update the `class` lines at the bottom of each block so the new nodes are `green`, and any node this work completed moves from yellow to green.

- [ ] **Step 2: Tick the checklist**

In `docs/octopus-gap-checklist.md`, change each section 1 item that's now done from `[ ]` to `[x]`.

- [ ] **Step 3: Commit**

```bash
git add docs
git commit -m "docs: update user journeys and gap checklist for sitemap work"
```

---

## Self-Review

**Spec coverage** (checklist section 1 → task):
- Usage banners: Tasks 1–3
- Posted upgrade prompt: Task 3
- Hire Now on People detail and People list: Tasks 4–5
- Dashboard: Task 13
- Featured jobs, load more and Create Job on Jobs listing: Task 11
- Apply page: Tasks 6–7
- Company info on Create Job: Task 15
- Liked tips and archived: Task 14
- Process reminder: Task 14
- People load more: Tasks 10, 12
- Biography: Tasks 8–9
- Gallery: Tasks 8–9
- Message categories: Task 16
- Notification settings: Task 17
- Review prompts: Task 18
- 404 and FAQs: Task 19
- Marketing site and breadcrumbs: out of scope, with reasons in the checklist

**Type consistency checked:**
- `Usage` and `UsageKind`: Tasks 3, 7, 13
- `mergePage` and `PAGE_SIZE`: Tasks 11, 12
- `InfoCard`: Tasks 13, 14
- `TIER_INFO.applications`: Tasks 3, 13
- `ApplyToJobAsync(jobId, userId, coverNote = null)`: Task 1 (constructor) and Task 6 (signature). Task 1's tests call it with two arguments, which still compiles.
- `JobService` constructor order: `..., IBackgroundJobClient, IUsageService, IMapper`, the same in Task 1's code and test.
- `MAX_GALLERY` (12) matches `UpdateUserRequestValidator.MaxGalleryImages` (12).
