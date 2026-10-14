---
name: eas-preview-build
description: Use when asked to create, start, kick off or run an EAS preview build, internal APK or test build of the Onsite Monday Android app, or when an EAS build hangs on "Compressing project files".
---

# EAS preview build (Onsite Monday, Android)

## Overview
EAS uploads the **working tree** of the checkout you run it from: uncommitted changes included, `.gitignore` honoured, `.git/info/exclude` **not** honoured. Where you run it and what is on disk decide what gets built.

Set `F=/Users/hugh/Documents/Development/onsite-monday/frontend` and prefix every command with `cd $F &&`. Running `eas` from a Claude worktree (`.claude/worktrees/...`) silently builds that worktree's stale branch.

## Which checkout
- Default: the main checkout (`$F`) on `main`, level with `origin/main` (`git -C $F fetch && git -C $F status -sb`).
- User names another branch: ask whether to merge it into `main` first or build from the checkout that already has it (e.g. its worktree). If the latter, set `F` to that checkout's `frontend/` and run every check there. Never switch branches in the main checkout without asking.
- Uncommitted changes and untracked (not ignored) files under `frontend/` get built: list them (`git -C $F status --short .`) and confirm with the user.

## Pre-flight
| Check | Command | If it fails |
|---|---|---|
| Logged in | `eas whoami` → `hughpaul` | Ask user to `eas login` |
| No build already queued/running | `eas build:list -p android --status in-queue --json --non-interactive` and again with `--status in-progress` → both `[]` | Report that build; don't start a duplicate |
| Code green | `npx tsc --noEmit && npx jest` | Stop, report |
| `android/` not stale (it is committed, so EAS ignores app.json native config) | `git -C $F log --oneline $(git -C $F log -1 --format=%h -- android)..HEAD -- package.json app.json` → empty | Non-empty: `npx expo prebuild --clean -p android --no-install`, review diff, commit, bump runtime version |
| Runtime version consistent | `runtimeVersion` in `app.json` == `expo_runtime_version` in `android/app/src/main/res/values/strings.xml`; bumped after any native change | Fix both |
| Upload small | `git -C $F status --short --ignored` (run from repo root) — no large dir that is only in `.git/info/exclude` | Add it to `.gitignore` |

Build inputs: `EXPO_PUBLIC_*` vars come from `eas.json` → `build.preview.env` (local `.env` is gitignored and not uploaded); `google-services.json` is tracked. Keystore is remote (`onsite-monday-production`).

## Start
Use the installed `eas` binary (`npx eas-cli@latest` stalls on an install prompt). Run in a visible terminal tab:
```bash
cd $F && eas build --platform android --profile preview --non-interactive --no-wait
```
Record the build ID it prints. Wrong build? `eas build:cancel <id>`.

## Monitor (one background command, single notification)
```bash
cd $F && until s=$(eas build:view <id> --json 2>/dev/null | node -pe "j=JSON.parse(require('fs').readFileSync(0));j.status+' '+(j.artifacts?.buildUrl||j.error?.message||'')"); [[ $s =~ ^(FINISHED|ERRORED|CANCELED) ]]; do sleep 60; done; echo "$s"
```
Report FINISHED → APK URL + `https://expo.dev/accounts/hughpaul/projects/onsite-monday/builds/<id>`; ERRORED → message + failing phase from the build page (usually "Run gradlew" or "Install dependencies").

## Tell the user
- `preview` = internal-distribution APK, channel `preview`, pointed at the **production** Railway API with escrow enabled.
- Push notifications don't work in Expo Go on Android; test them in the APK.

## Common mistakes
- Stuck on "Compressing project files" → a huge un-gitignored dir is being archived. Stop, fix `.gitignore`, restart.
- Starting a second build because the first looked stuck → check `build:list` first.
- Bumping `runtimeVersion` in `app.json` only.
