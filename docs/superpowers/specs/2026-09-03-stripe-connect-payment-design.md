# Onsite Monday — Protected Payments Design

**Date:** 3 September 2026
**Audience:** Founders (non-technical overview)
**Status:** Approved for implementation

---

## Overview

This document describes how Onsite Monday will handle payments between job posters and tradespeople. It replaces the original escrow approach (Mangopay) with a simpler, cheaper model built on Stripe — a payment provider we already use for subscriptions.

The model is called **Protected Payments**. It works like escrow from the user's perspective — the poster's money is held securely until the job is done and reviewed — but it avoids the regulatory and cost burden of running a formal escrow service.

---

## Why We Changed Approach

The original plan used Mangopay, a specialist escrow and e-money platform. Mangopay is well-suited for large, mature marketplaces but has meaningful upfront cost: setup fees, monthly platform fees, and per-transaction charges that are hard to absorb before we have volume.

Stripe Connect — Stripe's marketplace product — achieves the same outcome at a fraction of the cost:

| | Mangopay | Stripe Connect |
|---|---|---|
| Setup fee | Yes | None |
| Monthly fee | Yes | None |
| Per-transaction fee | Yes + Mangopay margin | ~1.5% + 20p (UK cards) |
| KYC/KYB handled by platform? | No — built by us | Yes — Stripe handles it |
| Already in codebase? | Yes | Yes (for subscriptions) |
| Vendors to manage | 2 (Mangopay + Stripe) | 1 (Stripe only) |

Stripe is also already integrated into the app for subscription billing, so extending it to handle job payments means one vendor, one dashboard, and less complexity to maintain.

---

## What Is "Protected Payments"?

Protected Payments is our name for the payment experience we offer users. Here is what it means in plain terms:

- **Job posters** pay when they confirm a hire. Their money is held securely by Stripe — a regulated financial institution — and is not released to the tradesperson until the job is complete and a review has been submitted.
- **Tradespeople** know the money is sitting ready before they show up. Once the job is done and reviewed, it is transferred to their account and paid out within an agreed window.
- **The platform** retains a small percentage fee automatically on every job payment, in addition to subscription revenue.

> **Important:** We do not call this "escrow" in our terms or marketing. Escrow is a regulated term in the UK. What we offer is functionally the same — held funds, released on completion — but it is Stripe that holds the funds and the regulatory licence, not us. This means Onsite Monday does not need its own FCA authorisation for this model.

---

## How It Works — Step by Step

```
┌─────────────────┬──────────────────────┬──────────────────────┬────────────────────┐
│   Job Poster    │   OM Platform        │       Stripe         │   Tradesperson     │
├─────────────────┼──────────────────────┼──────────────────────┼────────────────────┤
│ 1. Accepts hire │ ──────────────────── │                      │                    │
│    & pays by    │                      │ 2. Card charged.     │                    │
│    card in app  │ ─────────────────────▶   Funds held in OM's │                    │
│                 │                      │   Stripe balance     │                    │
│                 │ 3. Payment confirmed ◀──────────────────── │                    │
│                 │    via webhook.      │                      │                    │
│                 │    Job: Funds Held   │                      │                    │
│                 │                      │                      │                    │
│                 │ 4. Job begins.       │                      │ 5. Tradesperson    │
│                 │    Status: In        │                      │    completes work  │
│                 │    Progress          │                      │    on site         │
│                 │                      │                      │                    │
│ 6. Marks job    │                      │                      │                    │
│    complete &   │ ◀─────────────────── │                      │                    │
│    submits      │                      │                      │                    │
│    review       │                      │                      │                    │
│                 │ 7. Review received.  │                      │                    │
│                 │    Triggers payout   │ ─────────────────────▶                    │
│                 │                      │ 8. Platform fee kept │                    │
│                 │                      │    automatically.    │                    │
│                 │                      │    Remainder sent to │ ──────────────────▶│
│                 │                      │    tradesperson      │ 9. Funds paid out  │
│                 │                      │    account           │    to bank within  │
│                 │                      │                      │    agreed window   │
└─────────────────┴──────────────────────┴──────────────────────┴────────────────────┘
```

**The critical gate:** the payout is only triggered after the poster submits their review. Neither party can skip this step. This ensures reviews are genuine and timely, and protects tradespeople from non-payment.

---

## Regulatory & Compliance Position

