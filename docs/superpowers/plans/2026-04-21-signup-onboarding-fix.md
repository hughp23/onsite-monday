# Sign-Up Onboarding Fix & Subscription Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the sign-up carousel being bypassed after slide 1, enforce required fields, add subscription tier selection, and handle returning users with incomplete profiles.

**Architecture:** Gate routing in `index.tsx` on `currentUser.isOnboarded` (not just Firebase auth). Add `completeOnboarding` to AppContext. Overhaul `sign-up.tsx` to split name fields, add a subscription slide at position 8, enforce required fields on slides 2/3/5/6, and pre-populate fields for returning users who have Firebase auth but `isOnboarded = false`.

**Tech Stack:** React Native, Expo Router, Firebase Auth, TypeScript. No frontend test framework — verify manually via Expo Go / dev build.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/context/AppContext.tsx` | Modify | Expose `completeOnboarding()` through context |
| `frontend/app/index.tsx` | Modify | Fix routing guard: gate on `isOnboarded`, prevent sign-up interruption |
| `frontend/app/sign-up.tsx` | Modify | Split name fields, subscription slide, required validation, returning-user pre-pop, updated `handleComplete` |

---

## Task 1: Add `completeOnboarding` to AppContext

**Files:**
- Modify: `frontend/context/AppContext.tsx`

- [ ] **Step 1: Add `completeOnboarding` to the `AppContextType` interface**

In `frontend/context/AppContext.tsx`, add to the `AppContextType` interface (after the `updateCurrentUser` line):

```typescript
completeOnboarding: () => Promise<void>;
```

- [ ] **Step 2: Implement the `completeOnboarding` callback**

Add this `useCallback` inside `AppContextProvider`, after the `updateCurrentUser` callback:

```typescript
const completeOnboarding = useCallback(async () => {
  const user = await userService.completeOnboarding();
  setCurrentUser(user);
}, []);
```

- [ ] **Step 3: Expose it in the provider value**

In the `<AppContext.Provider value={{...}}>` object, add `completeOnboarding` alongside the other callbacks:

```typescript
completeOnboarding,
```

- [ ] **Step 4: Verify TypeScript compiles**

Run from the `frontend/` directory:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/context/AppContext.tsx
git commit -m "feat: expose completeOnboarding in AppContext"
```

---

## Task 2: Fix routing in `index.tsx`

**Files:**
- Modify: `frontend/app/index.tsx`

The bug: Firebase auth creation on slide 1 sets `isAuthenticated = true`, which fires `router.replace('/(tabs)/jobs')` from `index.tsx` even while the sign-up carousel is active.

Fix: (a) gate routing on `currentUser.isOnboarded`, and (b) use `usePathname()` so the effect only routes when index is the active screen.

- [ ] **Step 1: Update imports at the top of `index.tsx`**

Change:
```typescript
import { router } from 'expo-router';
```
To:
```typescript
import { router, usePathname } from 'expo-router';
```

- [ ] **Step 2: Destructure additional values from `useApp()`**

Change:
```typescript
const { isAuthenticated } = useApp();
```
To:
```typescript
const { isAuthenticated, currentUser, isLoading } = useApp();
```

- [ ] **Step 3: Add `usePathname` hook call**

Add directly below the `useApp()` line:
```typescript
const pathname = usePathname();
```

- [ ] **Step 4: Replace the routing `useEffect`**

The current `useEffect` starts at line 52. Replace:
```typescript
useEffect(() => {
  if (isAuthenticated) {
    router.replace('/(tabs)/jobs');
    return;
  }
```
With:
```typescript
useEffect(() => {
  // Only act when this screen is the active route
  if (pathname !== '/') return;
  // Wait for auth + profile to load
  if (isLoading) return;

  if (isAuthenticated && currentUser) {
    router.replace(currentUser.isOnboarded ? '/(tabs)/jobs' : '/sign-up');
    return;
  }

  if (isAuthenticated && !currentUser) return; // Auth exists but profile not yet loaded
```

- [ ] **Step 5: Add `currentUser`, `isLoading`, `pathname` to the `useEffect` dependency array**

Change:
```typescript
}, [isAuthenticated]);
```
To:
```typescript
}, [isAuthenticated, currentUser, isLoading, pathname]);
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/index.tsx
git commit -m "fix: gate welcome screen routing on isOnboarded, prevent sign-up interruption"
```

