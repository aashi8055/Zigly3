# Zigly — WebView shell (preview)

A React Native container that hosts **https://zigly.com** and adds the things a
website cannot do for itself: a splash, an offline screen, Android back
navigation, and an OS-level URL policy that makes UPI payment handoff work.

> **Status: hybrid — native chrome over site-rendered sections.**
> The "Phase 4 / no injection" description this file used to carry is long out of
> date: the app now ships a native header, announcement bar and cart screen, and
> ~5,000 lines under `src/webview/` restyle the page and reassemble the dashboard
> from Zigly's own sections via Shopify's Section Rendering API. Content still
> comes entirely from the website — see *Where the data comes from* below.
>
> **Not sanctioned by Zigly.** The application ID is
> `com.zigly.webview.preview` and the launcher label is "Zigly Preview" so this
> build can never be confused with the published `com.zigly.app` listing.

## Where the data comes from

Every URL the storefront uses, with verified payload shapes, is catalogued in
[DATA-SOURCES.md](DATA-SOURCES.md). The short version: zigly.com is stock Shopify
(Dawn 15.2.0), so the app needs no backend of its own — it reads the same
endpoints the website reads, which is what keeps the two consistent.

Three rules that document explains in full, repeated here because breaking any
one of them desyncs the app from the site:

- **One cookie jar.** Cart and login live in the `_shopify_*` cookies. Both
  WebViews share the app's jar, so there is a single session and a single cart.
  Section fetches use `credentials: 'same-origin'` for the same reason.
- **Prices are integer paise.** `price: 39900` is ₹399.00. Divide once.
- **Never hardcode a section id.** They carry a theme-generated suffix.
  `pageCache.ts` seeds them only as a fast-path hint and rediscovers on a miss.
  All 22 seeds were re-verified against the live site on 2026-08-21.

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

Output: `android/app/build/outputs/apk/release/app-release.apk`

JavaScript is compiled in, so it needs no Metro, no cable and no dev machine.
Installs on any Android 7+ ARM phone.

### Debug APK (for testing; also sideloadable)

```bat
cd android
gradlew.bat assembleDebug -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

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
├── navigation/pageStack.ts     the inner-page stack — see below
├── search/suggestions.ts       parsing the suggest payload — see below
├── wishlist/wishlistItems.ts   parsing the wishlist payload — see below
├── utils/money.ts              one formatter, one unit (integer paise)
├── webview/webViewConfig.ts    WebView props
├── components/                 NativeHeader, AnnouncementBar, CartScreen,
│                               CartToast, SearchScreen, WishlistScreen,
│                               EmptyState, LoadingBar, NetworkErrorScreen
└── screens/                    SplashScreen, ZiglyWebViewScreen
```

There is no navigator: React Navigation would want to mount and unmount
screens, which is exactly what `pageStack` exists to avoid.

## Screen structure

The announcement bar and the native header are drawn **outside** the container
that holds everything else, and every overlay — page layers, cart, offline
screen — is positioned inside it. That is load-bearing rather than tidy: the
layers are absolutely positioned, so while their container was the whole screen
they covered the header along with the page, and every screen except the
dashboard had no back arrow and no cart.

The header is therefore on every page, and so is the announcement bar — the
reference app carries its offer strip above the header on the collection list
and the product grid alike. Only the search screen stands the strip down, being
keyboard-first. The header is the way back from all of them.

There is no floating progress spinner — that used to sit in the top-right corner
over whatever the page itself puts there. Progress is `LoadingBar`, a hairline
under the header, drawn only for the view the user is actually looking at.

## The inner-page stack

`src/navigation/pageStack.ts`. Zigly's pages carry no cache-control and
Cloudflare reports them DYNAMIC, so mounting a page is always a full download —
`/pages/dog` alone is ~2 MB. The dashboard was already exempt by being kept
mounted; inner pages were mounted on entry and destroyed on Back, so walking
home and tapping the same product again paid for it twice.

So inner pages are kept alive: up to `MAX_LAYERS` of them stay mounted, parked
off screen, and showing one again is a paint. Back, re-entry and the logo are
all free; the costs are bounded and deliberate:

