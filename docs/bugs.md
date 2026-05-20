# Known Bugs

Audited 2026-05-18. Bugs are grouped by severity. Fix them in order — the critical group is all on the review/payment completion path.

---

## Critical

### BUG-01 · Review submitted against wrong tradesperson

**File:** `frontend/app/review/[jobId].tsx:28-40`

The tradesperson to review is identified by `tradespeople.find(tp => tp.trade === job?.trade) || tradespeople[0]` — the first person in the public People list with a matching trade, falling back to index 0 of whoever happens to be loaded. It has no connection to the accepted applicant on the job. A poster could submit a review against a random user.

**Fix:** Load the accepted applicant ID from the job object (`job.acceptedApplicantId` or fetch it from the applicants endpoint) and pass that ID to `submitReview`.

---

### BUG-02 · `confirmComplete` doesn't await the API call before navigating

**File:** `frontend/app/(tabs)/my-jobs.tsx:86-91`

```ts
const confirmComplete = () => {
  if (completeModalJob) {
    markJobComplete(completeModalJob.id);  // not awaited
    setCompleteModalJob(null);
    router.push(`/review/${completeModalJob.id}`);
  }
};
```

If the API call fails, the user lands on the review screen with the job still in `in_progress` state. No error is shown.

**Fix:** Make `confirmComplete` async, await `markJobComplete`, and wrap in try/catch to show an error alert on failure.

---

### BUG-03 · `submitReview` not awaited — success modal fires regardless of outcome

**File:** `frontend/app/review/[jobId].tsx:37-47`

```ts
const handleSubmit = () => {
  if (tradesperson) {
    submitReview(tradesperson.id, { ... });  // not awaited
  }
  setShowSuccess(true);  // always fires
};
```

If the API returns an error (duplicate review, job not completed, etc.) the user still sees "Review Submitted!" and is told their payout is incoming.

**Fix:** Make `handleSubmit` async, await `submitReview`, and only show the success modal on success. Show an error alert on failure.

---

### BUG-04 · Backend accepts a review for a non-completed job

**File:** `backend/src/OnsiteMonday.Api/Services/ReviewService.cs:39-50`

`SubmitReviewAsync` only checks for a duplicate review (`ExistsForJobAsync`). It does not validate that the job is in `completed` status. The review is persisted and the rating recalculates, but `MaybeSchedulePayoutAsync` silently returns without scheduling payout (line 82 checks `job.Status != "completed"`). Result: the job is permanently stuck — one review stored, no payout ever scheduled, and no second review possible.

**Fix:** Add a guard at the top of `SubmitReviewAsync`:
```csharp
var job = await _jobRepo.GetByIdRawAsync(request.JobId)
    ?? throw new KeyNotFoundException($"Job {request.JobId} not found.");
if (job.Status != "completed")
    throw new InvalidOperationException("Reviews can only be submitted for completed jobs.");
```

---

### BUG-05 · No frontend KYC or bank account setup screens

**File:** `frontend/app/wallet.tsx:64-66`

The wallet setup banner CTAs ("Verify identity →", "Retry verification →", "Add bank account →") all fire the same generic `Alert.alert('Setup Required', ...)`. The service (`kycService.ts`) and backend endpoints (`POST /api/kyc/document`, `PUT /api/users/me/bank-account`) exist, but there is no screen to use them. Users cannot complete KYC from the app.

**Fix:** Build KYC document upload and bank account registration screens; wire the banner CTAs to navigate to them.

---

### BUG-06 · Onboarding has no KYC step — users hit a 403 on their first job action

**File:** `frontend/app/sign-up.tsx:171-200`

The 9-slide onboarding flow has no identity verification step. A new user completes onboarding, arrives on the jobs board, taps "Apply" — and receives a 403 with no clear in-app path to resolve it. The wallet screen CTA that should direct them to KYC is also broken (see BUG-05).

**Fix:** Add a KYC slide to the onboarding flow (or a post-onboarding prompt), and ensure the 403 error surface on the jobs board links the user to their wallet/KYC screen.

---

## High Priority

### BUG-07 · `subscription.tsx` violates React Rules of Hooks

**File:** `frontend/app/subscription.tsx:26-29`

```tsx
if (!currentUser) return null;   // line 26

useEffect(() => {                 // line 29 — hook called after conditional return
```

When `currentUser` transitions null → non-null, React hooks are called in a different order than the prior render. This will cause a React warning and may produce unexpected behaviour.

**Fix:** Move the `useEffect` above the early return, or restructure to a guarded inner component.

---

### BUG-08 · Mangopay user accounts created with hardcoded birthday 1970-01-01

**File:** `backend/src/OnsiteMonday.Api/Services/MangopayService.cs:38-43`

```csharp
// KYC stub — birthday placeholder used until KYC Phase 2
new DateTime(1970, 1, 1),
```

Every Mangopay natural user is created with the same DOB. Mangopay will reject KYC document submissions where the account DOB doesn't match the uploaded ID. No DOB is collected anywhere in the app.

