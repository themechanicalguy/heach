# @heach/mobile

The Android apps: one Capacitor project that shows the hosted web app (`apps/web`) and builds two
apps through Gradle flavours ([ADR 0016](../../docs/adr/0016-android-apps-with-capacitor.md),
requirements MA-01 to MA-08).

| Flavour    | Application ID      | Opens at    |
| ---------- | ------------------- | ----------- |
| `patient`  | `in.heach.patient`  | `/`         |
| `provider` | `in.heach.provider` | `/provider` |

Debug builds add `.debug` to the ID, so they install beside a Play build.

There are no screens here except the offline page, which `scripts/offline-page.mjs` writes from
the i18n catalogues. Names, icons and colours per app are in `android/app/src/patient` and
`android/app/src/provider`; the secured window, back button and server address are in
`MainActivity.java` and `android/app/build.gradle`.

`FilesPlugin.java` opens a file the web app hands over (a record, a report) in the phone's viewer,
because a web view cannot download the web app's in-memory files.

Setup and commands: [local development](../../docs/local-development.md#android-apps).