- **Memory.** Three inner WebViews plus the dashboard. Each is a real Android
  renderer, which is why the bound is small and why the deepest page is dropped
  first — see the eviction order in that file.
- **Parked, not `display: none`.** Taking an Android WebView through GONE and
  back is the classic way to get one that returns blank, so hidden layers are
  translated off screen and keep their native visibility.
- **In-page navigation still reloads.** A tap inside a layer navigates that
  layer, and its Back walks the WebView's own history. Pushing a layer per
  navigation would be faster still, but on Android `navigationType` is always
  `'other'` — a redirect and a form post are indistinguishable from a tapped
  link, so checkout and login flows would fragment.
- **Checkout is never cached.** Those layers are torn down on the way out; a
  restored payment page would be showing a session that has moved on.

Covered by `__tests__/pageStack.test.ts` — the module is pure, which is far
easier to test than four WebViews.

## The cart

Native. One full-bleed white block per line with the grey ground showing
through between them, then the order summary, then two pinned footers: the
savings line and the checkout bar. Only the list scrolls, so the total and the
button never leave the screen — and the saving stays visible at the moment the
customer is deciding, which is the only moment it is worth anything.

Empty is a separate screen: a smiling bag, "Your Cart is Empty", one line of
body copy, and a Continue Shopping button back to the dashboard. `EmptyState`
also draws the bare "No items" box that list screens like the wishlist use.
Both glyphs are geometry, not assets — an isometric cube's silhouette is a
regular hexagon; the bag is a rounded rectangle, two diagonals and a smile made
from a fully-rounded bottom edge — so neither needs a bitmap at three densities
or an icon dependency.

**The data layer is deliberately not the reference's.** That app drives
Shopify's Storefront Cart API — `cartCreate`, `cartLinesAdd`, `checkoutUrl` into
Checkout Sheet Kit — against a cart id it persists itself. This app must not.
Its cart has to be the *same* cart the WebView has: the site's own PDP button
adds to it, the site's badge counts it, and the site's checkout consumes it. A
Storefront cart id would be a second, parallel cart, and adding from a product
page would leave this screen showing empty. So it stays on `/cart.js` and
`/cart/change.js`, executed inside the WebView, which is the one shared cart
keyed by the session cookie — the same "one cookie jar" rule as everything else
here. Checkout still ends up in Shopify's hands, just by navigation rather than
by handing over a `checkoutUrl`.

What the reference has and this does not, on purpose:

| Block | Why not |
| --- | --- |
| Free-shipping progress meter | Threshold lives in server config we cannot read |
| Free-gift tiers | Same — spend tiers are not in the app |
| "Frequently bought" upsell rail | Product selection is server-side |
| Membership card | Not a Shopify primitive we can source |
| Coupon entry | The reference turns it off in-app too (`show_apply_coupon: "0"`); codes are entered in Shopify's checkout |
| Shipping cost / method | Deferred, as the reference defers it — checkout quotes it once it knows the address |

A cart screen is the one place where an invented number becomes a wrong promise,
so these are absent rather than approximated. Two things from the reference's
config *are* adopted: the header drops the bag on this screen and shows the
wishlist instead, and totals stay fully visible.

Prices keep their paise. `display_decimals_in_cart_page: false` in the
reference's config reads like a rounding instruction, but its own cart shows
₹351.12 and ₹4375.84 — so the flag does not mean what it sounds like, and
rounding a real ₹351.12 to ₹351 would print a number that is not the charge.
The one figure the app cannot source is the wishlist count on the header's
heart: that lives in Swym, not in Shopify.

Covered by `__tests__/cart.test.tsx`, which renders the screen rather than
grepping it — including that a not-yet-loaded cart waits instead of claiming to
be empty, and that removing a line asks Shopify for quantity zero.

### Prescription medicines

Zigly sells Rx items, and the site asks the customer to either upload a
prescription or accept a free post-order vet consult. **The app does not rebuild
that step. It makes sure the step still happens.**

The mechanism, verified against the live store on 2026-08-22 using
`/products/test-rx-dummy-medicine`:

