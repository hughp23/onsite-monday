# Subscription Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a current-plan summary card and cancel-at-period-end action to the Subscription screen, wired through a new `DELETE /api/subscriptions/current` endpoint.

**Architecture:** The backend gains two new domain fields (`CancelAtPeriodEnd`, `CurrentPeriodEnd`), a new service method, and a new controller endpoint. The frontend replaces the boolean `isSubscriptionActive` state with a full `SubscriptionDto`, renders a summary card at the top of the scroll view, and adds a cancel confirmation modal.

**Tech Stack:** .NET 8 / ASP.NET Core, EF Core (SQLite in tests), Stripe .NET SDK, React Native (Expo Router), TypeScript.

## Global Constraints

- Backend project root: `backend/` — all `dotnet` commands run from there
- Frontend project root: `frontend/` — all `npx` / `npm` commands run from there
- Stripe cancel uses `cancel_at_period_end = true`, never immediate cancellation
- Tier switching UX is unchanged — do not modify `SubscriptionCard.tsx` or the upgrade modal
- Follow existing test pattern: SQLite `:memory:` with FK enforcement off, Moq, FluentAssertions
- Brand colours: primary `#8B2020`, accent `#D4A843`, background `#FFF8F6`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/src/OnsiteMonday.Api/Domain/Subscription.cs` | Modify | Add `CancelAtPeriodEnd` and `CurrentPeriodEnd` fields |
| `backend/src/OnsiteMonday.Api/DTOs/Subscriptions/SubscriptionDto.cs` | Modify | Expose the two new fields |
| `backend/src/OnsiteMonday.Api/Data/Migrations/` | Generate | EF migration for new columns |
| `backend/src/OnsiteMonday.Api/Stubs/IStripeBillingService.cs` | Modify | Add `CancelSubscriptionAtPeriodEndAsync` |
| `backend/src/OnsiteMonday.Api/Services/StripeBillingService.cs` | Modify | Implement new Stripe method |
| `backend/src/OnsiteMonday.Api/Services/Interfaces/ISubscriptionService.cs` | Modify | Add `CancelCurrentAsync` |
| `backend/src/OnsiteMonday.Api/Services/SubscriptionService.cs` | Modify | Implement `CancelCurrentAsync` and update `ToDto` |
| `backend/src/OnsiteMonday.Api/Controllers/SubscriptionsController.cs` | Modify | Add `DELETE /api/subscriptions/current` |
| `backend/tests/OnsiteMonday.Api.Tests/Unit/Services/SubscriptionServiceTests.cs` | Modify | Add tests for `CancelCurrentAsync` |
| `frontend/src/services/subscriptionService.ts` | Modify | Add `cancel()` method and extend `SubscriptionDto` type |
| `frontend/context/AppContext.tsx` | Modify | Add `cancelSubscription()` |
| `frontend/app/subscription.tsx` | Modify | Summary card, cancel modal, state upgrade |

---

### Task 1: Domain model, DTO, and migration

**Files:**
- Modify: `backend/src/OnsiteMonday.Api/Domain/Subscription.cs`
- Modify: `backend/src/OnsiteMonday.Api/DTOs/Subscriptions/SubscriptionDto.cs`
- Modify: `backend/src/OnsiteMonday.Api/Services/SubscriptionService.cs` (ToDto helper only)
- Generate: `backend/src/OnsiteMonday.Api/Data/Migrations/`

**Interfaces:**
- Produces: `Subscription.CancelAtPeriodEnd: bool`, `Subscription.CurrentPeriodEnd: DateTimeOffset?`, `SubscriptionDto.CancelAtPeriodEnd: bool`, `SubscriptionDto.CurrentPeriodEnd: DateTimeOffset?`

- [ ] **Step 1: Add fields to the domain model**

Open `backend/src/OnsiteMonday.Api/Domain/Subscription.cs` and replace its contents with:

```csharp
namespace OnsiteMonday.Api.Domain;

