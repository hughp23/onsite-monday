# User Journey Diagrams — Design Spec

**Date:** 2026-05-18  
**Status:** Approved

---

## Context

The Onsite Monday app is a two-sided marketplace with two distinct user roles (Tradesperson and Job Poster/Client) across 22 screens. As the codebase grows, there is no high-level visual reference showing what each user journey looks like, where the current implementation stands, and what still needs to be built. This spec describes a set of standalone HTML diagram files that provide that reference — living outside the code, easy to update, and visible to anyone without a dev environment.

---

## Decisions

| Question | Decision |
|---|---|
| Organisation | One diagram per feature area |
| Format | Interactive HTML files in `docs/journeys/` |
| Scope | Intended journey with gaps flagged visually |
| Technology | Mermaid.js embedded in each HTML file (CDN, no build step) |

---

## Output: Single HTML File with Tab Navigation

Location: `docs/journeys/user-journeys.html`

One self-contained file. A tab bar at the top lets you switch between all 7 diagrams without leaving the page or opening multiple files.

| Tab | Feature Area | Covers |
|---|---|---|
| Auth & Onboarding | Auth & Onboarding | Welcome, sign-in, sign-up, 9-slide profile setup, biometric, password reset |
| Tradesperson Job Flow | Tradesperson Job Flow | Browse jobs → express interest → accepted → start job → complete → mandatory review → payout |
| Job Poster Flow | Job Poster Flow | Create job → view applicants → hire tradesperson → start & pay (Stripe) → complete → trigger review |
| Payment & Escrow | Payment & Escrow | Stripe Connect checkout, escrow hold, review-gated release, payout delay by subscription tier, cancellation/refund path |
| Wallet & KYC | Wallet & KYC | KYC status states (none→pending→verified/failed), bank account registration, auto-withdraw, manual withdrawal |
| Subscription | Subscription Management | Tier selection (Bronze/Silver/Gold), new subscriber Stripe Checkout, upgrade with card on file, payout delay per tier |
| Messaging | Messaging | Initiate from job detail or People tab, create/find conversation, real-time SignalR sync, unread badge, mark read |

---

## Visual Language (consistent across all diagrams)

Each node is styled using Mermaid `classDef`:

| Colour | Meaning | Mermaid class |
|---|---|---|
| Green (`#c8e6c9`) | Implemented and working | `done` |
| Yellow (`#fff9c4`) | Partially implemented or known gap | `partial` |
| Red (`#ffcdd2`) | Not yet built | `todo` |
| Blue (`#e3f2fd`) | Decision / branch point | `decision` |
| Purple (`#ede7f6`) | Entry / exit terminal | `endpoint` |

Each file includes a legend at the top.

---

## File Structure

```
docs/journeys/
  user-journeys.html    ← single file, all diagrams
```

### Page layout

```
┌─────────────────────────────────────────────────────┐
│  Ônsite Monday — User Journeys                       │
├──────────┬──────────┬──────────┬──────────┬─────────┤
│ Auth &   │Trades-   │Job       │Payment & │Wallet & │ ...
│ Onboard  │person    │Poster    │Escrow    │KYC      │
├──────────┴──────────┴──────────┴──────────┴─────────┤
│  [Legend]                                            │
│                                                      │
│  [Active diagram — Mermaid flowchart]                │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### HTML structure

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <!-- CSS: brand colours, tab bar, legend -->
</head>
<body>
  <h1>Ônsite Monday — User Journeys</h1>

  <!-- Tab bar — clicking a tab shows its diagram, hides others -->
  <nav class="tabs">
    <button onclick="show('auth')">Auth & Onboarding</button>
    <button onclick="show('tradesperson')">Tradesperson Job Flow</button>
    ...
  </nav>

  <div class="legend">...</div>

  <!-- One section per diagram — only the active one is visible -->
  <section id="auth">
    <div class="mermaid">flowchart TD ... </div>
  </section>
  <section id="tradesperson" hidden>
    <div class="mermaid">flowchart TD ... </div>
  </section>
  ...

  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'default' });
    function show(id) { /* hide all, show selected, update active tab style */ }
  </script>
</body>
</html>
```

**Updating a diagram:** Open `user-journeys.html`, find the `<section id="[name]">` block, edit the Mermaid flowchart text inside it, save — re-open and the diagram updates. No build step, no tools required.

---

## Known Gaps to Flag (from codebase analysis)

These should appear as `partial` or `todo` nodes in the relevant diagrams:

| Area | Gap | Diagram |
|---|---|---|
| Payment | Payout is not properly gated by review submission (known bug) | `04-payment-escrow.html` |
| Wallet | KYC integration depth unclear — UI exists, backend flow uncertain | `05-wallet-kyc.html` |
| Subscription | No cancel/downgrade flow in the UI | `06-subscription.html` |
| Subscription | Platinum tier (post-launch) not in UI | `06-subscription.html` |
| Tradesperson | "Start job" Stripe redirect exists but return flow unclear | `02-tradesperson-job-flow.html` |
| Job Poster | Payment refund on cancellation partially implemented | `03-job-poster-flow.html`, `04-payment-escrow.html` |

---

## Verification

1. Open `docs/journeys/user-journeys.html` in a browser — all diagrams should render without errors
2. Click each tab — confirm it switches to the correct diagram
3. Verify the colour coding is correct and consistent with the legend on every tab
4. Confirm known gaps are marked `partial` or `todo` (not `done`)
5. Edit one node label in the Mermaid source, save, re-open — confirm diagram updates correctly
6. Check all 7 tabs exist and cover all journeys listed above
