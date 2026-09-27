# Semester for iOS (Expo)

A 1:1 port of the Semester Flutter app (`../mobile`) to React Native / Expo,
built for iOS with iPad as a first-class target. Same data, same Appwrite
project, same server — the three clients (web, Android/Flutter, iOS/Expo)
read and write interchangeable state.

## Stack

- **Expo SDK 57 / React Native 0.86**, TypeScript, no navigation framework —
  the shell (`src/components/AppShell.tsx`) mirrors the Flutter app's custom
  navigation: 5 in-shell tabs + pushed overflow pages with a back button.
- **zustand + AsyncStorage** persistence: every store uses the exact same
  storage key and `{"state": …, "version": n}` envelope as the web app
  (`semester.subjects`, `semester.todos`, `semester.homework`,
  `semester.grades`, `semester.events`, `semester.timetable`,
  `semester.studyroom`, `semester.portal`, `semester.syncmeta`,
  `semester.server`, `semester.theme`).
- **Appwrite over plain REST** (`src/lib/appwrite.ts`): session secrets
  persist in AsyncStorage and authenticate via `X-Appwrite-Session`; row
  calls use JWT + `X-Appwrite-JWT`; queries are JSON objects in `queries[]`
  params — all the Cloud 2.2 quirks the web app already lives with.
- **Fonts**: the same families as the web/mobile app (Fraunces, Instrument
  Sans, IBM Plex Mono), bundled. Icons are Material Symbols (variable font +
  a codepoint map in `src/components/icon_glyphs.ts`), with the FILL axis
  flipped via `fontVariations` for selected states.

## iPad support (the focus)

`src/components/AppShell.tsx` switches layouts at 768pt width:

- **iPhone**: wordmark header with the current-destination label, custom
  bottom tab bar, overflow pages (Calendar · Grades · Study Room · Settings)
  push over the tabs with a back button and the Flutter fade-through motion.
- **iPad**: a sidebar layout — all nine destinations are permanent sidebar
  items, tab panes stay mounted, content uses the full width. The timetable
  grid stretches its day columns instead of horizontal scrolling, the
  dashboard runs "Up next" and "Next 7 days" side by side, grades use a
  two-column subject layout, and form sheets render as centered cards
  instead of bottom sheets.

`app.json` sets `supportsTablet`, `requireFullScreen: false` and all
orientations, so Split View / Slide Over / Stage Manager work.

## Develop

```bash
cd ios
npm install
npx expo start          # press i for the iOS simulator (needs macOS/Xcode)
```

The app talks to the Semester web server for AI + portal features. The
default is `http://localhost:8899` (change it in Settings → Semester
server); the Docker-hosted server from the repo root works as-is.

## Build for a device

No native `ios/` project is committed — Expo generates it (CNG). Either:

```bash
npx expo prebuild -p ios --no-install   # generate ios/native project (macOS for pods)
# or use EAS:
npx eas build -p ios --profile development
```

Appwrite endpoint/project can be overridden at bundle time:

```bash
EXPO_PUBLIC_APPWRITE_ENDPOINT=… EXPO_PUBLIC_APPWRITE_PROJECT_ID=… npx expo export
```

Defaults are the same public client values as the web app and Android app
(project `6aac46e3001a9ef65b25`, database `semester`).

## Ported 1:1

Overview dashboard (Today hero, Up next, Next 7 days, quiet stats strip,
subject averages, clear-all) · Tasks and Homework with filters, subject
chips, auto-saving form sheets (debounced text commit + "Untitled" close-time
flush) · Timetable with JSON import (same alias/normalization rules) and the
Eltern-portal substitute plan overlaid on the grid (weekday + period-range
matching, cancelled/substituted tinting) · Calendar month/week views with
todo due dates folded in and the auto-saving event form · Grades with the
Punkte system, weighted averages, points→grades table, quick-pick · Study
Room (document upload with bucket copy, flashcard generation, streaming chat
with sources and markdown) · Settings/Auth (sign in/up, email verification,
password recovery, email-2FA sign-in step with TOTP + recovery codes, 2FA
setup, sync status, "Sync now") · push targets for Appwrite Messaging ·
`semester://` deep links · foreground resync + 30 s retry loop.

The sync engine (`src/lib/sync.ts`) is the same digest-diff row sync as the
web app: one row per entity, content-hash row ids (`hashId` is
byte-identical across all three clients), pending local edits win on merge,
tombstone deletes, portal snapshot reconciliation, realtime row events.

## Deliberately deferred

- **WidgetKit widgets** — iOS home-screen widgets need a native WidgetKit
  extension (Swift target + app group). `src/lib/widgets.ts` already builds
  the identical agenda/timetable payloads the Android widgets render; the
  remaining work is a Swift target reading them from a shared UserDefaults
  suite. The Settings page explains gallery-based pinning meanwhile.
- **Android from this codebase** — `mobile/` (Flutter) remains the Android
  app; this Expo project declares `"platforms": ["ios"]`.

## Checks that pass here

```bash
npx tsc --noEmit                 # clean
npx expo export --platform ios   # bundles, 854 modules
npx expo config --type public    # config + plugins resolve
```

Native build/run needs macOS (Xcode) or EAS Build — this Linux workstation
can verify everything above but cannot run the simulator.