- the product carries the tag `rx`, and the theme's Add to Bag form posts
  `properties[_requires_prescription] = "true"` with the variant
- the cart renders its prescription block **only when a line carries that
  property** — the same variant added without it reports
  `data-rx-active="false"` and no block appears at all
- picking a file uploads it immediately to Zigly's own uploader, then tags the
  cart with the returned key via `/cart/update.js`, and checkout stays blocked
  for the whole round trip. An order placed before the tag lands loses the file
- the consult path instead fires on order placement, which the theme detects by
  watching the Fastrr checkout overlay from inside the same document

Two things follow, and both were bugs here:

- **The app must post the property.** Its own Add to Bag (the wishlist tile)
  posted only `{id, quantity}`, so an Rx medicine added from the app looked
  ordinary to the cart: no block, no upload, no consult. The `rx` tag is already
  in the `/products/{handle}.js` reply the wishlist reads, so it is carried
  through to `addToCartScript` and posted as the theme posts it.
- **Checkout for an Rx cart goes to `/cart`, not `/checkout`.** The block, the
  gate and the order watcher all live in one document beside the cart; jumping
  straight to `/checkout` left every part of it behind. `/cart` renders the
  block and its gated checkout button, so that is the handoff.

The native cart says a prescription is needed and what the next step offers, and
reports when one is already attached (the `prescription_upload_key` cart
attribute). It draws no control of its own — deliberately. A half-copy of this
flow is a medicine shipped with neither a prescription nor a consult, and unlike
a wrong price that is not something the customer can see and correct.

The file picker this depends on already works: `onShowFileChooser` is
implemented in the WebView library, so gallery and file selection need nothing
from us. Only in-chooser camera capture would want `android.permission.CAMERA`,
which the manifest does not request.

## The wishlist

Native: a two-column grid of saved products, an empty screen, and a wait. The
half-filled screen needs no special case — a grid two tiles long *is* that
screen, and the same grid scrolls once it outgrows the viewport.

**Sourcing it is the hard part, and worth knowing about.** Verified on
2026-08-22: `/pages/swym-wishlist` ships no items. The served HTML carries the
theme's heading and "You haven't saved any products yet."; Swym fills the page in
client-side from its own backend, keyed to a shopper id in page storage. So

- there is **no server-side endpoint** this app can ask what is saved, and
- Swym's own API would mean building on a key lifted out of the storefront —
  the same objection that kept search off SearchTap.

So the page is loaded in a WebView parked off screen, purely so Swym runs, and
the bridge reads the one thing that holds whatever Swym's markup turns out to
be: **the product links inside the wishlist container**, in order. No class name
of Swym's is required, no price is scraped, and no rendered money string is
parsed. Every figure then comes from `/products/{handle}.js` — integer paise,
compare-at price, image, variants — which is the difference between reading the
site and guessing at it: the page says *which* products, Shopify says everything
*about* them.

Two consequences worth stating plainly:

- **The container is preferred, not assumed.** It looks for a Swym element,
  falls back to Dawn's `main` / `#MainContent`, and never reads the whole
  document — the header and footer link to products too, and those are not
  saved. Which root it used is reported in the reply and logged, so one device
  run confirms it.
- **Removing works by pressing Zigly's own control.** There is no endpoint to
  call — the write belongs to Swym and this app holds no Swym credential — but
  the page has the remove control Swym renders next to each saved item, so the
  bridge finds that control and clicks it. The real write, with the site's own
  shopper id. The control is located *outwards from the link to that product*,
  which is what stops it pressing a neighbour's button, and by attribute
  fragment rather than one release of Swym's class names.

  The tile disappears the moment the heart is tapped, because the click happens
  in an off-screen page and waiting for it would make the tap feel broken. Then
  the removal is **verified**: the bridge re-reads the product links and reports
  whether the handle actually left. If it did not, the tile returns to the
  position it held and the screen says why. A removal that silently failed would
  leave the app showing a wishlist that is not the customer's, which is worse
  than saying so.

