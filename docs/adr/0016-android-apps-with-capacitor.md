# 0016. Ship Patient and Provider Android apps from one Capacitor project

- **Status:** Accepted. Scope change asked for and the approach confirmed by the owner on
  16 November 2026 (recorded by Claude Code).
- **Date:** 2026-11-16
- **Requirements:** MA-01 to MA-08 (new); UX-08, PF-07, NT-01, EN-07, SE-02 (unchanged, apply
  inside the apps)

## Context

The requirements put native Android and iOS apps out of scope and relied on the installable PWA.
The owner now wants Android apps in the Play Store: one for patients and one for providers,
built from a single project. Most users are on Android phones, many of them low-end, and the
patient and provider web app is a server-rendered Next.js application with about 30 screens,
three languages, cookie sessions and server-side authorisation that must not be duplicated.
The development machine has no Xcode and too little free disk for it.

## Decision

Add `apps/mobile`: one [Capacitor](https://capacitorjs.com) project (MIT licence, maintained by
Ionic) whose Android shell loads the hosted web app, with two Gradle product flavours.

| Flavour | Application ID | Opens at | Label |
| --- | --- | --- | --- |
| `patient` | `in.heach.patient` | `/` | HEACH |
| `provider` | `in.heach.provider` | `/provider` | HEACH Provider |

- The shell holds no screens, no business rules and no API calls of its own. Every screen is the
  web app's, so authorisation stays on the server (SE-02) and the apps cannot drift from the web.
- The server origin is a build setting (`HEACH_SERVER_URL`), never a string in source. Debug
  builds default to `localhost`, forwarded to the developer's machine with `adb reverse`, and
  are the only builds that allow clear-text HTTP; release builds refuse to build without an HTTPS origin.
- The web view may navigate only within the configured origin. Other links open in the browser.
- The window is marked secure (no screenshots, no screen recording, blank in the recent-apps
  list) because any screen may show health data. Android backup of app data is off.
- Native features (camera and file upload, app links, UPI and DigiLocker hand-off, push) are
  added one at a time, each behind the adapter the web app or API already has.
- iOS is deferred. Capacitor keeps it open: the same project can add an iOS shell later.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Capacitor shell over the hosted web app, two flavours (chosen) | Reuses every screen, catalogue and session; one place for authorisation; small native surface to secure; iOS possible later | Needs a network connection and a hosted origin; feels like the web app, not a native redesign |
| React Native or Flutter | Native widgets and navigation | Rewrites about 30 screens and `packages/ui`; two front ends to keep in step; months of work before parity |
| Trusted Web Activity | Thinnest wrapper; uses the phone's Chrome | Cannot mark the window secure; no control over navigation or native features; depends on Chrome being present |
| Stay PWA only | No new work | The owner wants Play Store apps; install rates for PWAs are low among the target users |

## Consequences

- New tooling on every developer machine that builds the apps: JDK 21 and the Android SDK
  ([local development](../local-development.md)). CI needs a job that builds both flavours.
- A phone or a Play build needs a hosted HTTPS environment; only the emulator can use a laptop.
- Release needs things only the owner can provide: a Play developer account, signing keys kept
  in the secrets manager (never in the repository), the Data safety form and the health-app
  declaration.
- Push notifications (MA-07) add a third party (Firebase Cloud Messaging). It goes behind the
  notification adapter with a test double, and push text carries no personal or health data.
- Revisit if the apps need screens that the web cannot provide, or when iOS is scheduled.