public class Subscription
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string Tier { get; set; } = "bronze"; // bronze | silver | gold
    public bool IsActive { get; set; } = true;
    public int PayoutDays { get; set; } = 30;
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }
    public string? StripeSubscriptionId { get; set; }
    public bool CancelAtPeriodEnd { get; set; } = false;
    public DateTimeOffset? CurrentPeriodEnd { get; set; }
}
```

- [ ] **Step 2: Extend the DTO**

Open `backend/src/OnsiteMonday.Api/DTOs/Subscriptions/SubscriptionDto.cs` and replace its contents with:

```csharp
namespace OnsiteMonday.Api.DTOs.Subscriptions;

public class SubscriptionDto
{
    public Guid Id { get; set; }
    public string Tier { get; set; } = null!;
    public int PayoutDays { get; set; }
    public bool IsActive { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public bool CancelAtPeriodEnd { get; set; }
    public DateTimeOffset? CurrentPeriodEnd { get; set; }
}
```

- [ ] **Step 3: Update the ToDto helper in SubscriptionService**

In `backend/src/OnsiteMonday.Api/Services/SubscriptionService.cs`, find the private `ToDto` method at the bottom of the class and replace it:

```csharp
private static SubscriptionDto ToDto(Subscription s) => new()
{
    Id = s.Id,
    Tier = s.Tier,
    PayoutDays = s.PayoutDays,
    IsActive = s.IsActive,
    StartedAt = s.StartedAt,
    CancelAtPeriodEnd = s.CancelAtPeriodEnd,
    CurrentPeriodEnd = s.CurrentPeriodEnd,
};
```

- [ ] **Step 4: Generate the EF migration**

```bash
dotnet ef migrations add AddSubscriptionCancelFields --project src/OnsiteMonday.Api
```

Expected: a new file appears in `src/OnsiteMonday.Api/Data/Migrations/` containing `AddColumn` calls for `CancelAtPeriodEnd` (boolean, default false) and `CurrentPeriodEnd` (nullable datetime).

- [ ] **Step 5: Build to confirm no errors**

```bash
dotnet build src/OnsiteMonday.Api/OnsiteMonday.Api.csproj
```

Expected: `Build succeeded. 0 Warning(s). 0 Error(s)` (warnings about nullable are acceptable).

- [ ] **Step 6: Commit**

```bash
git add src/OnsiteMonday.Api/Domain/Subscription.cs \
        src/OnsiteMonday.Api/DTOs/Subscriptions/SubscriptionDto.cs \
        src/OnsiteMonday.Api/Services/SubscriptionService.cs \
        src/OnsiteMonday.Api/Data/Migrations/
git commit -m "feat: add CancelAtPeriodEnd and CurrentPeriodEnd to Subscription domain and DTO"
```

---

### Task 2: Stripe service — cancel-at-period-end

**Files:**
- Modify: `backend/src/OnsiteMonday.Api/Stubs/IStripeBillingService.cs`
- Modify: `backend/src/OnsiteMonday.Api/Services/StripeBillingService.cs`

**Interfaces:**
- Consumes: Stripe .NET SDK `SubscriptionService.UpdateAsync`, `SubscriptionUpdateOptions { CancelAtPeriodEnd = true }`
- Produces: `IStripeBillingService.CancelSubscriptionAtPeriodEndAsync(string stripeSubscriptionId) → Task<DateTimeOffset>` — returns the period-end timestamp from Stripe

- [ ] **Step 1: Add method to the interface**

Open `backend/src/OnsiteMonday.Api/Stubs/IStripeBillingService.cs` and replace its contents with:

```csharp
namespace OnsiteMonday.Api.Stubs;

public interface IStripeBillingService
{
    Task<string> EnsureCustomerAsync(Guid userId, string email);
    Task<(string SubscriptionId, string CheckoutUrl)> CreateSubscriptionCheckoutAsync(
        string stripeCustomerId, string tier, string successUrl, string cancelUrl);
    Task UpdateSubscriptionInPlaceAsync(string stripeSubscriptionId, string tier);
    Task CancelSubscriptionAsync(string stripeSubscriptionId);
    Task<DateTimeOffset> CancelSubscriptionAtPeriodEndAsync(string stripeSubscriptionId);
}
```

- [ ] **Step 2: Implement in StripeBillingService**

Open `backend/src/OnsiteMonday.Api/Services/StripeBillingService.cs` and add this method at the end of the class body, before the closing `}`:

```csharp
public async Task<DateTimeOffset> CancelSubscriptionAtPeriodEndAsync(string stripeSubscriptionId)
{
    var subscriptionService = new Stripe.SubscriptionService();
    var updated = await subscriptionService.UpdateAsync(stripeSubscriptionId, new SubscriptionUpdateOptions
    {
        CancelAtPeriodEnd = true,
    });
    _logger.LogInformation("Stripe: Set cancel_at_period_end on subscription {SubscriptionId}", stripeSubscriptionId);
    return new DateTimeOffset(updated.CurrentPeriodEnd, TimeSpan.Zero);
}
```

- [ ] **Step 3: Build**

```bash
dotnet build src/OnsiteMonday.Api/OnsiteMonday.Api.csproj
```

Expected: `Build succeeded.`

- [ ] **Step 4: Commit**

```bash
git add src/OnsiteMonday.Api/Stubs/IStripeBillingService.cs \
        src/OnsiteMonday.Api/Services/StripeBillingService.cs
