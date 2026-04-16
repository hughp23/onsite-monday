# Onsite Monday — Backend API Implementation Phases

Each phase is self-contained and can be run independently. Approve one phase at a time.

---

## Phase 1 — Project Scaffold

**What this does:** Creates the .NET 8 solution, project files, folder structure, and installs all NuGet packages. No logic — just the skeleton.

**Prerequisites:** .NET 8 SDK installed (`dotnet --version`), `dotnet-ef` global tool installed.

**Steps:**
1. Create solution + API project + test project under `backend/`
2. Add all NuGet packages to API project
3. Create all empty folders: `Controllers/`, `Domain/`, `DTOs/`, `Services/`, `Repositories/`, `Data/`, `Middleware/`, `Validators/`, `Mapping/`, `Stubs/`
4. Add `appsettings.json` and `appsettings.Development.json` with PostgreSQL connection string template
5. Scaffold minimal `Program.cs` that compiles and runs (no routes yet)
6. Add `secrets/` and `.env` to `.gitignore`

**Output:** `dotnet build` passes, `dotnet run` starts the server with no errors.

---

## Phase 2 — Domain Entities + Database

**What this does:** Defines all EF Core entity classes, configures `AppDbContext`, and creates + applies the initial migration.

**Prerequisites:** Phase 1 complete, local PostgreSQL running with `onsitemonday_dev` database created.

**Steps:**
1. Create all 8 entity classes in `Domain/`: `User`, `Subscription`, `Job`, `JobApplication`, `Conversation`, `Message`, `Review`, `Notification`
2. Configure `AppDbContext` with all entity relationships, unique indexes, and `text[]` column types
3. Wire `AppDbContext` into `Program.cs` with the connection string
4. Run `dotnet ef migrations add InitialSchema --output-dir Data/Migrations`
5. Run `dotnet ef database update`
6. Create `DataSeeder.cs` with UK trades seed data (translated from `data/seedData.ts`) — runs only in Development

**Output:** Database schema created, seeded with realistic test data. `dotnet run` starts cleanly.

---

## Phase 3 — Authentication + Users API

**What this does:** Wires Firebase JWT validation and implements the Users endpoints. First fully working API feature.

**Prerequisites:** Phase 2 complete, Firebase project created (or test project ID available).

**Steps:**
1. Configure `JwtBearer` authentication in `Program.cs` pointing at Firebase JWKS endpoint
2. Create `ErrorHandlingMiddleware` for consistent error responses
3. Create `UserDto`, `UpdateUserRequest`, `TradespersonDto`
4. Create `IUserRepository` + `UserRepository` (with `GetOrCreateByFirebaseUidAsync`)
5. Create `IUserService` + `UserService`
6. Create `MappingProfile.cs` (AutoMapper) for User → UserDto
7. Create `UpdateUserRequestValidator` (FluentValidation)
8. Implement `UsersController`:
   - `GET /api/users/me`
   - `PUT /api/users/me`
   - `GET /api/users/tradespeople` (with `?trade=&location=` filters)
   - `GET /api/users/{id}`
   - `POST /api/users/me/onboard`
9. Add `GET /api/health` (no auth)

**Output:** Postman test — obtain Firebase JWT, hit `GET /api/users/me`, get back a user profile (auto-created on first call).

---

## Phase 4 — Jobs API

**What this does:** Full job lifecycle — create, list, apply, accept, complete.

**Prerequisites:** Phase 3 complete.

**Steps:**
1. Create `JobDto`, `JobSummaryDto`, `CreateJobRequest`
2. Create `IJobRepository` + `JobRepository` (LEFT JOIN `JobApplications` for `isInterested` field)
3. Create `IJobService` + `JobService` (status transition logic)
4. Create `CreateJobRequestValidator`
5. Add Job → User mappings to `MappingProfile.cs`
6. Implement `JobsController`:
   - `GET /api/jobs` (filterable: `?trade=&location=&status=&page=&pageSize=`)
   - `POST /api/jobs`
   - `GET /api/jobs/{id}`
   - `GET /api/jobs/my/posted`
   - `GET /api/jobs/my/accepted`
   - `POST /api/jobs/{id}/interest` (toggle — creates or deletes `JobApplication`)
   - `PUT /api/jobs/{id}/accept` (body: `{ applicantId }`)
   - `PUT /api/jobs/{id}/complete`

**Output:** Full job lifecycle tested end-to-end in Postman. Job status transitions correctly: `open → applied → accepted → in_progress → completed`.

---

## Phase 5 — Reviews + Notifications + Conversations

**What this does:** Implements the review system (with live rating recalculation), notifications (created as side-effects of other actions), and the conversations + messaging endpoints.

