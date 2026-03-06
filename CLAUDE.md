# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Onsite Monday** is a two-sided marketplace React Native app (iOS + Android) connecting tradespeople with job posters in the UK construction and trades sector. The full technical spec is in `onsite-monday-technical-spec.html`.

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native (single codebase, iOS + Android) |
| Backend API | .NET 8 / ASP.NET Core (to be integrated later) |
| Database | PostgreSQL on AWS RDS (in-memory data used until API is ready) |
| Auth | Firebase Auth (email/password, biometric, Google/Apple sign-in) |
| Payments | Stripe Connect (marketplace payments with delayed payouts) |
| Messaging | Stream or SendBird (real-time chat SDK) |
| Push Notifications | Firebase Cloud Messaging |
| Location | Google Maps API |
| Email/SMS | SendGrid + Twilio |
| Hosting | AWS (eu-west-2 London region for GDPR compliance) |

## Brand / Design Tokens

- Primary: `#8B2020` (dark red)
- Primary Light: `#A83232`
- Primary Dark: `#6B1818`
- Accent: `#D4A843` (gold)
- Background: `#FFF8F6`
- App name stylised as **Ônsite Monday** / **ÔM**

## Core Features (MVP Scope)

1. **Auth & Onboarding** — sign up / sign in, slide-by-slide profile setup, trade/skill selection, profile photo upload
2. **Profile System** — tradesperson profile (view/edit), skills & accreditations tags, day rate, location + travel radius slider, portfolio gallery
3. **Jobs Board** — job listing feed with sort/filter, job detail view, interest/apply button, job creation form, location-based matching
4. **My Jobs & Matching** — accepted jobs dashboard, job status tracking (`applied → accepted → complete`), connection between poster and applicant
5. **Payments** — Stripe Connect integration, delayed payout (escrow-like), subscription tier selection
6. **Reviews & Messaging** — mandatory review on job completion, star rating + text, in-app messaging, review display on profiles
7. **Subscription Tiers** — Bronze (£29/mo, 30-day payout), Silver (£59/mo, 14-day), Gold (£129/mo, 7-day), Platinum Enterprise (post-launch, 2-day)

## Payment Flow

Job Posted → Tradesperson Accepted → Funds Held in Stripe → Job Completed → Mandatory Review Submitted → Payout Released (timing depends on tier)

## User Roles

- **Tradesperson** — finds jobs, applies, gets paid, receives reviews
- **Job Poster / Client** — posts jobs, hires tradespeople, authorises payment, leaves mandatory reviews

## In-Memory Data (Pre-API Phase)

Until the .NET backend is integrated, all data is held in-memory (mock store). Keep mock data realistic and representative of UK trades. Structure the data layer so it can be swapped for real API calls with minimal changes (e.g., service/repository pattern in a `src/services/` or `src/api/` folder).

## Project Structure Convention

```
src/
  screens/        # One folder per screen/feature
  components/     # Shared UI components
  navigation/     # React Navigation config
  services/       # API/data access layer (mock now, real API later)
  store/          # State management (Context or Redux)
  theme/          # Colours, typography, spacing
  types/          # TypeScript interfaces
```

## Key Commands

```bash
# Start Metro bundler
npx react-native start

# Run on iOS
npx react-native run-ios

# Run on Android
npx react-native run-android

# Install dependencies
npm install

# TypeScript type check
npx tsc --noEmit

# Lint
npx eslint src/
```

## Architecture Notes

- Two-sided marketplace: every screen/component should consider which role (Tradesperson vs Job Poster) is active — store the active role in auth/user context.
- Messaging is a first-class feature — implement as a dedicated bottom-tab screen, not an afterthought.
- Location filtering is core to the jobs board — travel radius slider on profile affects which jobs a tradesperson sees.
- Payout timing is determined by the user's subscription tier; keep tier logic centralised.
