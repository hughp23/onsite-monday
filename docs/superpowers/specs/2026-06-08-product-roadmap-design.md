---
name: product-roadmap-design
description: Investor-facing product roadmap PDF design — A4 landscape HTML artefact showing MVP, Phase 1 and Phase 2
metadata:
  type: design
---

# Product Roadmap Design

## Context

An investor-facing product roadmap for Onsite Monday showing current build progress and the path to MVP launch, Phase 1 (payments & growth), and Phase 2 (platform scale). Produced as a print-ready HTML file (`docs/product-roadmap.html`) that saves to PDF via browser print — no external tooling required.

## Decisions Made

| Question | Decision | Reason |
|----------|----------|--------|
| Audience | Investors / stakeholders | High-level, forward-looking; no bug/gap language |
| Scope | Full story (progress + roadmap) | Shows momentum — 65% shipped already |
| Layout | Stats strip + 3-column feature grid | Most scannable for investor decks |
| Orientation | A4 landscape | Columns breathe more; better for on-screen and slides |
| Dates | Quarters (Q3 2026, Q4 2026, Q1 2027) | Concrete timeline is more compelling |
| Branding | OM (no circumflex), Onsite Monday | User preference |
| Tiers | 4: Free → Bronze £29 → Silver £59 → Gold £129 | Free entry tier added |
| Escrow / KYC | Phase 1 (not MVP) | Cost deferral decision |
| URL | onsitemonday.com | Confirmed |

## Layout Spec

### Sections (top → bottom)

1. **Header** — `#6B1818` bar · OM logo in `#D4A843` · title + subtitle · tagline right-aligned
2. **Stats strip** — 6 cells: 65% MVP Complete · 23 Screens Built · 2-sided Marketplace · Free → £129 · 4 Tiers · iOS + Android
3. **Tier strip** — pill chain: Free → Bronze £29/mo → Silver £59/mo → Gold £129/mo
4. **Progress bar** — 65% filled, `#D4A843` leading-edge marker
5. **Three phase columns**
6. **Timeline strip** — dot chain with dates
7. **Footer** — `#6B1818` · ONSITE MONDAY · confidential note · onsitemonday.com

### Phase Columns

**MVP — Q3 2026 · Community Launch** (`#8B2020`)
- ✓ Auth, sign-up & onboarding
- ✓ Jobs board & applications
- ✓ Real-time messaging
- ✓ Subscription tiers (Stripe)
- ✓ Profile system & directory
- ✓ Push notifications
- ◎ Review & rating flow
- ◎ Free tier onboarding
- ◎ Job status tracking

**Phase 1 — Q4 2026 · Payments & Growth** (`#C44040`)
- ○ Live payment escrow
- ○ KYC identity verification
- ○ Wallet & bank account setup
- ○ Payout release automation
- ○ Transaction history
- ○ Payout countdown dashboard
- ○ Subscription cancel / downgrade
- ○ Portfolio gallery
- ○ Chat file attachments

**Phase 2 — Q1 2027 · Platform Scale** (`#D4A843`)
- ○ Platinum Enterprise tier (2-day payout)
- ○ Promoted & boosted job listings
- ○ Advanced location & skills matching
- ○ Tradesperson analytics dashboard
- ○ App Store & Play Store launch
- ○ Third-party API integrations

### Print CSS

```css
@page { size: A4 landscape; margin: 0; }
@media print {
  body { margin: 0; background: white; }
  .page-shell { background: white; padding: 0; }
  .roadmap-page { box-shadow: none; border-radius: 0; width: 100%; }
}
```

## Output File

`docs/product-roadmap.html` — fully self-contained, no external dependencies.

To export as PDF: open in Chrome → File → Print → Paper size: A4, Orientation: Landscape, Margins: None → Save as PDF.
