---
name: subscription-management-design
description: Design spec for subscription management UI — current plan summary card and cancel-at-period-end flow
metadata:
  type: project
---

# Subscription Management — Design Spec

**Date:** 2026-07-10  
**Scope:** Add a current plan summary card and cancel-at-period-end action to the Subscription screen. Tier switching is unchanged.

---

## Overview

The Subscription screen currently lets users initiate a new checkout or upgrade their plan, but provides no way to view their current plan details or cancel. This spec covers adding both.

**Out of scope:** Reactivation (un-cancelling a scheduled cancellation).

---

## Data Model & API

### Backend: Domain model

Add two fields to `Subscription`:

```csharp
public bool CancelAtPeriodEnd { get; set; } = false;
public DateTimeOffset? CurrentPeriodEnd { get; set; }
```

A new EF migration is required.

### Backend: Stripe service

Add to `IStripeBillingService`:

```csharp
Task<DateTimeOffset> CancelSubscriptionAtPeriodEndAsync(string stripeSubscriptionId);
```

Stripe's `subscriptions.update({ cancel_at_period_end: true })` returns the updated subscription object including `current_period_end` (Unix timestamp). The implementation converts this to `DateTimeOffset` and returns it.

### Backend: Subscription service

Add to `ISubscriptionService`:

```csharp
Task<SubscriptionDto> CancelCurrentAsync(Guid userId);
```

Implementation in `SubscriptionService.CancelCurrentAsync`:

1. Find the user's active subscription.
2. If no active subscription exists: throw `InvalidOperationException("No active subscription to cancel.")`.
3. If `StripeSubscriptionId` is null (user created a record but never completed Stripe checkout): set `IsActive = false`, `CancelledAt = now`, save, return DTO.
4. Otherwise: call `CancelSubscriptionAtPeriodEndAsync`, store the returned `DateTimeOffset` in `CurrentPeriodEnd`, set `CancelAtPeriodEnd = true`, save, return updated DTO.

### Backend: Controller

New endpoint on `SubscriptionsController`:

```
DELETE /api/subscriptions/current
→ 200 SubscriptionDto
→ 400 if no active subscription
```

### Backend: SubscriptionDto

Add two new fields:

```csharp
public bool CancelAtPeriodEnd { get; set; }
public DateTimeOffset? CurrentPeriodEnd { get; set; }
```

Both are populated in the existing `ToDto()` helper.

---

## Frontend

### Service layer

Add to `subscriptionService`:

```ts
cancel: async (): Promise<SubscriptionDto> =>
  apiRequest<SubscriptionDto>('DELETE', '/subscriptions/current'),
```

### AppContext

Add `cancelSubscription()`:

```ts
cancelSubscription: async () => {
  const sub = await subscriptionService.cancel();
  // Reflect cancelled state; subscription tier itself doesn't change
  setCurrentUser(prev => prev ? { ...prev, subscription: sub.tier as SubscriptionTier } : prev);
  return sub;
}
```

Expose `cancelSubscription` in `AppContextType`.

### Subscription screen state

Replace `isSubscriptionActive: boolean` with `currentSub: SubscriptionDto | null`. Load on mount from `subscriptionService.getCurrent()`. Update after cancel with the response DTO.

---

## UI Components

### CurrentPlanSummary card

Rendered at the top of the scroll view when `currentSub?.isActive` is true.

Content:
- **Tier badge:** coloured pill (bronze/silver/gold brand colours) + tier name
- **"Your current plan"** label in `colors.textLight`
- **Status row:**
  - Normal: `Ionicons "calendar-outline"` + "Active since [startedAt formatted as DD MMM YYYY]"
  - Cancelling: `Ionicons "alert-circle-outline"` in amber + "Cancels on [currentPeriodEnd formatted]"
- **"Cancel subscription"** — destructive text button, only shown when `cancelAtPeriodEnd` is false. Tapping opens the cancel confirmation modal.

### Cancel confirmation modal

Separate `Modal` component, independent of the existing upgrade modal.

Content:
- Icon: `MaterialCommunityIcons "alert-circle-outline"` in amber
- Title: "Cancel your subscription?"
- Body: "Your [Tier] plan stays active until the end of your current billing period. After that you'll lose access to the jobs board and paid features."
- **Primary button** (full-width, brand primary): "Keep my plan" — dismisses modal. This is the non-destructive easy path.
- **Secondary button** (outlined, destructive red): "Yes, cancel" — calls `cancelSubscription()`, shows loading state, dismisses on success, updates summary card in-place. On error: `Alert.alert` with message, modal stays open.

### Tier-switching UX

Unchanged. The `SubscriptionCard` components and upgrade modal are untouched.

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| `cancelSubscription()` API error | Alert with error message; modal stays open; no state change |
| No active subscription (defensive) | "Cancel" button is not rendered; endpoint returns 400 |
| `StripeSubscriptionId` null | Backend deactivates immediately; DTO returns `isActive: false`; frontend removes summary card |
| `currentPeriodEnd` null after cancel | Show "end of your billing period" without a specific date |

---

## Files Changed

| File | Change |
|------|--------|
| `backend/.../Domain/Subscription.cs` | Add `CancelAtPeriodEnd`, `CurrentPeriodEnd` fields |
| `backend/.../Stubs/IStripeBillingService.cs` | Add `CancelSubscriptionAtPeriodEndAsync` |
| `backend/.../Services/StripeBillingService.cs` | Implement new method |
| `backend/.../Services/Interfaces/ISubscriptionService.cs` | Add `CancelCurrentAsync` |
| `backend/.../Services/SubscriptionService.cs` | Implement `CancelCurrentAsync` |
| `backend/.../Controllers/SubscriptionsController.cs` | Add `DELETE /api/subscriptions/current` |
| `backend/.../DTOs/Subscriptions/SubscriptionDto.cs` | Add two new fields |
| `backend/.../Data/Migrations/` | New EF migration |
| `frontend/src/services/subscriptionService.ts` | Add `cancel()` method |
| `frontend/context/AppContext.tsx` | Add `cancelSubscription()` |
| `frontend/app/subscription.tsx` | Summary card, cancel modal, state upgrade |