Add to Bag posts to `/cart/add.js`, the same endpoint the theme's own button
uses, so the line lands in the one shared cart. It is only offered for
single-variant products; with several variants the tile opens the product page
instead, because adding the wrong size is worse than one extra tap.

Covered by `__tests__/wishlist.test.tsx`.

## Search

The header's search bar is a button, not a field. Tapping it opens a native
search screen: recents before you type, suggestions as you type, and the site's
own results page when you commit.

**Suggestions come from Shopify's own predictive search**, not from SearchTap:

```
GET /search/suggest.json?q=&resources[type]=product,query,collection
    &resources[limit]=6&resources[options][unavailable_products]=last
→ resources.results.{products,queries,collections}
```

Same origin, no key, one round trip for all three lists. The request is made
*inside* the WebView (`src/webview/searchBridge.ts`), as the cart is, so it
carries the page's own session and user agent.

**Why not SearchTap.** zigly.com's search really is SearchTap, and it also feeds
the PLP filter and sort controls. Its client config carries a search-only token,
and building on it would mean depending on a credential lifted from Zigly's own
app — rotatable without notice, against a collection id that changes when the
index is rebuilt, on their quota and in their search analytics. It would also
mean reimplementing their ranking, their baseline filter (`isSearchable`,
`discounted_price > 0`, `isActive`), sixteen facets — two of which are duplicate
pairs, `color`/`meta_color` and `meta_flavour`/`st_meta_flavor` — and five sort
orders, then keeping all of it in step with whatever the merchandisers change.

So the app does not own results. Submitting hands off to `/search?q=`, which is
SearchTap-rendered and therefore carries Zigly's real ranking, facets and sort
for free. The native list is a fast path over it, not a second search engine.

Two things this trades away, both deliberate:

- **Facets and sort inside a native results grid.** That needs the SearchTap
  index, and it needs Zigly's own account access — which is required anyway to
  manage the index and its Shopify sync. When that lands, only `searchBridge.ts`
  changes; the screen above it does not.
- **Identical ranking in the suggestion list.** Shopify's predictive index is
  not SearchTap's, so the six suggested products may not be SearchTap's six.
  The "See all results" row is always first for exactly that reason.

Prices on this endpoint are **decimal strings** (`"2807.00"`), unlike the
integer paise everywhere else. They are converted to paise at the boundary —
`src/utils/money.ts` is the one formatter and the one unit. Recents are
session-scoped: eight strings did not justify a storage dependency.

Covered by `__tests__/search.test.ts`.

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
| No header on any page but the dashboard — inner pages covered it, leaving no back arrow | Fixed: header drawn outside the overlay container |
| Spinner floating in the top-right of every page | Removed; replaced by the hairline under the header |
| Every inner page reloaded on Back and on re-entry | Fixed by the keep-alive page stack |
| Search did nothing until enter, and the pre-typing screen was blank | Fixed by the native search screen |
| A backslash inside a template literal is eaten before the page sees it — `/\/products\//` shipped as `//products//` | Watch for it: the removal bridge splits strings instead, and `__tests__/injection-syntax.test.ts` parses every payload |
| Sort/Filter bar emptied itself after a filter change, and never appeared on `/search` | Fixed in sortFilterBar.ts |
| Listing cards showed the compact variant picker, not the reference's full-width Add to Bag | Fixed via `body.zigly-listing` |
| Some homepage sections not visible | Under investigation -- compare against zigly.com in mobile Chrome first; if absent there too it is the site's own mobile design, not an app defect |

## Known gaps (deliberate, scheduled)

| Gap | Phase |
| --- | --- |
| SMS OTP autofill — WebViews get none | 6, needs native SMS Retriever |
| `window.open` disabled, so Shop Pay's popup will not open | 6 |
| In-chooser camera capture for `<input type=file>` (picking an existing file already works) | 6, needs `CAMERA` |
| Geolocation prompt for the site's pincode widget | 6 |
| Cookie flush on background (session persistence) | validate in gate first |
| Native facets and sort on search results | needs Zigly's SearchTap account |
| Wishlist count badge on the header heart | that total lives in Swym, not Shopify |
