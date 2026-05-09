# Google OAuth (Firebase Auth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Continue with Google" to sign-in and sign-up screens via `@react-native-google-signin/google-signin`; button is hidden in Expo Go, active in dev builds and production.

**Architecture:** `lib/googleAuth.ts` owns the native Google sign-in flow and Firebase credential exchange. `AuthContext` exposes `signInWithGoogle()` returning `UserCredential` so callers can read `displayName` / `email` for onboarding pre-fill. The Expo Go guard lives at two levels: the library throws immediately, and the UI never renders the button.

**Tech Stack:** `@react-native-google-signin/google-signin`, Firebase Auth (modular v12), `expo-constants`, EAS Build

---

## Prerequisites (manual steps — must be done before Task 1)

1. **Download `GoogleService-Info.plist`** — Firebase Console → Project Settings → iOS app → Download. Place at `frontend/GoogleService-Info.plist`.
2. **Note `REVERSED_CLIENT_ID`** — open `GoogleService-Info.plist`, find the `REVERSED_CLIENT_ID` string value (format: `com.googleusercontent.apps.XXXXXXXX`). Needed for `app.json`.
3. **Note iOS Client ID** — the `CLIENT_ID` value in `GoogleService-Info.plist` (format: `XXXXXXXX.apps.googleusercontent.com`).
4. **Get Web Client ID** — Google Cloud Console → APIs & Services → Credentials → find or create a "Web application" OAuth 2.0 client → copy the Client ID.

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `frontend/lib/googleAuth.ts` | Create | Native Google sign-in → Firebase credential exchange; Expo Go guard |
| `frontend/context/AuthContext.tsx` | Modify | Expose `signInWithGoogle(): Promise<UserCredential>` on context |
| `frontend/app/sign-in.tsx` | Modify | Google button + "or" divider, hidden in Expo Go |
| `frontend/app/sign-up.tsx` | Modify | Google button on slide 0, skip to slide 1, pre-fill name |
| `frontend/app.json` | Modify | Add plugin + `ios.googleServicesFile` |

---

## Task 1: Install package, configure `app.json`, add env vars

**Files:**
- Modify: `frontend/app.json`
- Modify: `frontend/.env`

- [ ] **Step 1: Install `@react-native-google-signin/google-signin`**

```bash
cd frontend && npm install @react-native-google-signin/google-signin
```

Expected: dependency added to `package.json` and `node_modules`.

- [ ] **Step 2: Update `frontend/app.json`**

Add `googleServicesFile` to the `ios` block, and add the plugin to `plugins`. The full updated file:

```json
{
  "expo": {
    "name": "Onsite Monday",
    "slug": "onsite-monday",
    "scheme": "onsite-monday",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#8B2020"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.onsitemonday.app",
      "googleServicesFile": "./GoogleService-Info.plist",
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
    },
    "android": {
      "googleServicesFile": "./google-services.json",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#8B2020"
      },
      "edgeToEdgeEnabled": true,
      "predictiveBackGestureEnabled": false,
      "package": "com.onsitemonday.app",
      "permissions": [
        "android.permission.RECORD_AUDIO"
      ]
    },
    "web": {
      "favicon": "./assets/favicon.png",
      "bundler": "metro"
    },
    "plugins": [
      "expo-router",
      "expo-image-picker",
      [
        "expo-notifications",
        {
          "icon": "./assets/icon.png",
          "color": "#8B2020"
        }
      ],
      "@react-native-community/datetimepicker",
      [
        "@react-native-google-signin/google-signin",
        {
          "iosUrlScheme": "com.googleusercontent.apps.REPLACE_WITH_REVERSED_CLIENT_ID"
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    },
    "extra": {
      "router": {},
      "eas": {
        "projectId": "cdc22bd5-769a-4483-9e91-8ee878059ed4"
      }
    },
    "owner": "hughpaul"
  }
}
```

Replace `REPLACE_WITH_REVERSED_CLIENT_ID` with the actual `REVERSED_CLIENT_ID` from `GoogleService-Info.plist`.

- [ ] **Step 3: Add env vars to `frontend/.env`**

Add these two lines:
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=REPLACE_WITH_WEB_CLIENT_ID.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=REPLACE_WITH_IOS_CLIENT_ID.apps.googleusercontent.com
```

Replace with actual values from prerequisites.

- [ ] **Step 4: Commit**

```bash
cd frontend && git add app.json package.json package-lock.json
git commit -m "chore: install @react-native-google-signin/google-signin, configure app.json"
```

---

## Task 2: Create `lib/googleAuth.ts`

**Files:**
- Create: `frontend/lib/googleAuth.ts`

- [ ] **Step 1: Create the file**

Create `frontend/lib/googleAuth.ts` with this exact content:

```ts
import Constants from 'expo-constants';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from './firebase';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID!,
});