git commit -m "feat: add CancelSubscriptionAtPeriodEndAsync to Stripe billing service"
```

---

### Task 3: Subscription service — CancelCurrentAsync + tests

**Files:**
- Modify: `backend/src/OnsiteMonday.Api/Services/Interfaces/ISubscriptionService.cs`
- Modify: `backend/src/OnsiteMonday.Api/Services/SubscriptionService.cs`
- Modify: `backend/tests/OnsiteMonday.Api.Tests/Unit/Services/SubscriptionServiceTests.cs`

**Interfaces:**
- Consumes: `IStripeBillingService.CancelSubscriptionAtPeriodEndAsync(string) → Task<DateTimeOffset>` (from Task 2), `Subscription.CancelAtPeriodEnd`, `Subscription.CurrentPeriodEnd` (from Task 1)
- Produces: `ISubscriptionService.CancelCurrentAsync(Guid userId) → Task<SubscriptionDto>`

- [ ] **Step 1: Add method to the service interface**

Open `backend/src/OnsiteMonday.Api/Services/Interfaces/ISubscriptionService.cs` and replace its contents with:

```csharp
using OnsiteMonday.Api.DTOs.Subscriptions;

namespace OnsiteMonday.Api.Services;

public interface ISubscriptionService
{
    Task<SubscriptionDto?> GetCurrentAsync(Guid userId);
    Task<SubscriptionCheckoutResponse> UpdateSubscriptionAsync(Guid userId, string tier, bool updateCardAndUpgrade = false);
    Task<SubscriptionDto> CancelCurrentAsync(Guid userId);
}
```

- [ ] **Step 2: Write the failing tests first**

Open `backend/tests/OnsiteMonday.Api.Tests/Unit/Services/SubscriptionServiceTests.cs` and add the following four test methods after the last existing test (`GetCurrent_WhenActiveSubscriptionExists_ReturnsDto`), before the final closing `}` of the class:

```csharp
[Fact]
public async Task CancelCurrent_WithStripeSubscription_SetsCancelAtPeriodEndTrue()
{
    var (db, _, stripe, sut) = CreateSut();
    var userId = Guid.NewGuid();
    var periodEnd = DateTimeOffset.UtcNow.AddDays(30);

    stripe.Setup(s => s.CancelSubscriptionAtPeriodEndAsync("sub_active_123"))
        .ReturnsAsync(periodEnd);

    db.Subscriptions.Add(new Subscription
    {
        Id = Guid.NewGuid(),
        UserId = userId,
        Tier = "silver",
        PayoutDays = 14,
        IsActive = true,
        StartedAt = DateTimeOffset.UtcNow.AddDays(-5),
        StripeSubscriptionId = "sub_active_123",
    });
    await db.SaveChangesAsync();

    var result = await sut.CancelCurrentAsync(userId);

    result.CancelAtPeriodEnd.Should().BeTrue();
    result.CurrentPeriodEnd.Should().BeCloseTo(periodEnd, TimeSpan.FromSeconds(1));
    result.IsActive.Should().BeTrue();
}