---

## Task 3: Split Full Name into First Name + Last Name in slide 1

**Files:**
- Modify: `frontend/app/sign-up.tsx`

- [ ] **Step 1: Replace `fullName` state with `firstName` and `lastName`**

Remove:
```typescript
const [fullName, setFullName] = useState('');
```
Add:
```typescript
const [firstName, setFirstName] = useState('');
const [lastName, setLastName] = useState('');
```

- [ ] **Step 2: Update slide 1 JSX — replace the Full Name input with two inputs**

Remove the entire `Full Name` `<View style={styles.inputGroup}>` block:
```typescript
<View style={styles.inputGroup}>
  <Text style={styles.label}>Full Name</Text>
  <View style={styles.inputWrap}>
    <Ionicons name="person-outline" size={18} color={colors.textLight} style={styles.inputIcon} />
    <TextInput style={styles.input} placeholder="Dave Mitchell" placeholderTextColor={colors.textLight} value={fullName} onChangeText={setFullName} />
  </View>
</View>
```

Replace with:
```typescript
<View style={styles.inputGroup}>
  <Text style={styles.label}>First Name</Text>
  <View style={styles.inputWrap}>
    <Ionicons name="person-outline" size={18} color={colors.textLight} style={styles.inputIcon} />
    <TextInput
      style={styles.input}
      placeholder="Dave"
      placeholderTextColor={colors.textLight}
      value={firstName}
      onChangeText={setFirstName}
    />
  </View>
</View>
<View style={styles.inputGroup}>
  <Text style={styles.label}>Last Name</Text>
  <View style={styles.inputWrap}>
    <Ionicons name="person-outline" size={18} color={colors.textLight} style={styles.inputIcon} />
    <TextInput
      style={styles.input}
      placeholder="Mitchell"
      placeholderTextColor={colors.textLight}
      value={lastName}
      onChangeText={setLastName}
    />
  </View>
</View>
```

- [ ] **Step 3: Update `handleCreateAccount` validation**

Change:
```typescript
if (!fullName.trim() || !email.trim() || password.length < 6) {
  Alert.alert('Missing fields', 'Please fill in your full name, email and a password (min. 6 characters).');
```
To:
```typescript
if (!firstName.trim() || !email.trim() || password.length < 6) {
  Alert.alert('Missing fields', 'Please fill in your first name, email and a password (min. 6 characters).');
```

- [ ] **Step 4: Update the summary slide (currently slide 8 / index 7) to show firstName + lastName**

Change:
```typescript
<Text style={styles.summaryRow}>👤 {fullName || 'Your Name'}</Text>
```
To:
```typescript
<Text style={styles.summaryRow}>👤 {[firstName, lastName].filter(Boolean).join(' ') || 'Your Name'}</Text>
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/sign-up.tsx
git commit -m "feat: split Full Name into First Name + Last Name in sign-up slide 1"
```

---

## Task 4: Add subscription slide and update slide count

**Files:**
- Modify: `frontend/app/sign-up.tsx`

- [ ] **Step 1: Add required imports at the top of `sign-up.tsx`**

Add to the existing import list:
```typescript
import SubscriptionCard from '@/components/SubscriptionCard';
import { SubscriptionTier } from '@/constants/types';
```

Note: `ScrollView` is already imported from `react-native` in this file — the subscription slide reuses it directly.

- [ ] **Step 2: Add `selectedTier` state**

After the `isCreatingAccount` state declaration, add:
```typescript
const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
```

- [ ] **Step 3: Add `TIER_NAMES` constant**

Add after the imports, before the component:
```typescript
const TIER_NAMES: Record<SubscriptionTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
};
```

- [ ] **Step 4: Update `TOTAL_SLIDES` from 8 to 9**

Change:
```typescript
const TOTAL_SLIDES = 8;
```
To:
```typescript
const TOTAL_SLIDES = 9;
```

- [ ] **Step 5: Insert the subscription slide into the `slides` array**

