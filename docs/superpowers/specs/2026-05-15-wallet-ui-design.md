# Wallet UI Design

**Date:** 2026-05-15
**Status:** Approved

## Overview

A Wallet screen accessible from the Profile tab that lets users view their Mangopay balance, toggle auto-withdraw, and manually withdraw funds to their registered bank account. All accounts see the wallet (flat account structure — any user can be both tradesperson and job poster).

---

## Navigation

A new "Wallet" row is inserted into the Profile tab between the Subscription section and the Gallery section. It matches the existing section card style (`styles.section`) with a wallet icon on the left and a chevron on the right. Tapping calls `router.push('/wallet')`, pushing `app/wallet.tsx` onto the stack.

---

## Wallet Screen (`app/wallet.tsx`)

Data is fetched from `walletService.getWallet()` on mount. The screen uses a `ScrollView` with pull-to-refresh. All content is driven by `WalletDto` (`balance`, `balancePence`, `kycStatus`, `hasBankAccount`, `autoWithdraw`).

### Setup Banner

Shown when `kycStatus !== 'verified'` OR `!hasBankAccount`. Yellow banner (`#FFF3CD` background, `#FFE082` border) appears at the very top of the screen body, above the balance card.

Banner message and CTA vary by state:

| Condition | Message | CTA |
|---|---|---|
| `kycStatus === 'none'` | "Verify your identity to receive payouts" | "Verify identity →" |
| `kycStatus === 'pending'` | "Identity verification in progress — we'll notify you when complete" | None (informational) |
| `kycStatus === 'failed'` | "Verification failed — please try again" | "Retry verification →" |
| `kycStatus === 'verified'` but `!hasBankAccount` | "Add a bank account to enable withdrawals" | "Add bank account →" |

No standalone KYC or bank-account screens exist yet outside of the sign-up onboarding flow. CTA buttons are rendered but show an `Alert` with the message "Complete identity verification through your account settings" / "Add a bank account through your account settings" for now. Wiring these CTAs to real screens is a follow-up task.

### Balance Card

Full-width dark red gradient (`#8B2020` → `#6B1818`), white text. Shows:
- Label: "Available Balance" (small, uppercase, muted)
- Amount: `£{balance.toFixed(2)}` (large, bold)
- Subtitle: "Ready to withdraw" when fully set up; "Complete setup to withdraw" otherwise (small, muted)

### Account Status Section

Card section matching existing profile section style. Two rows:
- "Identity verification" → status pill
- "Bank account" → status pill

KYC status pills:
- `none` → grey "Not started"
- `pending` → amber "Pending"
- `verified` → green "✓ Verified"
- `failed` → red "Failed"

Bank account pill: green "✓ Added" or red "Not added".

### Auto-Withdraw Toggle

Row with label "Auto-withdraw" and subtitle "Automatically send payouts to your bank account". React Native `Switch` on the right. Disabled (greyed, non-interactive) when `kycStatus !== 'verified' || !hasBankAccount`. On change calls `walletService.setAutoWithdraw(enabled)` — optimistic UI update, revert on error.

### Withdraw Button

Full-width primary button (`colors.primary` background). Disabled and greyed when setup is incomplete. When tapped (and setup is complete), opens the withdraw bottom sheet.

### Withdraw Bottom Sheet

Implemented as a React Native `Modal` with `animationType="slide"` (same pattern as the sign-out modal in `profile.tsx`). Semi-transparent backdrop. Sheet contains:
- Drag handle (decorative)
- Title: "Withdraw funds"
- Body: "Transfer **£{balance.toFixed(2)}** to your registered UK bank account. Processing typically takes 1–3 business days."
- "Confirm withdrawal" primary button → calls `walletService.withdraw()`, shows a success toast/banner, closes sheet
- "Cancel" text link → closes sheet

Loading state on the confirm button while the request is in flight. On API error, show an inline error message within the sheet (do not close).

### Transaction History (Placeholder)

Collapsible row at the bottom of the screen. Header row shows "Transaction History" label and a chevron that rotates on expand. Expanded body shows: "Transaction history coming soon." This section is a placeholder — no backend endpoint exists yet and will be wired up in a later task.

---

## Files

| Action | Path |
|---|---|
| Create | `frontend/app/wallet.tsx` |
| Modify | `frontend/app/(tabs)/profile.tsx` |

### Profile tab change

Insert a new `TouchableOpacity` section between the Subscription section and the Gallery section in `profile.tsx`:

```tsx
<TouchableOpacity style={styles.section} onPress={() => router.push('/wallet')} activeOpacity={0.8}>
  <View style={styles.menuRow}>
    <MaterialCommunityIcons name="wallet-outline" size={20} color={colors.primary} />
    <Text style={styles.menuRowText}>Wallet</Text>
    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
  </View>
</TouchableOpacity>
```

Add `menuRow` and `menuRowText` styles to the existing `StyleSheet`.

---

## Error & Loading States

- **Loading:** Show a spinner centred in place of the balance card while `getWallet()` is in flight.
- **Error:** Show an inline error message with a retry button if `getWallet()` fails.
- **Withdraw error:** Show error inline within the bottom sheet (keep sheet open).
- **Auto-withdraw error:** Revert the toggle to its previous value, show a brief toast.