**Fix:** Add a date-of-birth field to the user profile and onboarding flow, store it on `User`, and pass it to `EnsureUserAsync`.

---

### BUG-09 · Job cancellation doesn't trigger a Mangopay refund

**File:** `backend/src/OnsiteMonday.Api/Services/JobService.cs:344-346`

When an escrowed job is cancelled, `paymentStatus` is set to `"refund_pending"` but no Mangopay refund API call is made. Funds stay in the platform wallet indefinitely until someone manually identifies and processes the `refund_pending` row.

**Fix:** Add a `RefundPayInAsync` method to `IMangopayService` / `MangopayService` and call it in `CancelJobAsync` when `job.PaymentStatus == "escrowed"`. Set status to `"refunded"` on success, keep `"refund_pending"` on failure so ops can retry.

---

### BUG-10 · "Mark as Complete" confirmation modal has inverted copy

**File:** `frontend/app/(tabs)/my-jobs.tsx:374-376`

Modal text reads: *"Marking as complete will **release the escrowed payment** and trigger a review."*

This is wrong. Marking complete does **not** release payment — payment is gated on the review submission. The modal will mislead posters into thinking funds are already on the way.

**Fix:** Change copy to: *"Marking as complete will notify the tradesperson to submit a review. Payment will be released once the review is received."*

---

## Medium Priority

### BUG-11 · Review success modal shows poster's payout days, not tradesperson's

**File:** `frontend/app/review/[jobId].tsx:34`

```ts
const payoutDays = PAYOUT_DAYS[currentUser.subscription];
```

`currentUser` is the poster. But payout speed is determined by the **tradesperson's** subscription tier (`ReviewService.cs:85` uses `tradesperson.ActiveSubscription?.PayoutDays`). The success modal tells the poster the wrong release timeline.

**Fix:** The backend `ReviewDto` (or a separate payout-schedule response) should return the scheduled payout date/days so the frontend can display an accurate value without guessing.

---

### BUG-12 · Stripe webhook tier detection is fragile; dead code present

**File:** `backend/src/OnsiteMonday.Api/Controllers/StripeWebhookController.cs:98-127`

`HandleSubscriptionUpdated` derives the tier from `Price.Nickname` using a case-insensitive `Contains` check. If Stripe price nicknames don't contain "bronze", "silver", or "gold", the webhook silently skips the update — the local subscription record's tier and `PayoutDays` are never synced.

There is also a dead `TierByPayoutDays` dictionary (lines 98–103) that is never used.

**Fix:** Store the tier string in Stripe price metadata (e.g. `metadata["tier"] = "silver"`) and read it from `Price.Metadata` in the webhook handler for a reliable lookup. Remove the unused `TierByPayoutDays` dictionary.

---

### BUG-13 · `MaybeSchedulePayoutAsync` loads job without navigation properties — fragile

**File:** `backend/src/OnsiteMonday.Api/Services/ReviewService.cs:78-97`

The job is loaded via `GetByIdRawAsync` (no `Include`). `tradesperson.ActiveSubscription` relies on the `Subscriptions` collection being populated. This works today because `reviewee` is loaded via `_userRepo.GetByIdAsync` which includes subscriptions, but if that query is changed the payout days will silently default to 30 regardless of tier with no error.

**Fix:** Either make the subscription dependency explicit (load subscriptions in `MaybeSchedulePayoutAsync` if not already loaded) or add a comment documenting the implicit contract.

---

### BUG-14 · `UserRepository.GetTradespeopleAsync` swallows meaningful exception context

**File:** `backend/src/OnsiteMonday.Api/Repositories/UserRepository.cs:66-89`

The method wraps the entire query in a try/catch that rethrows `new Exception("An error occurred while retrieving tradespeople.", ex)`. This replaces useful diagnostic information (e.g. a Postgres error) with a generic string.

**Fix:** Remove the try/catch entirely. The `ErrorHandlingMiddleware` already handles unhandled exceptions at the request boundary.

---

## Functional Gaps (not bugs, but missing features blocking the full flow)

| # | Area | What's missing |
|---|------|----------------|
| GAP-01 | Wallet | Transaction history is "coming soon" — no backend endpoint exists |
| GAP-02 | Payment return | After Mangopay redirect returns, the app doesn't poll/refresh job state to confirm escrow succeeded; the UI stays stale until next manual refresh |
| GAP-03 | KYC | No DOB collection anywhere — Mangopay accounts always created with `1970-01-01` (also covered in BUG-08) |
| GAP-04 | Reviews | Only one review direction (poster → tradesperson). No tradesperson → poster review |
| GAP-05 | Onboarding gate | `POST /api/users/me/onboard` has no KYC guard (intentionally removed in commit `4aca5bd`) — users can complete onboarding without identity verification even though job actions require it |
| GAP-06 | Subscription sync | `GET /api/subscriptions/current` and `currentUser.subscription` in AppContext can drift out of sync after a Stripe webhook update |
