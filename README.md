# Zigly — WebView shell (preview)

A React Native container that hosts **https://zigly.com** and adds the things a
website cannot do for itself: a splash, an offline screen, Android back
navigation, and an OS-level URL policy that makes UPI payment handoff work.

> **Status: Phase 4 — unmodified WebView.**
> No CSS is injected. No DOM is rewritten. The site renders exactly as it would
> in Chrome. This is deliberate; see *Why so little* below.
>
> **Not sanctioned by Zigly.** The application ID is
> `com.zigly.webview.preview` and the launcher label is "Zigly Preview" so this
> build can never be confused with the published `com.zigly.app` listing.

## Why so little

Analysis of the live site found that **the official Zigly Pet Care app is itself
a WebView wrapper**, and that the mobile UI it presents is drawn by the website:

| App UI element | Actually rendered by |
| --- | --- |
| 5-tab bottom navigation | the site's own `.fixed-icons`, fixed below 990px |
| PDP *Add to Bag / Buy Now* bar | the site's `.mobile-atc-main` |
| Listing *Sort / Filter* bar | SearchTap's `initial-search-sort` / `-filters` |
| Category circles, coupons, breed rail | real Shopify sections |

Adding a native bottom bar would therefore stack a second one on top of the
site's. The correct shell is small on purpose.

## Requirements

- Node 20+ (developed on 24), JDK 17, Android SDK
- An emulator or device on API 24+

## Run

```bash
npm install
npx react-native start           # terminal 1
npx react-native run-android     # terminal 2
```

For an emulator-only build, restricting the ABI is much faster:

```bash
cd android && ./gradlew installDebug -PreactNativeArchitectures=x86_64
```

## Building an APK

Run from the `android/` folder. On Windows use `gradlew.bat` in cmd/PowerShell,
or `./gradlew` in Git Bash.

### Release APK (signed, self-contained, for handing to people)

```bat
cd android
gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
```

Output: `androidppuild\outputspkeleasepp-release.apk`

JavaScript is compiled in, so it needs no Metro, no cable and no dev machine.
Installs on any Android 7+ ARM phone.

### Debug APK (for testing; also sideloadable)

```bat
cd android
gradlew.bat assembleDebug -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
```

Output: `androidppuild\outputspk\debugpp-debug.apk`

### Install straight onto a connected device

```bat
gradlew.bat installDebug -PreactNativeArchitectures=arm64-v8a
```

For an emulator, swap the ABI for `x86_64`. Building every ABI works but takes
roughly four times as long.

### Signing

Release credentials come from `android/keystore.properties`, which points at
`android/app/zigly-release.keystore`. Both are gitignored.

**Back both files up.** If this app is ever published and the keystore is lost,
it can never be updated under the same identity again.

If `keystore.properties` is missing, the build still succeeds but is signed with
the debug key and prints a warning. Such a build must not be distributed.

### Gotchas worth knowing

| Symptom | Cause |
| --- | --- |
| `SDK location not found` | Do not export `ANDROID_HOME` as a POSIX path (`/c/Users/...`). `android/local.properties` already pins the SDK; leave the variable unset. |
| Release build shows the offline screen on office WiFi | Correct behaviour. The corporate proxy CA is trusted in debug builds only. Test on mobile data. |
| Debug build stuck on "Loading from 10.0.2.2:8081" | It wants Metro. Either run `npx react-native start` plus `adb reverse tcp:8081 tcp:8081`, or set `debuggableVariants = []` in `android/app/build.gradle` to embed the bundle. |
| APK will not install on an emulator | Release builds here are ARM-only. Rebuild with `-PreactNativeArchitectures=x86_64`. |

## Layout

```
src/
├── constants/appConstants.ts   host lists, routes, palette
├── utils/
│   ├── urlUtils.ts             the URL policy — see below
│   └── logger.ts               __DEV__-gated, never throws
├── webview/webViewConfig.ts    WebView props (no injection)
├── components/                 LoadingOverlay, NetworkErrorScreen, ZiglyWordmark
└── screens/                    SplashScreen, ZiglyWebViewScreen
```

There is no navigator: one WebView and one splash do not need a navigation graph.

## The URL policy

`src/utils/urlUtils.ts` runs two modes, because a strict allowlist would break
real payments — a card can redirect to an unknowable bank 3-D Secure domain.

- **browsing** — only Zigly hosts render; everything else opens in the browser.
- **checkout** — entered via a Zigly checkout path or a known payment host.
  Any `https` destination may render, because completing a payment requires it.

Non-web schemes (`upi:`, `phonepe:`, `tel:`, `mailto:`, `intent:`) are handed to
the OS. `AndroidManifest.xml` declares matching `<queries>`; without them
Android 11+ silently refuses the intent and checkout dead-ends.

Covered by `__tests__/urlUtils.test.ts` — `npx jest`.

## Phase 4 exit gate

Verified on a physical device (Vivo S1, Android 10) on 2026-08-20. The emulator
on the dev machine has a broken Chromium/GPU path -- Chrome itself renders white
there -- so device testing is the only trustworthy signal.

- [x] Home page renders; real Zigly content, live banner carousel
- [x] Bottom tab bar (the site's own `.fixed-icons`) visible and navigating
- [x] Search, cart, product navigation -- reported working
- [x] OTP login completes (no SMS autofill in a WebView; code typed manually)
- [ ] Reach checkout; UPI intent opens a payment app  <-- highest remaining risk
- [ ] Force-stop, relaunch -- still logged in, cart intact
- [ ] Airplane mode shows the offline screen; Retry recovers
- [ ] Back button walks history, then exits at the root

### Open defects

| Issue | Status |
| --- | --- |
| Content under status bar / gesture pill | Fixed in v2 via native safe-area insets |
| Deprecated `SafeAreaView` warning toast | Fixed in v2 |
| Some homepage sections not visible | Under investigation -- compare against zigly.com in mobile Chrome first; if absent there too it is the site's own mobile design, not an app defect |

## Known gaps (deliberate, scheduled)

| Gap | Phase |
| --- | --- |
| SMS OTP autofill — WebViews get none | 6, needs native SMS Retriever |
| `window.open` disabled, so Shop Pay's popup will not open | 6 |
| File chooser for `<input type=file>` | 6 |
| Geolocation prompt for the site's pincode widget | 6 |
| Cookie flush on background (session persistence) | validate in gate first |