[Fact]
public async Task CancelCurrent_WithStripeSubscription_PersistsToDB()
{
    var (db, _, stripe, sut) = CreateSut();
    var userId = Guid.NewGuid();
    var periodEnd = DateTimeOffset.UtcNow.AddDays(14);

    stripe.Setup(s => s.CancelSubscriptionAtPeriodEndAsync("sub_stripe_456"))
        .ReturnsAsync(periodEnd);

    var sub = new Subscription
    {
        Id = Guid.NewGuid(),
        UserId = userId,
        Tier = "gold",
        PayoutDays = 7,
        IsActive = true,
        StartedAt = DateTimeOffset.UtcNow,
        StripeSubscriptionId = "sub_stripe_456",
    };
    db.Subscriptions.Add(sub);
    await db.SaveChangesAsync();

    await sut.CancelCurrentAsync(userId);

    await db.Entry(sub).ReloadAsync();
    sub.CancelAtPeriodEnd.Should().BeTrue();
    sub.CurrentPeriodEnd.Should().NotBeNull();
    sub.IsActive.Should().BeTrue();
}

[Fact]
public async Task CancelCurrent_WithNoStripeId_DeactivatesImmediately()
{
    var (db, _, _, sut) = CreateSut();
    var userId = Guid.NewGuid();

    var sub = new Subscription
    {
        Id = Guid.NewGuid(),
        UserId = userId,
        Tier = "bronze",
        PayoutDays = 30,
        IsActive = true,
        StartedAt = DateTimeOffset.UtcNow.AddDays(-1),
        StripeSubscriptionId = null,
    };
    db.Subscriptions.Add(sub);
    await db.SaveChangesAsync();

    var result = await sut.CancelCurrentAsync(userId);

    result.IsActive.Should().BeFalse();

    await db.Entry(sub).ReloadAsync();
    sub.IsActive.Should().BeFalse();
    sub.CancelledAt.Should().NotBeNull();
}

[Fact]
public async Task CancelCurrent_WithNoActiveSubscription_ThrowsInvalidOperationException()
{
    var (_, _, _, sut) = CreateSut();

    var act = () => sut.CancelCurrentAsync(Guid.NewGuid());

    await act.Should().ThrowAsync<InvalidOperationException>()
        .WithMessage("*No active subscription*");
}
```

Also add the Stripe mock setup for `CancelSubscriptionAtPeriodEndAsync` inside the existing `CreateSut()` helper, after the existing `CancelSubscriptionAsync` setup line:

```csharp
stripe.Setup(s => s.CancelSubscriptionAtPeriodEndAsync(It.IsAny<string>()))
    .ReturnsAsync(DateTimeOffset.UtcNow.AddDays(30));
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
dotnet test tests/OnsiteMonday.Api.Tests/OnsiteMonday.Api.Tests.csproj \
  --filter "FullyQualifiedName~CancelCurrent" -v normal
