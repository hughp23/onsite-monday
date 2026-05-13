# Google OAuth via Firebase Auth — Design Spec

**Date:** 2026-05-09
**Status:** Approved

---

## Context

Apple's App Store guidelines (guideline 4.8) require that any app offering third-party social login must also offer Sign in with Apple. To comply — and to improve sign-in conversion — we are adding Google OAuth as the first social login method. Firebase Auth handles the credential exchange; the token acquisition method varies by runtime environment.

The project currently runs in Expo Go for development and will have a co-founder dev build in parallel. Google OAuth is **not supported in Expo Go** — Google's web OAuth client rejects custom URI schemes, and the Expo auth proxy (`auth.expo.io`) was deprecated in SDK 50. Google sign-in is therefore only available in dev builds and production. Email/password auth remains the only sign-in method in Expo Go.

---

## Architecture

All Google sign-in logic is behind a single `signInWithGoogle()` function in `lib/googleAuth.ts`. In Expo Go the function throws immediately with a clear message; in dev builds and production it uses the native Google account picker sheet.

```
signInWithGoogle()
    ├── Expo Go  (Constants.appOwnership === 'expo')
    │     └── throws Error('Google sign-in is not available in Expo Go')
    │           (button hidden in UI — this is a safety net only)
    └── Dev build / production
          └── @react-native-google-signin/google-signin
                → native Google account picker sheet → Google ID token
                → GoogleAuthProvider.credential(idToken)
                → Firebase signInWithCredential(auth, credential)
                → firebaseUser populated (displayName, email, photoURL)
                → AuthContext updates state
                → AppContext checks isOnboarded
                → Route: new user → sign-up (slide 1) | returning user → /(tabs)/jobs
```

---

## Files Changed

| File | Change |
|---|---|
| `lib/googleAuth.ts` | **New.** `signInWithGoogle()` — native path only; throws in Expo Go |
| `context/AuthContext.tsx` | Add `signInWithGoogle` method + expose on context type |
| `app/sign-in.tsx` | Add "Continue with Google" button + "or" divider (hidden in Expo Go) |
| `app/sign-up.tsx` | Add "Continue with Google" button on slide 0 (hidden in Expo Go); on success skip to slide 1 with pre-filled name/email |
| `app.json` | Add `@react-native-google-signin/google-signin` plugin + `ios.googleServicesFile` |
| `frontend/package.json` | Add `@react-native-google-signin/google-signin` |

---

## `lib/googleAuth.ts`

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
    // Google OAuth cannot run in Expo Go — Google rejects custom URI schemes
    // and the Expo auth proxy was deprecated in SDK 50.
    // The UI hides the button in Expo Go; this throw is a safety net.
    throw new Error('Google sign-in is not available in Expo Go. Use the dev build.');
  }

  await GoogleSignin.hasPlayServices();
  const userInfo = await GoogleSignin.signIn();
  const credential = GoogleAuthProvider.credential(userInfo.idToken!);
  return signInWithCredential(auth, credential);
}
```

---

## `context/AuthContext.tsx` changes

Add to the context type:
```ts
signInWithGoogle: () => Promise<void>;
```

Add method implementation (wraps `lib/googleAuth.ts`):
```ts
const signInWithGoogle = async () => {
  await signInWithGoogle(); // imported as googleSignIn from lib/googleAuth to avoid name clash
};
```

The `firebaseUser` returned by Firebase already carries `displayName`, `email`, and `photoURL` from Google — no extra work needed.

---

## New User Onboarding Flow

`sign-up.tsx` already routes users through a 9-slide carousel. For Google users:

1. Google button on slide 0 triggers `signInWithGoogle()`
2. On success: `setInitialSlide(1)` — skip the email/password slide
3. Pre-fill from `firebaseUser.displayName` and `firebaseUser.email` into the user profile state before the carousel advances
4. Slides 1–8 (trade, skills, day rate, location, subscription) run as normal

Returning Google users (already onboarded) follow the same path as email users: `AppContext` sees `isOnboarded === true` and routes to `/(tabs)/jobs`.

---

## UI

The "Continue with Google" button is **hidden when running in Expo Go** (`Constants.appOwnership === 'expo'`). It appears only in dev builds and production.

Both sign-in and sign-up screens get the same button + divider pattern, on slide 0 only for sign-up:

```
[ existing form ]

──────  or  ──────

[ G   Continue with Google ]
```

- Button: white background, `#8B2020` 1px border, rounded corners matching existing buttons
- Google "G" icon from `@expo/vector-icons` (`AntDesign` "google") or bundled SVG
- Loading: spinner replaces icon, button disabled during flow
- Error handling: `Alert` with "Google sign-in was cancelled" (user cancel) or "Google sign-in failed. Please try again." (other errors)

---

## Configuration Prerequisites

Before implementation, the following must be in place:

### Google Cloud Console
1. Add **Web application** OAuth 2.0 client (if not already present) — this gives the Web Client ID passed to `GoogleSignin.configure`
2. No redirect URI configuration needed — the native SDK handles the OAuth exchange internally via the Android/iOS clients
3. The Android OAuth client already exists in `google-services.json`

### Firebase Console
- No extra config needed — Firebase project is already set up

### iOS
- Download `GoogleService-Info.plist` from Firebase Console → Project Settings → iOS app
- Add path to `app.json`: `"ios": { "googleServicesFile": "./GoogleService-Info.plist" }`

### Environment Variables (`.env`)
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web-client-id>.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<ios-client-id>.apps.googleusercontent.com
```

### `app.json` plugin
```json
"plugins": [
  ["@react-native-google-signin/google-signin", {
    "iosUrlScheme": "com.googleusercontent.apps.<reversed-ios-client-id>"
  }]
]
```
The `iosUrlScheme` is the `REVERSED_CLIENT_ID` value from `GoogleService-Info.plist`.

---

## Testing & Verification

| Scenario | Expected |
|---|---|
| Expo Go: sign-in screen | "Continue with Google" button not rendered |
| Expo Go: sign-up screen (slide 0) | "Continue with Google" button not rendered |
| Dev build: tap "Continue with Google", select account | Native sheet appears, signs in correctly |
| Dev build: dismiss native sheet | Alert: "Google sign-in was cancelled" |
| New Google user: complete onboarding | Profile created with pre-filled email/name; trade/skills/location still required |
| Returning Google user on sign-in screen | Bypasses onboarding, lands on `/(tabs)/jobs` |
| Network error during token exchange | Alert: "Google sign-in failed. Please try again." |