### Who holds the money?

Stripe. At no point does Onsite Monday hold funds directly. Stripe is an FCA-authorised e-money institution operating in the UK. They are the custodian of all funds between payment and payout.

### What does Onsite Monday need to do?

- Accept Stripe's platform terms (already done for subscriptions)
- Ensure our terms of service clearly describe the payment flow to users
- Ensure job posters and tradespeople each accept Stripe's connected account agreement during sign-up
- Support Strong Customer Authentication (SCA/3DS2) — Stripe handles this automatically in our checkout flow

### What do we NOT need?

- Our own FCA registration or e-money licence
- A separate regulated escrow account
- A formal escrow agent

### What about identity verification?

Stripe handles all identity verification (KYC/KYB) automatically:

- **Individual tradesperson** — Stripe verifies name, date of birth, address, and bank account
- **Sole trader or limited company** — Stripe also verifies business registration details and directors

This happens through Stripe's hosted onboarding flow, which we embed directly in the app. We do not build or manage any identity verification ourselves — Stripe owns that process and takes on the associated compliance burden.

---

## Cost & Revenue Model

### What Stripe charges

| Fee | When |
|---|---|
| ~1.5% + 20p | Each time a job poster's card is charged (UK cards) |
| Small payout fee | Each time funds are transferred to a tradesperson |
| Nothing | Monthly, setup, or account fees |

These fees are deducted automatically. There are no invoices or monthly commitments.

### What the platform earns

On every job payment, the platform retains a percentage fee before transferring the remainder to the tradesperson. This happens automatically — Stripe transfers less than the amount charged, and the difference stays in our Stripe balance.

**Platform transaction fee: TBD** (to be decided by founders)

Typical marketplace transaction fees range from 5–15%. This is separate from subscription revenue.

### Example

If a job is priced at **£500** and the platform fee is **10%**:

| | Amount |
|---|---|
| Poster pays | £500 |
| Stripe processing fee (~) | −£7.70 |
| Platform fee (10%) | −£50 |
| Tradesperson receives | £442.30 |
| Platform keeps (net of Stripe fees) | ~£42.30 |

---

## User Experience

### Job Poster

1. Browses the jobs board and hires a tradesperson
2. Enters card details in the app — payment taken immediately on hire confirmation
3. Receives confirmation that funds are securely held
4. When the job is done, marks it complete and submits a mandatory review
5. Sees confirmation that the tradesperson has been paid

### Tradesperson

1. Completes Stripe's identity verification once during sign-up (takes a few minutes, guided by Stripe)
2. Applies for and accepts jobs as normal
3. Can see in the app that payment is secured before starting work
4. Completes the job
5. Receives funds in their account within the payout window after the poster submits a review
6. Views their earnings history and payout schedule in their account dashboard

---

## Account Structure

Both subscription payments and job payments run through the same Stripe account — no separation needed. Stripe tracks them separately by type and they appear distinctly in the dashboard.

| Payment type | What it is | Stripe product used |
|---|---|---|
| Subscription | Monthly fee from tradespeople (Bronze/Silver/Gold tiers) | Stripe Billing |
| Job payment | Client pays for a job, tradesperson receives payout | Stripe Connect |

---

## What This Replaces

The original implementation used Mangopay for job payments. Replacing it with Stripe Connect removes:

- Mangopay PayIn (card charging)
- Mangopay Wallets (one per user)
- Mangopay Transfers (wallet to wallet)
- Mangopay PayOut (wallet to bank)
- Mangopay Webhooks (payment events)
- Custom KYC controller (identity document upload)

All of the above are replaced by Stripe Connect's native equivalents. The subscription billing (Stripe) remains unchanged.

---

## Open Questions for Founders

| Question | Notes |
|---|---|
| **Platform transaction fee %** | To be set before launch. Typical range: 5–15%. Affects tradesperson take-home and platform unit economics. |
| **Payout window** | How many days after job completion + review does the tradesperson receive their money? Suggest launching with a single fixed window (e.g. 7 or 14 days). Tier-based delays (Bronze slower, Gold faster) can be added later. |
| **Dispute handling** | If a poster disputes a charge after marking complete, Stripe's dispute process applies. We need a clear policy for how the platform mediates. |
| **Refunds / cancellations** | What happens if a job is cancelled after payment is taken but before work starts? Policy needed before launch. |