```

Expected: 4 tests fail with `CancelCurrentAsync` not found on `SubscriptionService`.

- [ ] **Step 4: Implement CancelCurrentAsync**

Open `backend/src/OnsiteMonday.Api/Services/SubscriptionService.cs` and add the following method after `UpdateSubscriptionAsync`, before `ToDto`:

```csharp
public async Task<SubscriptionDto> CancelCurrentAsync(Guid userId)
{
    var sub = await _db.Subscriptions
        .FirstOrDefaultAsync(s => s.UserId == userId && s.IsActive);

    if (sub == null)
        throw new InvalidOperationException("No active subscription to cancel.");

    if (sub.StripeSubscriptionId == null)
    {
        sub.IsActive = false;
        sub.CancelledAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return ToDto(sub);
    }

    var periodEnd = await _stripe.CancelSubscriptionAtPeriodEndAsync(sub.StripeSubscriptionId);
    sub.CancelAtPeriodEnd = true;
    sub.CurrentPeriodEnd = periodEnd;
    await _db.SaveChangesAsync();
    return ToDto(sub);
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
dotnet test tests/OnsiteMonday.Api.Tests/OnsiteMonday.Api.Tests.csproj \
  --filter "FullyQualifiedName~CancelCurrent" -v normal
```

Expected: 4 tests pass.

- [ ] **Step 6: Run the full test suite to check for regressions**

```bash
dotnet test tests/OnsiteMonday.Api.Tests/OnsiteMonday.Api.Tests.csproj -v normal
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/OnsiteMonday.Api/Services/Interfaces/ISubscriptionService.cs \
        src/OnsiteMonday.Api/Services/SubscriptionService.cs \
        tests/OnsiteMonday.Api.Tests/Unit/Services/SubscriptionServiceTests.cs
git commit -m "feat: add CancelCurrentAsync to SubscriptionService with tests"
```

---

### Task 4: Controller endpoint — DELETE /api/subscriptions/current

**Files:**
- Modify: `backend/src/OnsiteMonday.Api/Controllers/SubscriptionsController.cs`

**Interfaces:**
- Consumes: `ISubscriptionService.CancelCurrentAsync(Guid userId) → Task<SubscriptionDto>` (from Task 3)
- Produces: `DELETE /api/subscriptions/current → 200 SubscriptionDto | 400 ProblemDetails`

- [ ] **Step 1: Add the endpoint**

Open `backend/src/OnsiteMonday.Api/Controllers/SubscriptionsController.cs` and add the following method after the existing `UpdateSubscription` method, before the closing `}` of the class:

```csharp
// DELETE /api/subscriptions/current
[HttpDelete("current")]
public async Task<ActionResult<SubscriptionDto>> CancelSubscription()
{
    var userId = await GetCurrentUserIdAsync();
    try
    {
        var dto = await _subscriptionService.CancelCurrentAsync(userId);
        return Ok(dto);
    }
    catch (InvalidOperationException ex)
    {
        return BadRequest(ex.Message);
    }
}
```

- [ ] **Step 2: Build**

```bash
dotnet build src/OnsiteMonday.Api/OnsiteMonday.Api.csproj
```

Expected: `Build succeeded.`

- [ ] **Step 3: Commit**

```bash
git add src/OnsiteMonday.Api/Controllers/SubscriptionsController.cs
git commit -m "feat: add DELETE /api/subscriptions/current endpoint"
```

---

### Task 5: Frontend service and AppContext

**Files:**
- Modify: `frontend/src/services/subscriptionService.ts`
- Modify: `frontend/context/AppContext.tsx`

**Interfaces:**
- Consumes: `DELETE /api/subscriptions/current → SubscriptionDto` (from Task 4)
- Produces:
  - `SubscriptionDto.cancelAtPeriodEnd: boolean`, `SubscriptionDto.currentPeriodEnd: string | null`
  - `subscriptionService.cancel() → Promise<SubscriptionDto>`
  - `AppContext.cancelSubscription() → Promise<SubscriptionDto>`

- [ ] **Step 1: Extend the frontend SubscriptionDto type and add cancel()**

Open `frontend/src/services/subscriptionService.ts` and replace its contents with:

```ts
import { apiRequest } from './api';
import { SubscriptionTier } from '@/constants/types';