export async function signInWithGoogle() {
  if (Constants.appOwnership === 'expo') {
    // Button is hidden in Expo Go — this throw is a safety net.
    throw new Error('Google sign-in is not available in Expo Go. Use the dev build.');
  }

  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();

  if (response.type === 'cancelled') {
    throw new Error('cancelled');
  }

  const credential = GoogleAuthProvider.credential(response.data.idToken);
  return signInWithCredential(auth, credential);
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors in `lib/googleAuth.ts`. If you see `Property 'type' does not exist on SignInResponse`, the installed version of the package uses the older throwing API — replace the `response` block with:

```ts
const userInfo = await GoogleSignin.signIn();
const credential = GoogleAuthProvider.credential(userInfo.idToken!);
return signInWithCredential(auth, credential);
```

And remove the `if (response.type === 'cancelled')` block (cancellation will throw a `statusCodes.SIGN_IN_CANCELLED` error instead — let it propagate to the caller).

- [ ] **Step 3: Commit**

```bash
git add lib/googleAuth.ts
git commit -m "feat: add googleAuth lib with Expo Go guard and native sign-in"
```

---

## Task 3: Extend `context/AuthContext.tsx` with `signInWithGoogle`

**Files:**
- Modify: `frontend/context/AuthContext.tsx`

- [ ] **Step 1: Replace the file content**

Replace `frontend/context/AuthContext.tsx` entirely with:

```ts
import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  type UserCredential,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { signInWithGoogle as googleSignIn } from '@/lib/googleAuth';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  isAuthLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<UserCredential>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthContextProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const signInWithGoogle = (): Promise<UserCredential> => {
    return googleSignIn();
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, isAuthLoading, signInWithEmail, signUpWithEmail, signOut, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthContextProvider');
  return ctx;
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add context/AuthContext.tsx
git commit -m "feat: expose signInWithGoogle on AuthContext"
```

---

## Task 4: Add Google sign-in button to `app/sign-in.tsx`

**Files:**
- Modify: `frontend/app/sign-in.tsx`

- [ ] **Step 1: Update imports**

Change the `@expo/vector-icons` import line (currently line 9) to:
```ts
import { MaterialCommunityIcons, Ionicons, AntDesign } from '@expo/vector-icons';
```

Add `Constants` import after the last existing import:
```ts
import Constants from 'expo-constants';
```

- [ ] **Step 2: Update `useAuth` destructure and add state**

Change line 19:
```ts
// From:
const { signInWithEmail } = useAuth();
// To:
const { signInWithEmail, signInWithGoogle } = useAuth();
```

Add `isGoogleSigningIn` state after the `isSigningIn` state declaration (currently line 24):
```ts
const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
```

- [ ] **Step 3: Add `handleGoogleSignIn`**

Add this function immediately after the closing brace of `handleSignIn` (before the `return` statement):

```ts
const handleGoogleSignIn = async () => {
  setIsGoogleSigningIn(true);
  try {
    await signInWithGoogle();
    router.replace('/(tabs)/jobs');
  } catch (err: unknown) {
    if ((err as Error).message === 'cancelled') return;
    Alert.alert('Google sign-in failed', 'Please try again.');
  } finally {
    setIsGoogleSigningIn(false);
  }
};
```

- [ ] **Step 4: Add divider and button to JSX**

After the closing `</TouchableOpacity>` of the primary "Sign In" button (the one with `styles.primaryBtn`) and before the closing `</Animated.View>`, insert:

```tsx
{Constants.appOwnership !== 'expo' && (
  <>
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or</Text>
      <View style={styles.dividerLine} />
    </View>
    <TouchableOpacity
      style={[styles.googleBtn, isGoogleSigningIn && { opacity: 0.7 }]}
      onPress={handleGoogleSignIn}
      activeOpacity={0.85}
      disabled={isGoogleSigningIn}
    >
      {isGoogleSigningIn ? (
        <ActivityIndicator color={colors.text} size="small" />
      ) : (
        <AntDesign name="google" size={18} color="#DB4437" />
      )}
      <Text style={styles.googleBtnText}>Continue with Google</Text>
    </TouchableOpacity>
  </>
)}
```

- [ ] **Step 5: Add styles**

At the end of `StyleSheet.create({...})`, before the closing `})`, add:

```ts
dividerRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginVertical: 20,
  gap: 12,
},
dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
dividerText: { fontSize: 13, color: colors.textLight },
googleBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  borderWidth: 1.5,
  borderColor: colors.primary,
  borderRadius: 12,
  paddingVertical: 16,
  backgroundColor: colors.white,
},
googleBtnText: { fontSize: 16, fontWeight: '600', color: colors.text },
```

- [ ] **Step 6: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add app/sign-in.tsx
git commit -m "feat: add Google sign-in button to sign-in screen"
```

---

## Task 5: Add Google sign-in to `app/sign-up.tsx` (slide 0)

**Files:**
- Modify: `frontend/app/sign-up.tsx`

- [ ] **Step 1: Update imports**

Change the `@expo/vector-icons` import (currently line 9):
```ts
// From:
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
// To:
import { Ionicons, MaterialCommunityIcons, AntDesign } from '@expo/vector-icons';
```

Add `ActivityIndicator` to the `react-native` import (currently line 2–6). The updated import:
```ts
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  FlatList, Dimensions, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
```

Add `Constants` after the last existing import:
```ts
import Constants from 'expo-constants';
```

- [ ] **Step 2: Update `useAuth` destructure**

Change line 29:
```ts
// From:
const { signUpWithEmail } = useAuth();
// To:
const { signUpWithEmail, signInWithGoogle } = useAuth();
```

- [ ] **Step 3: Add state variables**

After the `isCompleting` state declaration (currently line 58), add:
```ts
const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
const [googleAuthenticated, setGoogleAuthenticated] = useState(false);
```

- [ ] **Step 4: Update `minSlide`**

Change line 31:
```ts
// From:
const minSlide = isReturningUser ? 1 : 0;
// To:
const minSlide = isReturningUser || googleAuthenticated ? 1 : 0;
```

- [ ] **Step 5: Add `handleGoogleSignIn`**

Add this function immediately after the closing brace of `handleCreateAccount` (before `handleComplete`):

```ts
const handleGoogleSignIn = async () => {
  setIsGoogleSigningIn(true);
  try {
    const result = await signInWithGoogle();
    const displayName = result.user.displayName ?? '';
    const parts = displayName.trim().split(/\s+/);
    setFirstName(parts[0] ?? '');
    setLastName(parts.slice(1).join(' '));
    setGoogleAuthenticated(true);
    pagerRef.current?.scrollToIndex({ index: 1, animated: true });
    setCurrentSlide(1);
  } catch (err: unknown) {
    if ((err as Error).message === 'cancelled') return;
    Alert.alert('Google sign-in failed', 'Please try again.');
  } finally {
    setIsGoogleSigningIn(false);
  }
};
```

- [ ] **Step 6: Add divider and button to slide 0**

In the slide 0 JSX array entry (the `<View style={styles.slide} key="s1">` element), find the `<View style={styles.illustrationWrap}>` block near the end of the slide content. After the closing `</View>` of that block (and still inside `<View style={styles.slideContent}>`), add:

```tsx
{Constants.appOwnership !== 'expo' && (
  <>
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or</Text>
      <View style={styles.dividerLine} />
    </View>
    <TouchableOpacity
      style={[styles.googleBtn, isGoogleSigningIn && { opacity: 0.7 }]}
      onPress={handleGoogleSignIn}
      activeOpacity={0.85}
      disabled={isGoogleSigningIn}
    >
      {isGoogleSigningIn ? (
        <ActivityIndicator color={colors.text} size="small" />
      ) : (
        <AntDesign name="google" size={18} color="#DB4437" />
      )}
      <Text style={styles.googleBtnText}>Continue with Google</Text>
    </TouchableOpacity>
  </>
)}
```

- [ ] **Step 7: Add styles**

At the end of `StyleSheet.create({...})`, before the closing `})`, add:

```ts
dividerRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginVertical: 16,
  gap: 12,
},
dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
dividerText: { fontSize: 13, color: colors.textLight },
googleBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  borderWidth: 1.5,
  borderColor: colors.primary,
  borderRadius: 12,
  paddingVertical: 14,
  backgroundColor: colors.white,
},
googleBtnText: { fontSize: 15, fontWeight: '600', color: colors.text },
```

- [ ] **Step 8: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 9: Commit**

```bash
git add app/sign-up.tsx
git commit -m "feat: add Google sign-in to sign-up screen, skip to slide 1 on success"
```

---

## Task 6: Build dev build and verify

**Files:** None — build and test only.

- [ ] **Step 1: Trigger EAS development build**

```bash
cd frontend && eas build --profile development --platform ios
```

Expected: build completes. If it fails at the Xcode step with a Google Sign-In error, verify `iosUrlScheme` in `app.json` matches the `REVERSED_CLIENT_ID` from `GoogleService-Info.plist` exactly.

- [ ] **Step 2: Verify Expo Go — buttons are hidden**

Open the app in Expo Go on your device:
- Sign-in screen: "Continue with Google" is **not visible**
- Sign-up screen slide 0: "Continue with Google" is **not visible**
- Email/password auth works as before

- [ ] **Step 3: Verify dev build — sign-in screen**

On the dev build:
- Sign-in screen shows "Continue with Google" below an "or" divider
- Tapping it opens the native Google account picker sheet
- Selecting an account signs in and routes to `/(tabs)/jobs`
- Pressing the native cancel/back dismisses the sheet with no error

- [ ] **Step 4: Verify dev build — sign-up screen, new Google user**

On the dev build, navigate to sign-up:
- Slide 0 shows "Continue with Google" below the form
- Tapping it opens the native Google account picker
- After selecting an account, the carousel advances to slide 1 (trade selection)
- First name and last name fields (visible on slide 8 summary) are pre-filled from the Google display name
- Completing all slides and tapping "Go to Jobs Board" creates the profile and navigates to `/(tabs)/jobs`

- [ ] **Step 5: Verify dev build — returning Google user**

Sign out. On sign-in screen, tap "Continue with Google", select the same account used in Step 4.
Expected: routes directly to `/(tabs)/jobs` with no onboarding shown (AppContext sees `isOnboarded === true`).