**Prerequisites:** Phase 4 complete.

**Steps:**

**Reviews:**
1. Create `ReviewDto`, `SubmitReviewRequest`, `SubmitReviewRequestValidator`
2. Create `IReviewRepository` + `ReviewRepository`
3. Create `IReviewService` + `ReviewService`:
   - Validates job is `completed` and no review exists yet
   - Inserts review
   - Recalculates `User.Rating` + `User.ReviewCount` via `AVG(rating)`
   - Creates a `Notification` for the reviewee
   - Calls `StubStripeService.TriggerPayoutAsync()`
4. Implement `ReviewsController`:
   - `POST /api/users/{id}/reviews`
   - `GET /api/users/{id}/reviews`

**Notifications:**
1. Create `NotificationDto`
2. Create `INotificationRepository` + `NotificationRepository`
3. Create `INotificationService` + `NotificationService`
4. Implement `NotificationsController`:
   - `GET /api/notifications`
   - `PUT /api/notifications/{id}/read`
   - `PUT /api/notifications/read-all`

**Conversations:**
1. Create `ConversationDto`, `MessageDto`, `SendMessageRequest`, `SendMessageRequestValidator`
2. Create `IConversationRepository` + `ConversationRepository`
3. Create `IConversationService` + `ConversationService` (upsert pair on POST)
4. Implement `ConversationsController`:
   - `GET /api/conversations`
   - `POST /api/conversations` (upserts — returns existing if pair already exists)
   - `GET /api/conversations/{id}`
   - `POST /api/conversations/{id}/messages`
   - `PUT /api/conversations/{id}/read`

**Output:** Submit a review → user rating updates → notification appears. Send messages → conversation persists.

---

## Phase 6 — Subscriptions + Phase-2 Stubs

**What this does:** Implements subscription tier management and creates no-op stubs for Stripe, FCM, and SendGrid so service layer calls compile without errors.

**Prerequisites:** Phase 5 complete.

**Steps:**
1. Create stub interfaces + implementations:
   - `IStripeService` / `StubStripeService` (logs payout calls, returns stub IDs)
   - `INotificationPushService` / `StubNotificationPushService` (logs FCM payloads)
   - `IEmailService` / `StubEmailService` (logs SendGrid calls)
2. Register stubs in `Program.cs` DI
3. Create `UpdateSubscriptionRequest`
4. Create `ISubscriptionService` + `SubscriptionService`:
   - Deactivates existing active subscription
   - Creates new subscription with correct `PayoutDays` (bronze=30, silver=14, gold=7)
5. Implement `SubscriptionsController`:
   - `GET /api/subscriptions/current`
   - `POST /api/subscriptions` (body: `{ tier }`)
6. Wire `StubStripeService` into `ReviewService` (payout trigger on review)

**Output:** Subscription tier changes persist. All service layer stub calls compile and log correctly.

---

## Phase 7 — Frontend Services Layer

**What this does:** Adds `src/services/` to the React Native project, creates a new `AuthContext`, and refactors `AppContext` to call real APIs instead of mutating in-memory state.

**Prerequisites:** Phases 1–6 complete, API running locally at `http://localhost:5000`, Firebase client SDK added to the Expo project.

**Steps:**
1. Install Firebase client SDK: `npm install firebase`
2. Create `lib/firebase.ts` — initialise Firebase app + auth
3. Create `src/services/api.ts` — base fetch wrapper that attaches Firebase JWT
4. Create service files:
   - `src/services/userService.ts`
   - `src/services/jobService.ts`
   - `src/services/conversationService.ts`
   - `src/services/notificationService.ts`
   - `src/services/reviewService.ts`
   - `src/services/subscriptionService.ts`
5. Create `context/AuthContext.tsx` — wraps Firebase `onAuthStateChanged`, exposes `signInWithEmail`, `signOut`
6. Refactor `context/AppContext.tsx`:
   - `signIn` → load user/jobs/conversations/notifications via `Promise.all`
   - Each mutation (e.g. `toggleJobInterest`) uses optimistic update + service call + rollback on error
7. Update `app/_layout.tsx` to wrap with `AuthContextProvider`
8. Run `npx tsc --noEmit` — no type errors

**Output:** App fully functional against real API. Data persists across reloads. Sign in with a real Firebase account.

---

## Quick Reference — Phase Dependencies

```
Phase 1 (Scaffold)
    └── Phase 2 (Database)
            └── Phase 3 (Auth + Users)
                    └── Phase 4 (Jobs)
                            └── Phase 5 (Reviews + Notifications + Conversations)
                                    └── Phase 6 (Subscriptions + Stubs)
                                                └── Phase 7 (Frontend Services)
```