export interface SubscriptionDto {
  id: string;
  tier: SubscriptionTier;
  payoutDays: number;
  isActive: boolean;
  startedAt: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

export interface SubscriptionCheckoutResponse {
  subscription: SubscriptionDto;
  checkoutUrl: string | null;
}

export const subscriptionService = {
  getCurrent: async (): Promise<SubscriptionDto> => {
    return apiRequest<SubscriptionDto>('GET', '/subscriptions/current');
  },

  update: async (tier: SubscriptionTier, updateCardAndUpgrade = false): Promise<SubscriptionCheckoutResponse> => {
    return apiRequest<SubscriptionCheckoutResponse>('POST', '/subscriptions', { tier, updateCardAndUpgrade });
  },

  cancel: async (): Promise<SubscriptionDto> => {
    return apiRequest<SubscriptionDto>('DELETE', '/subscriptions/current');
  },
};
```

- [ ] **Step 2: Add cancelSubscription to AppContext**

Open `frontend/context/AppContext.tsx`.

In the `AppContextType` interface, add one line after `updateSubscription`:

```ts
cancelSubscription: () => Promise<import('@/src/services/subscriptionService').SubscriptionDto>;
```

After the existing `updateSubscription` `useCallback` (around line 372), add:

```ts
const cancelSubscription = useCallback(async () => {
  return subscriptionService.cancel();
}, []);
```

In the `AppContext.Provider` value object, add `cancelSubscription` alongside `updateSubscription`:

```ts
cancelSubscription,
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/hugh/Documents/Development/onsite-monday/frontend && npx tsc --noEmit
```

Expected: no errors related to `subscriptionService` or `AppContext`.

- [ ] **Step 4: Commit**

```bash
git add src/services/subscriptionService.ts context/AppContext.tsx
git commit -m "feat: add cancel() to subscriptionService and cancelSubscription() to AppContext"
```

---

### Task 6: Subscription screen — summary card and cancel modal

**Files:**
- Modify: `frontend/app/subscription.tsx`

**Interfaces:**
- Consumes: `subscriptionService.getCurrent() → Promise<SubscriptionDto>`, `cancelSubscription() → Promise<SubscriptionDto>` (from Task 5), `SubscriptionDto.cancelAtPeriodEnd`, `SubscriptionDto.currentPeriodEnd`, `SubscriptionDto.startedAt`, `SubscriptionDto.isActive`

- [ ] **Step 1: Replace the file with the updated screen**

Open `frontend/app/subscription.tsx` and replace its entire contents with:

```tsx
import React, { useEffect, useState } from 'react';
import {
  View, ScrollView, StyleSheet, Modal, Pressable, Text, TouchableOpacity, Linking, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import SubscriptionCard from '@/components/SubscriptionCard';
import { subscriptionService, SubscriptionDto } from '@/src/services/subscriptionService';
import { colors } from '@/constants/colors';
import { SubscriptionTier } from '@/constants/types';

const TIER_NAMES: Record<SubscriptionTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
};

const TIER_BADGE_COLORS: Record<SubscriptionTier, string> = {
  bronze: '#CD7F32',
  silver: '#A8A9AD',
  gold: colors.accent,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function SubscriptionScreen() {
  const { currentUser, updateSubscription, cancelSubscription } = useApp();
  const insets = useSafeAreaInsets();
  const [currentSub, setCurrentSub] = useState<SubscriptionDto | null>(null);
  const [confirmTier, setConfirmTier] = useState<SubscriptionTier | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!currentUser) return null;

  useEffect(() => {
    subscriptionService.getCurrent()
      .then(sub => setCurrentSub(sub.isActive ? sub : null))
      .catch(() => {});

    const handleUrl = ({ url }: { url: string }) => {
      if (url === 'onsitemonday://subscription/success') {
        subscriptionService.getCurrent()
          .then(sub => setCurrentSub(sub.isActive ? sub : null))
          .catch(() => {});
        Alert.alert('Plan updated', 'Your subscription is now active.');
      } else if (url === 'onsitemonday://subscription/cancel') {
        Alert.alert('Cancelled', 'Your subscription was not changed.');
      }
    };

    Linking.getInitialURL().then(url => { if (url) handleUrl({ url }); });
    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, []);

  const handleSelect = (tier: SubscriptionTier) => {
    if (tier !== currentUser.subscription) {
      setConfirmTier(tier);
    }
  };

  const confirmUpgradeNow = async () => {
    if (!confirmTier) return;
    setLoading(true);
    try {
      await updateSubscription(confirmTier, false);
      setConfirmTier(null);
      Alert.alert('Plan updated', `You're now on the ${TIER_NAMES[confirmTier]} plan.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update subscription';
      Alert.alert('Subscription error', msg);
    } finally {
      setLoading(false);
    }
  };

  const confirmUpdateCard = async () => {
    if (!confirmTier) return;
    setLoading(true);
    try {
      await updateSubscription(confirmTier, true);
      setConfirmTier(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update subscription';
      Alert.alert('Subscription error', msg);
    } finally {
      setLoading(false);
    }
  };

  const confirmCancel = async () => {
    setLoading(true);
    try {
      const updated = await cancelSubscription();
      setCurrentSub(updated);
      setShowCancelModal(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to cancel subscription';
      Alert.alert('Cancellation error', msg);
    } finally {
      setLoading(false);
    }
  };

  const isExistingSubscriber = !!(currentSub?.isActive);
  const tier = currentSub?.tier ?? currentUser.subscription;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Current plan summary — shown when actively subscribed */}
        {currentSub?.isActive && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={[styles.tierBadge, { backgroundColor: TIER_BADGE_COLORS[currentSub.tier] }]}>
                <Text style={styles.tierBadgeText}>{TIER_NAMES[currentSub.tier]}</Text>
              </View>
              <Text style={styles.summaryLabel}>Your current plan</Text>
            </View>

            <View style={styles.summaryRow}>
              {currentSub.cancelAtPeriodEnd ? (
                <>
                  <Ionicons name="alert-circle-outline" size={15} color="#D4A843" />
                  <Text style={styles.summaryRowTextAmber}>
                    {currentSub.currentPeriodEnd
                      ? `Cancels on ${formatDate(currentSub.currentPeriodEnd)}`
                      : 'Cancels at end of billing period'}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
                  <Text style={styles.summaryRowText}>
                    Active since {formatDate(currentSub.startedAt)}
                  </Text>
                </>
              )}
            </View>

            {!currentSub.cancelAtPeriodEnd && (
              <TouchableOpacity onPress={() => setShowCancelModal(true)} style={styles.cancelLink}>
                <Text style={styles.cancelLinkText}>Cancel subscription</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={styles.subtitle}>
          Choose the plan that's right for your business. Upgrade anytime.
        </Text>

        {(['bronze', 'silver', 'gold'] as SubscriptionTier[]).map(t => (
          <SubscriptionCard
            key={t}
            tier={t}
            isCurrentPlan={currentUser.subscription === t}
            onSelect={() => handleSelect(t)}
          />
        ))}

        <Text style={styles.note}>
          All plans include access to the Onsite Monday jobs board, in-app messaging, and profile listing.
          Cancel anytime.
        </Text>
      </ScrollView>

      {/* Upgrade modal — unchanged */}
      <Modal visible={!!confirmTier} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => !loading && setConfirmTier(null)}>
          <View style={styles.modal}>
            <MaterialCommunityIcons name="crown" size={44} color={colors.accent} />
            <Text style={styles.modalTitle}>Switch to {confirmTier ? TIER_NAMES[confirmTier] : ''}?</Text>

            {isExistingSubscriber ? (
              <>
                <Text style={styles.modalDesc}>
                  Upgrade now using your card on file — no re-entry needed. Proration is applied to your next invoice.
                </Text>
                <TouchableOpacity
                  style={[styles.confirmBtn, loading && styles.btnDisabled]}
                  onPress={confirmUpgradeNow}
                  disabled={loading}
                >
                  <Text style={styles.confirmBtnText}>Upgrade now · card on file</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryBtn, loading && styles.btnDisabled]}
                  onPress={confirmUpdateCard}
                  disabled={loading}
                >
                  <Text style={styles.secondaryBtnText}>Update card & upgrade</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalDesc}>
                  You'll be redirected to complete payment. Your plan activates once payment is confirmed.
                </Text>
                <TouchableOpacity
                  style={[styles.confirmBtn, loading && styles.btnDisabled]}
                  onPress={confirmUpdateCard}
                  disabled={loading}
                >
                  <Text style={styles.confirmBtnText}>Yes, Proceed to Payment</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              onPress={() => !loading && setConfirmTier(null)}
              style={styles.cancelBtn}
              disabled={loading}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Cancel subscription modal */}
      <Modal visible={showCancelModal} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => !loading && setShowCancelModal(false)}>
          <View style={styles.modal}>
            <MaterialCommunityIcons name="alert-circle-outline" size={44} color="#D4A843" />
            <Text style={styles.modalTitle}>Cancel your subscription?</Text>
            <Text style={styles.modalDesc}>
              Your {TIER_NAMES[tier]} plan stays active until the end of your current billing period.
              After that you'll lose access to the jobs board and paid features.
            </Text>
            <TouchableOpacity
              style={[styles.confirmBtn, loading && styles.btnDisabled]}
              onPress={() => !loading && setShowCancelModal(false)}
              disabled={loading}
            >
              <Text style={styles.confirmBtnText}>Keep my plan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.destructiveBtn, loading && styles.btnDisabled]}
              onPress={confirmCancel}
              disabled={loading}
            >
              <Text style={styles.destructiveBtnText}>Yes, cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 16 },

  // Current plan summary card
  summaryCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  tierBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tierBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textLight,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  summaryRowText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  summaryRowTextAmber: {
    fontSize: 13,
    color: '#D4A843',
    fontWeight: '600',
  },
  cancelLink: {
    alignSelf: 'flex-start',
  },
  cancelLinkText: {
    fontSize: 13,
    color: colors.error ?? '#C0392B',
    fontWeight: '600',
  },

  subtitle: { fontSize: 14, color: colors.textLight, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  note: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 16,
  },

  // Modals
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 12, marginBottom: 8 },
  modalDesc: { fontSize: 14, color: colors.textLight, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  confirmBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 13,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  secondaryBtnText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
  destructiveBtn: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.error ?? '#C0392B',
    paddingVertical: 13,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  destructiveBtnText: { color: colors.error ?? '#C0392B', fontWeight: '600', fontSize: 15 },
  cancelBtn: { paddingVertical: 10 },
  cancelBtnText: { color: colors.textLight, fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
});
```

- [ ] **Step 2: Check whether `colors.error` exists**

```bash
grep -n "error" /Users/hugh/Documents/Development/onsite-monday/frontend/constants/colors.ts
```

If `colors.error` is not defined, add it to `colors.ts`:

```ts
error: '#C0392B',
```

If it's already defined with a different name (e.g. `danger`, `destructive`), update the two `colors.error` references in `subscription.tsx` to use the correct token.

- [ ] **Step 3: Type-check**

```bash
cd /Users/hugh/Documents/Development/onsite-monday/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Lint**

```bash
npx eslint app/subscription.tsx --max-warnings 0
```

Expected: no errors or warnings (fix any that appear before committing).

- [ ] **Step 5: Commit**

```bash
git add app/subscription.tsx constants/colors.ts
git commit -m "feat: add current plan summary card and cancel-at-period-end modal to Subscription screen"
```