The current slide 8 (index 7) is the summary ("You're all set!"). Insert the new subscription slide **before** it. The slides array currently ends with the summary slide. Replace:
```typescript
// Slide 8: All set
<View style={styles.slide} key="s8">
```
With a new slide 8 then the existing summary renumbered as slide 9:
```typescript
// Slide 8: Subscription selection
<View style={styles.slide} key="s8">
  <View style={styles.slideContent}>
    <Text style={styles.slideTitle}>Choose your plan</Text>
    <Text style={styles.slideHint}>Select the subscription that suits your business. You can change this anytime.</Text>
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
      {(['bronze', 'silver', 'gold'] as SubscriptionTier[]).map(tier => (
        <SubscriptionCard
          key={tier}
          tier={tier}
          isCurrentPlan={selectedTier === tier}
          onSelect={() => setSelectedTier(tier)}
        />
      ))}
    </ScrollView>
    <TouchableOpacity onPress={goNext} style={styles.skipLink}>
      <Text style={styles.link}>Start on Bronze</Text>
    </TouchableOpacity>
  </View>
</View>,

// Slide 9: All set
<View style={styles.slide} key="s9">
```

Also update the key of the existing summary slide from `key="s8"` to `key="s9"`.

- [ ] **Step 6: Add subscription plan line to the summary card**

Inside the summary card in slide 9, add after the accreditations line:
```typescript
<Text style={styles.summaryRow}>💳 {selectedTier ? TIER_NAMES[selectedTier] : 'Bronze'} plan</Text>
```

- [ ] **Step 7: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/app/sign-up.tsx
git commit -m "feat: add subscription selection slide to sign-up carousel"
```

---

## Task 5: Enforce required fields on key slides

**Files:**
- Modify: `frontend/app/sign-up.tsx`

Required slides: 1 (credentials), 2 (trade, index 1), 3 (skills, index 2), 5 (day rate, index 4), 6 (location, index 5). Accreditations (index 3), photo (index 6), and subscription (index 7) remain optional.

- [ ] **Step 1: Add `isSlideValid` helper**

Add this function inside the component, after the state declarations:
```typescript
const isSlideValid = (slide: number): boolean => {
  switch (slide) {
    case 0: return firstName.trim().length > 0 && email.trim().length > 0 && password.length >= 6;
    case 1: return selectedTrade.length > 0;
    case 2: return selectedSkills.length > 0;
    case 4: return !!dayRate && parseInt(dayRate) > 0;
    case 5: return location.trim().length > 0;
    default: return true;
  }
};
```

- [ ] **Step 2: Update the Continue button `disabled` prop**

Find the Continue/Create Account button in the footer:
```typescript
disabled={isCreatingAccount}
```
Replace with:
```typescript
disabled={isCreatingAccount || !isSlideValid(currentSlide)}
```

- [ ] **Step 3: Add visual style for disabled button**

In the `StyleSheet`, find `primaryBtn` and add a sibling style:
```typescript
primaryBtnDisabled: {
  opacity: 0.45,
},
```

Apply it on the button:
```typescript
style={[styles.primaryBtn, (isCreatingAccount || !isSlideValid(currentSlide)) && styles.primaryBtnDisabled]}
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/sign-up.tsx
git commit -m "feat: disable Continue on required sign-up slides until fields are filled"
```

---

## Task 6: Handle returning users (pre-populate and start at correct slide)

**Files:**
- Modify: `frontend/app/sign-up.tsx`

Returning users: `isAuthenticated = true` and `currentUser` loaded, but `isOnboarded = false`. They get redirected from `index.tsx` to `/sign-up`. They must skip slide 0 (which calls `signUpWithEmail` — they already have a Firebase account), see their previously saved data pre-populated, and start from the first incomplete required slide.

- [ ] **Step 1: Destructure additional values from context**

Change:
```typescript
const { updateCurrentUser } = useApp();
const { signUpWithEmail } = useAuth();
```
To:
```typescript
const { updateCurrentUser, completeOnboarding, updateSubscription, currentUser, isAuthenticated } = useApp();
const { signUpWithEmail } = useAuth();
```

- [ ] **Step 2: Add `isReturningUser` derived value**

Add directly after the context destructuring:
```typescript
const isReturningUser = isAuthenticated && !!currentUser;
```

- [ ] **Step 3: Replace hardcoded state initial values with pre-population from `currentUser`**

By this point (after Tasks 3 and 4), the state declarations in the file look like:
```typescript
const [firstName, setFirstName] = useState('');
const [lastName, setLastName] = useState('');
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [selectedTrade, setSelectedTrade] = useState('');
const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
const [selectedAccreditations, setSelectedAccreditations] = useState<string[]>([]);
const [dayRate, setDayRate] = useState('');
const [dayRateVisible, setDayRateVisible] = useState(true);
const [location, setLocation] = useState('');
const [travelRadius, setTravelRadius] = useState(25);
const [isCreatingAccount, setIsCreatingAccount] = useState(false);
const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
```

Replace the entire block above with this pre-populated version (including `isCompleting` for Task 7):
```typescript
const [firstName, setFirstName] = useState(currentUser?.firstName ?? '');
const [lastName, setLastName] = useState(currentUser?.lastName ?? '');
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [selectedTrade, setSelectedTrade] = useState(currentUser?.trade ?? '');
const [selectedSkills, setSelectedSkills] = useState<string[]>(currentUser?.skills ?? []);
const [selectedAccreditations, setSelectedAccreditations] = useState<string[]>(currentUser?.accreditations ?? []);
const [dayRate, setDayRate] = useState(currentUser?.dayRate ? String(currentUser.dayRate) : '');
const [dayRateVisible, setDayRateVisible] = useState(currentUser?.dayRateVisible ?? true);
const [location, setLocation] = useState(currentUser?.location ?? '');
const [travelRadius, setTravelRadius] = useState(currentUser?.travelRadius ?? 25);
const [isCreatingAccount, setIsCreatingAccount] = useState(false);
const [isCompleting, setIsCompleting] = useState(false);
const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
```

- [ ] **Step 4: Add `getInitialSlide` and use it for `currentSlide` initial value**

Add this function before `useState` calls (or inline as the initial value):
```typescript
const getInitialSlide = (): number => {
  if (!isReturningUser) return 0;
  if (!currentUser?.trade) return 1;
  if (!currentUser?.skills?.length) return 2;
  if (!currentUser?.dayRate) return 4;
  if (!currentUser?.location) return 5;
  return 7; // all required fields done, go to subscription slide
};

