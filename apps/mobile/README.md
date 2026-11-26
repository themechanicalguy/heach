# @heach/mobile

The Android and iPhone apps: one Capacitor project that shows the hosted web app (`apps/web`)
and builds two apps on each platform ([ADR 0016](../../docs/adr/0016-android-apps-with-capacitor.md),
requirements MA-01 to MA-09).

| App        | Android application ID / iPhone bundle ID | Opens at    |
| ---------- | ----------------------------------------- | ----------- |
| `patient`  | `in.heach.patient`                        | `/`         |
| `provider` | `in.heach.provider`                       | `/provider` |

Debug builds add `.debug` to the ID, so they install beside a store build.

There are no screens here except the offline page, which `scripts/offline-page.mjs` writes from
the i18n catalogues.

## Android

Gradle flavours `patient` and `provider`. Names, icons and colours per app are in
`android/app/src/patient` and `android/app/src/provider`; the secured window, back button and
server address are in `MainActivity.java` and `android/app/build.gradle`. `FilesPlugin.java`
opens a file the web app hands over (a record, a report) in the phone's viewer, because a web
view cannot download the web app's in-memory files.

## iPhone

One Xcode target; the build setting `HEACH_AUDIENCE` picks the app (`ios/App/heach.xcconfig`).

| File                        | Does                                                                       |
| --------------------------- | -------------------------------------------------------------------------- |
| `HeachViewController.swift` | Server address, user agent, launch screen, swipe back, links from outside  |
| `PageErrors.swift`          | Offline page when the server is out of reach; the server-fault page on 5xx |
| `BridgeGate.swift`          | Lets only HEACH's own pages reach the app's plugins                        |
| `FilesPlugin.swift`         | Opens a file the web app hands over in the phone's viewer                  |
| `ScreenShield.swift`        | Covers the screens in the app switcher and while the screen is recorded    |
| `build-checks.sh`           | Refuses a release build without an HTTPS server                            |
| `scripts/ios-resources.mjs` | Icons, colours and the camera permission text in Odia, English, Hindi      |

Setup and commands: [local development](../../docs/local-development.md#android-apps) and
[iPhone apps](../../docs/local-development.md#iphone-apps).
