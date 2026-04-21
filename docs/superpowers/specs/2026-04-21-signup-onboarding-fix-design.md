# Sign-Up Onboarding Fix & Subscription Selection

**Date:** 2026-04-21  
**Status:** Approved

## Problem

When a new user enters their name, email, and password on slide 1 of the sign-up carousel, Firebase creates an account and fires `onAuthStateChanged`. This sets `isAuthenticated = true` in `AppContext`, and `index.tsx` immediately redirects to `/(tabs)/jobs` — skipping slides 2–8 entirely. The user lands in the app with an incomplete profile.

Additionally, there is no subscription tier selection during sign-up; users default to Bronze and must upgrade later from the profile screen.

## Solution Overview

1. Gate app routing on `isOnboarded` (not just `isAuthenticated`)
2. Add a subscription selection slide to the sign-up carousel (prompted, skippable)
3. Enforce required fields on key slides
4. Pre-populate carousel with existing data for returning incomplete-profile users
5. Call the existing `completeOnboarding()` endpoint on carousel completion

---

## Routing Fix (`app/index.tsx`)

Change the routing guard from `isAuthenticated` to `isAuthenticated && currentUser?.isOnboarded`.

| State | Route |
|-------|-------|
| `!isAuthenticated` | Welcome screen |
| `isAuthenticated && !isOnboarded` | `/sign-up` (carousel) |
| `isAuthenticated && isOnboarded` | `/(tabs)/jobs` |

- Wait for both `isAuthLoading === false` AND `currentUser` loaded before routing (prevents flash-redirects during async profile fetch)
- If the user is already on `/sign-up`, do not push again (prevents redirect loop)

---

## Carousel Changes (`app/sign-up.tsx`)

### New Slide Order (9 slides)

| # | Slide | Required | Change |
|---|-------|----------|--------|
| 1 | Credentials (first name, last name, email, password) | ✓ | Split "Full Name" into First Name + Last Name |
| 2 | Trade selection | ✓ | No change |
| 3 | Skills selection | ✓ | No change |
| 4 | Accreditations | optional | No change (keep "Skip for now") |
| 5 | Day Rate | ✓ | No change |
| 6 | Location & Travel Radius | ✓ | No change |
| 7 | Profile Photo | optional | No change (keep "Skip for now") |
| **8** | **Subscription Selection** | prompted | **New** |
| 9 | Summary & Complete | — | Renumbered from 8 |

### Subscription Slide (slide 8)

- Display Bronze (£29/mo), Silver (£59/mo), Gold (£129/mo) tier cards using the existing `SubscriptionCard` component from `app/subscription.tsx`
- Selecting a tier stores `selectedTier: SubscriptionTier` in carousel local state — no API call at this point
- "Start on Bronze" text link skips without selecting (leaves `selectedTier` as `null`)
- "Continue" button always enabled (this slide is prompted, not required)

### Required Field Enforcement

Disable the "Continue" button on slides 2, 3, 5, and 6 until required fields have a value:
- Slide 2: trade selected
- Slide 3: at least one skill selected
- Slide 5: day rate > 0
- Slide 6: location string non-empty

### Carousel Completion Handler (`handleComplete`)

On slide 9 "Go to Jobs Board":
1. Call `updateCurrentUser({...allProfileFields})` — saves full profile to API
2. Call `completeOnboarding()` — sets `isOnboarded = true` on backend (`POST /users/me/onboard`)
3. If `selectedTier` is `silver` or `gold`: route to `/(tabs)/jobs` then immediately present `/subscription` modal pre-selected on chosen tier
4. If `selectedTier` is `bronze` or `null`: route to `/(tabs)/jobs` directly

---

## State Pre-population for Returning Users

When `isAuthenticated && !isOnboarded` sends a returning user to the carousel:
- Initialise carousel form state from `currentUser` (already loaded in `AppContext`)
- **Skip slide 1** — the user already has a Firebase account; attempting `signUpWithEmail()` again would fail. Start returning users at slide 2 (trade selection)
- Slides with previously saved data show that data pre-filled
- Advance to the first incomplete required slide among slides 2–6

---

## Key Files

| File | Change |
|------|--------|
| `frontend/app/index.tsx` | Update routing guard: check `isOnboarded` |
| `frontend/app/sign-up.tsx` | Add subscription slide, required field enforcement, pre-population, updated `handleComplete` |
| `frontend/context/AppContext.tsx` | Ensure `isOnboarded` is exposed from `currentUser` (likely already is via `currentUser.isOnboarded`) |

### Existing Infrastructure to Reuse

- `completeOnboarding()` in `frontend/src/services/userService.ts` — calls `POST /users/me/onboard`
- `SubscriptionCard` component in `frontend/app/subscription.tsx` (extract if not already standalone)
- `updateSubscription(tier)` in subscription service — called post-onboarding for paid tier selection
- `currentUser.isOnboarded: boolean` — already defined in `constants/types.ts`

---

## Verification

| Scenario | Expected Result |
|----------|----------------|
| New sign-up, complete all slides, select paid tier | Jobs board loads + subscription modal opens pre-selected |
| New sign-up, tap "Start on Bronze" | Jobs board loads directly |
| New sign-up, skip accreditations and photo | Onboarding completes successfully |
| Required slide with empty field | "Continue" button disabled |
| Returning user with `isOnboarded = false` | Redirected to carousel with existing data pre-populated |
| Returning user with `isOnboarded = true` | Goes straight to jobs board |
| App restart mid-carousel (slides 1–8) | Redirected back to carousel, not to jobs board |
