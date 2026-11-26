# 0016. Ship Patient and Provider Android and iPhone apps from one Capacitor project

- **Status:** Accepted. Scope change asked for and the approach confirmed by the owner on
  16 November 2026 (recorded by Claude Code). Amended 26 November 2026: the owner asked for the
  iPhone apps and approved `@capacitor/ios`; iOS is no longer deferred.
- **Date:** 2026-11-16
- **Requirements:** MA-01 to MA-09 (new); UX-08, PF-07, NT-01, EN-07, SE-02 (unchanged, apply
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

The iPhone apps use the same IDs as bundle IDs. iOS has no product flavours, so one Xcode target
builds either app from the build setting `HEACH_AUDIENCE` (`ios/App/heach.xcconfig`).

- The shell holds no screens, no business rules and no API calls of its own. Every screen is the
  web app's, so authorisation stays on the server (SE-02) and the apps cannot drift from the web.
- The one native addition is `FilesPlugin`: a web view ignores the in-memory download links the
  web app uses, so inside the apps a file the page has already fetched is handed to the shell,
  kept in the app's private cache and opened in the phone's viewer. It holds no rules of its own.
- Two official Capacitor plugins (MIT, maintained with Capacitor) were added on 17 November 2026
  with the owner's approval: `@capacitor/splash-screen` keeps the launch screen up until the page
  says it can be used, and `@capacitor/haptics` gives a short vibration on key confirmations
  (MA-09). The web app calls both through the bridge and takes no dependency on them.
- The server origin is a build setting (`HEACH_SERVER_URL`), never a string in source. Debug
  builds default to `localhost`, forwarded to the developer's machine with `adb reverse`, and
  are the only builds that allow clear-text HTTP; release builds refuse to build without an HTTPS origin.
- The web view may navigate only within the configured origin. Other links open in the browser.
  A partner host listed in `HEACH_ALLOW_NAVIGATION` is the exception: its pages open inside the
  app but never reach the app's bridge (on Android, `PartnerPages` keeps the hosts out of
  Capacitor's own list, which would open the bridge to them, and a WebView too old to limit the
  bridge by origin opens partner pages in the browser instead; amended 26 November 2026). The list
  stays empty unless a partner cannot work in the browser.
- The window is marked secure (no screenshots, no screen recording, blank in the recent-apps
  list) because any screen may show health data. Android backup of app data is off.
- Native features (camera and file upload, app links, UPI and DigiLocker hand-off, push) are
  added one at a time, each behind the adapter the web app or API already has.
- iOS (added 26 November 2026) follows the same rules with `@capacitor/ios` (MIT, maintained with
  Capacitor) and Swift Package Manager; no CocoaPods. Where iOS differs:
  - Capacitor iOS reads a start path as a file inside the app, so the start page is the server
    address itself and the server's host is allowed in full.
  - Capacitor iOS hands its bridge to every page and frame. `BridgeGate` passes on only messages
    from the main frame of the HEACH server or the app's own pages, so on iPhone even a listed
    partner page cannot reach the app's plugins.
  - No app can block a screenshot on iOS. The apps hide their screens in the app switcher and
    while the screen is recorded or mirrored, and keep the web view's data out of backups (MA-04).
  - There is no back button: a swipe from the edge goes back (MA-05).
  - HEACH links (universal links) need the Associated Domains capability, which needs an Apple
    Developer account, and an `apple-app-site-association` file on the server. The app already
    loads such a link's page on its own server, and the server serves the file once
    `APPLE_TEAM_ID` is set; the capability is release work.

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
  The iPhone apps need a Mac with Xcode; CI does not build them yet.
- A phone or a Play build needs a hosted HTTPS environment; only the emulator can use a laptop.
- Release needs things only the owner can provide: a Play developer account, signing keys kept
  in the secrets manager (never in the repository), the Data safety form and the health-app
  declaration. The App Store needs the Apple Developer Program, an App Privacy declaration and
  App Review.
- Push notifications (MA-07) add a third party (Firebase Cloud Messaging). It goes behind the
  notification adapter with a test double, and push text carries no personal or health data.
- Revisit if the apps need screens that the web cannot provide.