const [currentSlide, setCurrentSlide] = useState(getInitialSlide);
```

Note: passing `getInitialSlide` (without `()`) to `useState` means it runs once as an initialiser function.

- [ ] **Step 5: Scroll FlatList to the initial slide after mount**

Add a `useEffect` after the state declarations:
```typescript
useEffect(() => {
  if (currentSlide > 0) {
    // Give the FlatList time to lay out before scrolling
    setTimeout(() => {
      pagerRef.current?.scrollToIndex({ index: currentSlide, animated: false });
    }, 50);
  }
}, []); // Run once on mount
```

- [ ] **Step 6: Update `minSlide` and back-navigation logic**

Add after the `isReturningUser` declaration:
```typescript
const minSlide = isReturningUser ? 1 : 0;
```

Update `goPrev`:
```typescript
const goPrev = () => {
  if (currentSlide > minSlide) {
    const prev = currentSlide - 1;
    pagerRef.current?.scrollToIndex({ index: prev, animated: true });
    setCurrentSlide(prev);
  } else {
    router.back();
  }
};
```

- [ ] **Step 7: Update the back/close button in the header to use `minSlide`**

Change:
```typescript
{currentSlide > 0 ? (
```
To:
```typescript
{currentSlide > minSlide ? (
```

- [ ] **Step 8: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add frontend/app/sign-up.tsx
git commit -m "feat: pre-populate sign-up carousel for returning users and start at first incomplete slide"
```

---

## Task 7: Update `handleComplete` to call `completeOnboarding` and handle tier

**Files:**
- Modify: `frontend/app/sign-up.tsx`

- [ ] **Step 1: Confirm `isCompleting` state exists**

`isCompleting` was added to the state block in Task 6 Step 3. Verify it is present in `sign-up.tsx`:
```typescript
const [isCompleting, setIsCompleting] = useState(false);
```
If Task 6 hasn't been completed yet, add this line after `isCreatingAccount`.

- [ ] **Step 2: Replace `handleComplete`**

Replace the entire `handleComplete` function:
```typescript
const handleComplete = async () => {
  setIsCompleting(true);
  try {
    await updateCurrentUser({
      firstName: firstName.trim() || 'User',
      lastName: lastName.trim() || undefined,
      trade: selectedTrade,
      skills: selectedSkills,
      accreditations: selectedAccreditations,
      dayRate: parseInt(dayRate) || 150,
      dayRateVisible,
      location,
      travelRadius,
    });
    await completeOnboarding();
    if (selectedTier && selectedTier !== 'bronze') {
      await updateSubscription(selectedTier);
    }
    router.replace('/(tabs)/jobs');
  } catch {
    Alert.alert('Profile setup failed', 'Could not save your profile. Please try again.');
  } finally {
    setIsCompleting(false);
  }
};
```

- [ ] **Step 3: Update the "Go to Jobs Board" button to reflect loading state**

In the summary slide, the button currently is:
```typescript
<TouchableOpacity style={styles.primaryBtn} onPress={handleComplete} activeOpacity={0.85}>
  <Text style={styles.primaryBtnText}>Go to Jobs Board</Text>
  <Ionicons name="arrow-forward" size={20} color={colors.white} />
</TouchableOpacity>
```

Replace with:
```typescript
<TouchableOpacity
  style={[styles.primaryBtn, isCompleting && styles.primaryBtnDisabled]}
  onPress={handleComplete}
  activeOpacity={0.85}
  disabled={isCompleting}
>
  <Text style={styles.primaryBtnText}>
    {isCompleting ? 'Setting up your profile...' : 'Go to Jobs Board'}
  </Text>
  {!isCompleting && <Ionicons name="arrow-forward" size={20} color={colors.white} />}
</TouchableOpacity>
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/sign-up.tsx
git commit -m "feat: complete onboarding and handle subscription tier on sign-up finish"
```

---

## Verification

Start the dev server and test these scenarios manually:

### Setup
```bash
cd frontend && npx expo start
```
Open in Expo Go or simulator.

### Scenario 1: New sign-up happy path with paid tier
- [ ] Tap "Let's get started today!" on welcome screen
- [ ] Fill in First Name, Last Name, email, password → tap "Create Account"
- [ ] Carousel continues to slide 2 (Trade) — NOT redirected to jobs board
- [ ] Select a trade → "Continue" becomes enabled → advance
- [ ] Select skills → advance
- [ ] Skip accreditations
- [ ] Enter day rate → advance
- [ ] Enter location → advance
- [ ] Skip photo
- [ ] Select Gold plan on subscription slide → advance
- [ ] Summary slide shows name, trade, location, "Gold plan"
- [ ] Tap "Go to Jobs Board" → brief loading text → arrives at jobs board
- [ ] Stripe checkout opens (if API connected) or app navigates normally

### Scenario 2: New sign-up, skip subscription ("Start on Bronze")
- [ ] Complete all required slides
- [ ] On subscription slide, tap "Start on Bronze" link
- [ ] Summary shows "Bronze plan"
- [ ] Tap "Go to Jobs Board" → jobs board (no Stripe redirect)

### Scenario 3: Required field enforcement
- [ ] On slide 2 (Trade), "Continue" button is disabled/greyed until a trade is selected
- [ ] On slide 3 (Skills), "Continue" disabled until at least one skill selected
- [ ] On slide 5 (Day Rate), "Continue" disabled until a number > 0 is entered
- [ ] On slide 6 (Location), "Continue" disabled until location text is entered

### Scenario 4: Returning user with incomplete profile
- [ ] In backend/Firebase, manually set `isOnboarded = false` for an existing user (or register with the old build and truncate onboarding)
- [ ] Open app, sign in → redirected to sign-up carousel
- [ ] Carousel starts at first incomplete required slide (not slide 1)
- [ ] Previously filled fields are pre-populated
- [ ] Complete carousel → arrives at jobs board, `isOnboarded = true`

### Scenario 5: App restart mid-carousel
- [ ] Begin sign-up, complete slide 1 (account created), close app before finishing
- [ ] Reopen app → redirected back to sign-up carousel, not jobs board

### Scenario 6: Completed user returning
- [ ] User with `isOnboarded = true` opens app → goes straight to jobs board
- [ ] No welcome screen flash

### Scenario 7: Back navigation for returning users
- [ ] Returning user on slide 2 (first accessible slide) → back button shows X (close), not arrow back
- [ ] Tapping X exits to welcome screen (via `router.back()`)
