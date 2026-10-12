# Octopus.do Sitemap vs Codebase: Gap Checklist

**Source diagram:** https://octopus.do/igaujipfuvn (Main, Components, Other pages and Marketing website sections)
**Codebase reviewed:** `frontend/app/` (Expo Router), `frontend/src/services/`, `backend/src/OnsiteMonday.Api/`
**Reviewed on:** 2026-10-12

Status key: `[ ]` open, `[x]` done, `[-]` decided not to build (reason given)

The implementation plan for section 1 is in [`docs/superpowers/plans/2026-10-12-octopus-sitemap-gaps.md`](superpowers/plans/2026-10-12-octopus-sitemap-gaps.md). Each item below lists the task that covers it.

---

## 1. In the diagram but missing or partial in the code

### Subscription usage limits
- [ ] **Applications/postings remaining banner (upgrade prompt).** The diagram shows it on the Jobs Board (03A) and on the Liked, Applied, My Work and Posted tabs (04). Nothing counts or enforces monthly limits in the frontend or backend. `components/SubscriptionCard.tsx` advertises "1-2 per month" and "Up to 5 per month", but nothing applies those numbers. *(Plan tasks 1–3)*
- [ ] **Posted tab: prompt to upgrade or enter a subscription.** *(Task 3)*

### Hiring
- [ ] **05B People detail: Hire Now.** The button at `app/person/[id].tsx:201` has no `onPress`. *(Tasks 4–5)*
- [ ] **05A People list: Hire.** The modal only shows an "Invite sent" toast (`app/(tabs)/people.tsx:66`). Nothing reaches the backend, so the tradesperson is never told. *(Tasks 4–5)*
- [ ] **Hire Now page.** This page is empty in the diagram. The plan treats Hire Now as "invite this tradesperson to apply for one of my open jobs". *(Tasks 4–5)*

### Jobs
- [ ] **02 Homepage / Dashboard:** featured jobs, Create Job, "finish setting up your profile" and subscription tier info. There's no dashboard: after sign-in you land on the Jobs tab. *(Task 13)*
- [ ] **03A Jobs listing: featured jobs.** *(Task 11)*
- [ ] **03A Jobs listing: load more.** The frontend calls `GET /api/jobs` with no `page`, so the backend default `pageSize = 20` silently caps the board at 20 jobs. **This is a bug as well as a gap.** *(Task 11)*
- [ ] **03A Jobs listing: Create Job shortcut.** *(Task 11)*
- [ ] **03C Apply for a job:** an application page with a form. Today it's a yes/no confirmation pop-up (`app/job/[id].tsx:218`). *(Tasks 6–7)*
- [ ] **04B Create job: company information.** *(Task 15)*

### My Jobs
- [ ] **Liked tab: tips for success.** *(Task 14)*
- [ ] **Liked tab: archived jobs.** Liked jobs that are no longer open. *(Task 14)*
- [ ] **My Work tab: process reminder.** *(Task 14)*

### People
- [ ] **05A People listing: load more.** `GET /api/users/tradespeople` has no paging. *(Tasks 10, 12)*
- [ ] **05B People detail: biography.** There's no `Bio` field anywhere. *(Tasks 8–9)*
- [ ] **05B / 07 Work gallery (portfolio).** The Profile tab gallery is fixed text that always says "No gallery photos yet" (`app/(tabs)/profile.tsx:248`). Edit Profile has no gallery upload. People detail shows a gallery that nothing can fill. *(Tasks 8–9)*

### Messages and notifications
- [ ] **06A Messages: message categories.** *(Task 16)*
- [ ] **08 Notifications: manage settings and notification preferences.** *(Task 17)*
- [ ] **Review prompts (Notifications → "notification prompt to review", "review prompt sent after job completion date").** The backend already sends `job_completion_pending` and `review_required`. The frontend doesn't list those types in `NotificationType`, has no icons for them, and tapping them does nothing (`app/notifications.tsx:32` only routes `application` and `accepted`). *(Task 18)*

### Other pages
- [ ] **404 error page.** There's no `app/+not-found.tsx`. *(Task 19)*
- [ ] **FAQs.** *(Task 19)*
- [-] **Marketing website / landing page.** Not part of the React Native app. This belongs in a separate web project.
- [-] **Breadcrumbs (every page) and "Go back" (06A).** Mobile uses the native header back button. This is a web pattern carried into the diagram.

---

## 2. In the code but missing from the diagram

Add these to the Octopus map so it reflects the app.

- [ ] **Wallet** (`app/wallet.tsx`): Stripe Express onboarding, KYC state, bank account, withdrawals
- [ ] **Forgot password** (`app/forgot-password.tsx`) and **reset password** (`app/reset-password.tsx`)
- [ ] **Sign-up steps:** onboarding slides and the email verification code (`app/sign-up.tsx`). The diagram has a single "Sign Up/In Form".
- [ ] **Welcome screen** (`app/index.tsx`): "Let's get started" and sign-in entry
- [ ] **Message buttons** on job detail ("Got a question?") and people detail
- [ ] **Mark job complete** confirmation (payment release) and the **outstanding review banner** on My Jobs
- [ ] **Start job** (poster pays into escrow through Stripe Checkout)
- [ ] **Cancel job** and **delete job** (Posted tab)
- [ ] **Sort** (newest, highest pay, shortest) and the filter modal (trade, location, minimum day rate) on the Jobs Board
- [ ] **Profile sections:** skills, accreditations, day rate, location and travel radius, reviews
- [ ] **Edit profile** (`app/edit-profile.tsx`)
- [ ] **Subscription** (`app/subscription.tsx`). This is the diagram's empty "Membership Tiers" page, which should be filled in to match.
- [ ] **Notification bell** with an unread badge in every tab header
- [ ] **Two review screens:** `review/[jobId]` (poster reviews tradesperson) and `review-poster/[jobId]` (tradesperson reviews poster)

---

## 3. Naming and structure mismatches

- [ ] Button labels: the diagram says "Hire Now", "Apply Now" and "Post a Job". The app shows "Hire {name}", "Apply" and "Post Job" (`create-job`). Pick one set of names.
- [ ] The diagram numbers People as **05A** in the page tree but **05** in Components → Page Types. Align them.
- [ ] Several diagram pages are empty placeholders: Hire Now (x2), the three review pages, Membership Tiers, the notification review prompt, 404, FAQs and Landing Page. Fill them in once the plan's decisions are confirmed.
