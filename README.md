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
a WebView wrapper**, and that most of the mobile UI it presents is drawn by the
website:

| App UI element | Actually rendered by |
| --- | --- |
| PDP *Add to Bag / Buy Now* bar | the site's `.mobile-atc-main` |
| Listing *Sort / Filter* bar | SearchTap's `initial-search-sort` / `-filters` |
| Category circles, coupons, breed rail | real Shopify sections |
| Bottom navigation | the site's own `.fixed-icons` — but see below |

The bottom bar was on that list too, and it is the one entry that turned out not
to hold. Verified on 2026-08-22: the site's `.fixed-icons` carries **four** tabs
— Zigly, Collections, Breed-verse, Wishlist — and **no Account item at all**,
while the reference app shows five. It is also drawn inside the page, so it
vanished behind every native screen this app has. So the bar is now native and
the site's is hidden; see *The bottom navigation* below. Everything else on that
list is still the site's.

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
├── navigation/
│   ├── pageStack.ts            the inner-page stack — see below
│   └── accountStack.ts         the account section's screens — see below
├── search/suggestions.ts       parsing the suggest payload — see below
├── search/placeholders.ts      the typewriter's cycle, as data — see below
├── wishlist/wishlistItems.ts   parsing the wishlist payload — see below
├── account/accountData.ts      parsing the account payloads — see below
├── utils/money.ts              one formatter, one unit (integer paise)
├── webview/webViewConfig.ts    WebView props
├── webview/accountBridge.ts    reading and writing the account in the page
├── webview/loginRestyle.ts     presenting the site's OTP widget as a screen
├── webview/bannerCarousel.ts   keeping the site's banner Swiper unstuck
├── webview/couponStrip.ts      the copy button, and stopping the marquee
├── components/                 NativeHeader, BottomNav, AnnouncementBar,
│                               CartScreen, CartToast, SearchScreen,
│                               WishlistScreen, AccountScreen, OrdersScreen,
│                               AddressScreen, AddressFormScreen, SelectSheet,
│                               EmptyState, LoadingBar, NetworkErrorScreen,
│                               glyphs
└── screens/                    SplashScreen, ZiglyWebViewScreen
```

There is no navigator: React Navigation would want to mount and unmount
screens, which is exactly what `pageStack` exists to avoid.

## Screen structure

The announcement bar, the native header and the bottom navigation are drawn
**outside** the container that holds everything else, and every overlay — page
layers, cart, the account section, offline screen — is positioned inside it. That is load-bearing rather than tidy: the
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

## The wishlist

Native: a two-column grid of saved products, an empty screen, and a wait. The
half-filled screen needs no special case — a grid two tiles long *is* that
screen, and the same grid scrolls once it outgrows the viewport.

**Swym is gone from this store, and that is the whole story of this screen.**
Verified on 2026-08-22 across the dashboard, a product page and
`/pages/swym-wishlist`: there is no Swym snippet anywhere, and none of the four
app embeds the pages load is Swym's — they are Judge.me, Selleasy, PageFly and
SimplyOTP. The theme still carries Swym's markup (the `swym-add-to-wishlist`
buttons, `#swym-wishlist-render-container`, a `window.SwymCallbacks` array
nothing ever drains), which is what made it look like Swym was still in play.

What implements the wishlist is Zigly's own `assets/wishlist.js`, loaded on
every page. It is short and unambiguous:

```
STORAGE_KEY     = 'zigly_wishlist_handles'   // comma-separated, localStorage
BUTTON_SELECTOR = '.swym-button.swym-add-to-wishlist[data-product-handle]'
document.addEventListener('click', handleClick)   // one delegated listener
window.ziglyWishlist = { getWishlist, syncAllButtons }
```

and, for a signed-in customer, every toggle is mirrored to Zigly's own wishlist
API, with the local list merged into the server's on first load after login.

So the wishlist is a list of product handles in the page's own localStorage,
with a public reader and a delegated click handler. That makes this screen much
simpler than it was:

- **The read is instant.** There used to be a WebView parked off screen on
  `/pages/swym-wishlist` — an ~850 KB page — mounted on every open purely so
  that Swym would render something, then polled for up to twelve seconds. It was
  waiting for markup that was never coming. The read is now a question put to the
  dashboard WebView, which is already loaded: one storage read, then one
  `/products/{handle}.js` per saved product. No page load and no polling.
- **The read is exact.** Scraping links out of a container meant guessing which
  were saved products and which were the theme's own; the reply even carried a
  `root` field so a device run could confirm which container it had guessed at.
  There is nothing left to guess.

Every figure still comes from `/products/{handle}.js` — integer paise,
compare-at price, image, variants. That is unchanged and is the point: their
storage says *which* products, Shopify says everything *about* them. No price is
scraped and no rendered money string is parsed.

**Removing presses their control rather than writing their storage.** Their one
delegated listener does more than toggle the list: it re-syncs every button on
the page, updates the header counters, publishes the theme's own
`wishlistUpdate` event, and posts the change to Zigly's API for a signed-in
customer. Writing the storage key directly would do the first of those and skip
the rest, leaving the customer's wishlist right on this device and wrong
everywhere else. So the bridge dispatches a click at a button carrying that
handle — a real one when the page is showing it, otherwise one created with the
single attribute their selector requires, appended, clicked and removed. It has
to be in the document for the event to reach `document`.

The tile disappears the moment the heart is tapped, because the press is quick
but not instant and waiting for it would make the tap feel broken. Then the
removal is **verified**: the list is re-read and the reply says whether the
handle actually left. If it did not, the tile returns to the position it held and
the screen says why. A removal that silently failed would leave the app showing a
wishlist that is not the customer's, which is worse than saying so.

**One thing the site gets wrong and the app fixes.** Their `wishlist.js` marks a
saved button with `.is-wishlisted` and `aria-pressed="true"`, and the theme ships
no rule for either — not in the section styles, not in `base.css`, not in
`product-card.css`. So a saved product's heart looked exactly like an unsaved
one, and the only way to find out whether a tap had registered was to open this
screen. The injected stylesheet supplies the missing rule and nothing else: their
state, their class, their path, and a fill in their own accent red.

Add to Bag posts to `/cart/add.js`, the same endpoint the theme's own button
uses, so the line lands in the one shared cart. It is only offered for
single-variant products; with several variants the tile opens the product page
instead, because adding the wrong size is worse than one extra tap.

Covered by `__tests__/wishlist.test.tsx`.

## The bottom navigation

Native, five tabs — Zigly, Collection, Breed-verse, Wishlist, Account — drawn
outside `body` exactly as the header is, and the site's own `.fixed-icons` is
hidden by injected CSS.

This reverses an earlier decision, so the reasoning is worth keeping. The app
deliberately had no tab bar: the reference app's is the *website's*, fixed below
990px, so a native one would have stacked a second bar on top of it. Two facts
about the live site retired that, both verified on 2026-08-22:

- the site's bar carries **four** tabs and **no Account item at all**, where the
  reference app carries five. There was nothing there to restyle into an Account
  tab;
- it is drawn inside the page, so it disappeared behind every native screen this
  app has — the cart, the wishlist, and now the whole account section. A tab bar
  that is missing exactly where the user is is not a tab bar.

Hidden, never removed: the theme's own scripts mark the active tab in that
element on navigation, and an element a script cannot find is how a script starts
throwing on every page.

The destinations are still the site's own urls, so what the tabs point at stays
Zigly's decision. Only Wishlist and Account open native screens, because both
already exist natively here. Tapping a tab is a reset to that tab's root: any
native screen closes and the page stack is dismissed.

The bar stands down in four places — the search screen (keyboard-first), Shopify
checkout (not this app's screen, and not somewhere to offer five ways out),
listing pages (the injected Sort / Filter bar already pins itself there, and the
reference app shows that bar *instead of* the tabs — `showsSortFilterBar` in
`urlUtils.ts` mirrors that script's own path test), and the login screen.

## The account section

Native: an account screen, orders, addresses, an address form, and a login
screen. The brief was that logging in must not hand the user to the website, and
that is exactly what `/account` did before — it is a Shopify page, so it opened
as one.

**Where the data comes from.** zigly.com runs Shopify's *classic* customer
accounts (`/account` 302s to `/account/login`, not to `shopify.com`), so the
account pages are ordinary storefront pages on the canonical origin. Every read
is executed *inside* the dashboard WebView, like the cart and the search
suggestions, so it carries the one session the customer signed into — the "one
cookie jar" rule again. §5a of [DATA-SOURCES.md](DATA-SOURCES.md) has every
endpoint and payload.

- **Signed in?** is the *redirect*: `/account?sections=main-account` bounces to
  the login page when there is no session. Not a guess at a cookie.
- **Addresses are read as forms, not as text.** Dawn renders an edit form per
  saved address, so they come back under the field names Shopify accepts on the
  way in, and Edit round-trips through the site's own names. Writes are its
  documented `customer_address` form post, with `_method` for update and
  delete, and each one is **verified** by re-reading the list — Shopify answers a
  rejected address with the form again rather than an error, so "the POST
  returned 200" means nothing on its own.
- **Countries and states come from `/services/countries.js`**, the shop's own
  dataset. That is also where the *labels* come from: India calls the subdivision
  a State and the postcode a PIN code, and a country Shopify records no
  subdivisions for gets no State field at all.

**Login is the site's own OTP widget, restyled.** It is SimplyOTP (Lucent
Commerce), and its live config has `recaptcha_enabled: true` and
`fraud_detection: true` — so the request-OTP call cannot be made from native
code, because a reCAPTCHA token only exists inside a real page. A native form
would mean building on a credential lifted out of Zigly's storefront, which is
the objection that kept search off SearchTap and the wishlist off Swym's API, and
a worse one here: this is the flow that creates the session everything else
reads. So `loginRestyle.ts` moves the widget's own popup to the body, hides the
rest of the page, and restyles the phone row, the button and the OTP boxes into
the app's shapes. Not one listener is replaced and not one click is synthesised.
Two things it will not do: hide the consent notice, which is a legal one with
links to Zigly's policies, and offer the theme's email-and-password form, which
is the web experience this screen replaces.

Success is Shopify's own signal — arriving at any Zigly page that is *not* the
login form means the session exists — and the auth state flips at that moment
rather than after a probe, because what the login WebView is showing right then is
the website's account page. Navigation inside that one WebView is deliberately
looser than everywhere else: any https destination renders, so an OTP provider's
own host cannot bounce the customer into Chrome mid-login. That is the same
relaxation checkout already gets, for the same reason.

**What the reference app has here and this does not**, and why — the account
screen is the one place where the site is thinner than the app that fronts it:

| Missing | Why |
| --- | --- |
| Email and phone on the profile | Dawn's account section renders neither, and classic accounts have no customer JSON endpoint. The app shows an email- or phone-shaped string *if* the theme prints one, and leaves the line out if not |
| Edit Profile | No storefront endpoint changes a customer's name, email or phone. The only place they are editable is inside SimplyOTP's login flow |
| Change Password | Classic Shopify has no change-password page for a signed-in customer, only `POST /account/recover`, which emails a reset link — and an OTP-first store's customers mostly have no password for that link to change |
| Delete Account | No storefront endpoint deletes a customer. The button explains that and opens Zigly's contact page, in the app |
| Wishlist count on the header heart | That total lives in Swym, as it always did |

A profile line that is missing is left blank rather than filled in, which is the
same rule the cart follows about invented numbers.

**Screen order matters.** The section is drawn *below* the page layers: an order,
or a product opened from Favorites, is a real page and has to come down over the
screen it was opened from, so Back returns there instead of to the dashboard.
Back therefore walks page layers first, then the section, then the dashboard's
own history. Covered by `__tests__/account.test.tsx` — the parsers, the stack
rules, every screen's empty and waiting states, and a parse check on each
injected script.

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

### The bar types its own prompt

The site's search box does not sit still, and the way it moves is not a fade or
a swap — it is a typewriter. SearchTap runs this (`dynamicPlaceholder`, read out
of the live bundle on 2026-08-22):

```
placeholder = ''
phrases = ['Search For Dry Food',
           'Search For Oral & Dental Care',
           'Search For Grooming Tools']
type  100ms/char → hold 1000ms → erase 50ms/char → pause 1000ms → next, wrapping
```

The header types and erases at exactly those speeds. Nothing is smoothed or
rounded: a prompt moving at a speed the website does not use is a prompt that
came from somewhere else.

It drops one thing deliberately — **the site's closing pause**. The next phrase
starts the moment the last character comes off, so the bar is never empty for
longer than a single keystroke. That is also why there is **no resting label**:
the bar shows only the phrase being typed, never a static "Search For", because
there is no gap long enough to need one.

**The phrases are read, not written down.** SearchTap keeps its list inside a
minified bundle, so there is nothing to lift out of the DOM up front — but the
*animation* is in the DOM, one letter at a time, on an input this app keeps
rendered (`visibility: hidden`, never `display: none`, which is why the site's
own scripts keep running). `REPORT_SEARCH_PLACEHOLDERS` puts a MutationObserver
on that one attribute, treats the longest value seen before the first shrink as
a finished phrase, and posts it over. It also times the gaps between letters, so
the app types at the site's measured cadence rather than at one we chose.

There are seeds, because the reader cannot be instant — the site takes about
four seconds per phrase, and a cold header would be blank through the first
thing the customer looks at. They are Zigly's copy, three of them verbatim from
the bundle above. Anything the reader brings back is folded in after them.

Two things worth knowing:

- **The cycle is data, not timers.** `src/search/placeholders.ts` is a pure
  function from one frame to the next, so the part that can be wrong is testable
  without a clock.
- **It stops when it cannot be seen.** The band collapses on scroll, and the
  animation stops with it. The prompt is also its own memoised component, so a
  letter re-renders one `<Text>` rather than the whole header ten times a
  second.

Covered by `__tests__/placeholders.test.ts` and `__tests__/header.test.tsx`.

## Carousels

Every rail on the dashboard is one of two kinds, and the difference matters.

**Transplanted sections have no Swiper**, because this app deliberately does not
run their scripts — those scripts also start looping carousels that clone
slides. Their rails are laid out as native horizontal scrollers in CSS instead:
same gesture, finite list, no library callback to trigger.

**The banner is the site's own live Swiper**, and `src/webview/bannerCarousel.ts`
repairs its configuration through Swiper's public API rather than rebuilding it.
Three findings, all read off the live section (Swiper 11.2.4):

| Read on the site | Consequence | What the app does |
| --- | --- | --- |
| `loop: true` is nested inside `autoplay`, where Swiper never reads it | the last banner is a dead end — swipe to it and nothing moves. This is the "banner stuck" report | rebuilds the instance in real loop mode, from the parameters the theme itself passed |
| nothing ever restarts autoplay | a carousel stopped by throttled timers or an interrupted transition stays stopped | re-arms whenever the section comes back into view, and stops it while it is out of view |

**Why a rebuild rather than an assignment.** `loop` cannot be switched on after
the fact: Swiper consults it while it builds the track and works out its snap
grid, so a live instance that was built without it never rearranges. The
supported route is a new instance, and the parameters to build it from are the
ones the theme itself passed — Swiper keeps them on `passedParams`, so nothing
about the carousel is guessed at here. Only `loop` is added.

The ordering is deliberate, because a failure here is expensive: the constructor
is looked up and the parameters copied *before* anything is destroyed, and a
rebuild that throws puts an instance back with the originals. A banner with no
instance and cleaned styles is a static stack of slides, which is worse than one
that does not loop.

`rewind` was the first attempt and is kept only as that fallback. It is not the
same thing — it animates *backwards* through every slide to get from the last to
the first, which is a scrub rather than a step, and it does not carry a manual
drag off the end at all. That is why the explicit `touchEnd` wrap exists, and why
it is bound only when loop could not be established: loop mode carries both ends
by itself.

And because reading a configuration cannot prove a carousel is moving, there is
a watchdog: a visible banner that has not changed slide within twice its own
delay gets nudged. That is what makes this hold whatever the real cause turns
out to be on a device.

It runs on **every** page, not just the dashboard — the pet pages, the collection
list and the lifestyle pages all carry a banner. A section with no instance is
left alone, which is exactly how the transplanted ones are told apart.

One thing that looks like a defect and is not, recorded so it does not get
"fixed" later: the theme passes the document-wide `'.swiper-pagination'` as
`pagination.el`, and this app puts a dozen more of those on the page. Swiper
handles it — `uniqueNavElements` defaults to true and narrows a multi-match
string selector to nodes inside the instance's own element.

## The coupon strip

Two defects, one cause. The strip is transplanted, so its script is dropped —
and that script holds a function its own markup calls from an inline handler:

```
<div class="secondary_Svg" onclick="copyCodeCoupon(this,'INR 50 off ...')">
```

With the script gone, tapping the copy button did nothing at all.
`src/webview/couponStrip.ts` re-supplies `copyCodeCoupon` under the same name,
with the same arguments and the same `show_copy_message` feedback — and only if
the page has not defined its own, so on a page that renders the section itself
Zigly's version still wins. The Clipboard API is tried first, as the site does,
with `execCommand` behind it because an Android WebView can refuse the former.

The auto-scroll was not JavaScript either — the theme's own drag handler is
commented out, and the movement is a CSS marquee (`animation: scroll 30s linear
infinite`, `translateX(-50%)`). It is stopped in CSS and the container becomes a
native scroller, so the strip moves under the thumb and nowhere else. That also
retires an infinite compositor animation that ran for the whole life of the
dashboard.

`translateX(-50%)` is the marquee's tell: the theme emits every coupon twice so
the loop has somewhere to wrap to. Scrolled by hand that reads as the list
repeating, so the second copy of each is removed — keyed on the coupon's own
text, so nothing unique is ever dropped.

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
- [x] Bottom tab bar visible and navigating — was the site's `.fixed-icons`,
      now native with five tabs (see *The bottom navigation*); **the native bar
      and the account section are the one part of this app never yet run on a
      device**
- [x] Search, cart, product navigation -- reported working
- [x] OTP login completes (no SMS autofill in a WebView; code typed manually)
- [ ] OTP login completes *through the restyled widget*, and lands on the native
      account screen rather than the website's  <-- verify first, with a real
      account: everything signed-in is untestable without one
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
| Listing cards showed the compact variant picker, not the reference's full-width Add to Bag | Fixed via `body.zigly-listing` — but see the row below; the first attempt did nothing |
| Cards had *no* add control at all on a phone: the variant picker hidden by us, Add to Bag hidden by the theme | Fixed. Two mobile rules hid its container — `base.css`'s `.small-hide` and `product-card.css`'s `.product-card-wrapper .quick-add`. `display:block` on the button could never bring back a parent that is `display:none`, so the earlier fix was a no-op. The container is un-hidden and the floating "+ Add" chip hidden in its place |
| The banner could not be swiped past its last slide | Fixed — see *Carousels*. The theme nests `loop` inside `autoplay`, where Swiper ignores it |
| The coupon strip scrolled itself, and its copy button did nothing | Fixed — see *The coupon strip* |
| Category circles never became the reference's set | Fixed. `homeLayout` called `window.__ziglyFetchSection` and `pageCache` — which defines it — was concatenated *after* it, so the call threw on every load into that module's own `catch`. The fetcher now installs first |
| "Everything For" never appeared | Fixed. It checked `[id*="everything"]` to see whether the site already rendered the section, and matched our own reserved slot `zigly-x-everything`, so it disabled itself every time. The check now ignores `zigly-` ids |
| Explore tiles opened empty listings | Fixed. Merged tiles had their link rewritten to a collection handle guessed from the label, guarded by a HEAD request — which passes for a published-but-empty collection. Five of sixteen tiles led to zero products. Tiles now keep the link Zigly gave them |
| Brand cards showed two brands stacked per column | Fixed. The section's Swiper is initialised with `grid: { rows: 2 }`; the rail is laid out as a single-row native scroller instead |
| Bestsellers was the homepage's "Trending Products" | Fixed — the rail in that slot is the pet page's `collection_product_section`, transplanted like every other section, under Zigly's own heading |
| Logging in left the app: the Account tab, and every `/account` link, opened Shopify's own account page | Fixed — native account section, and account urls are taken over before they navigate |
| No Account item in the bottom navigation | Fixed — the site's bar has none to restyle, so the bar is native and carries five tabs |
| Some homepage sections not visible | Largely resolved by the four rows above; each had its own cause, none of them the site's mobile design. What remains is that the reference app's closing "From Our Instagram" has no counterpart on zigly.com — see below |
| The reference's "From Our Instagram" | No section on zigly.com is called that, and none pulls a feed; the site's only Instagram presence is the footer's social links. Its own photo grid, `gallery` on `/pages/store-home-page-section` ("Happy Moments"), is used instead, under its own heading. Retitling it would tell the customer these photos came from a feed they can follow, and that is not where they came from |

## Known gaps (deliberate, scheduled)

| Gap | Phase |
| --- | --- |
| SMS OTP autofill — WebViews get none | 6, needs native SMS Retriever |
| `window.open` disabled, so Shop Pay's popup will not open | 6 |
| File chooser for `<input type=file>` | 6 |
| Geolocation prompt for the site's pincode widget | 6 |
| Cookie flush on background (session persistence) | validate in gate first |
| Native facets and sort on search results | needs Zigly's SearchTap account |
| Wishlist count badge on the header heart | no longer blocked. The reason recorded here was that the total lived in Swym; it lives in the page's own localStorage, and the bridge already reads it. Not built yet, but it is now a small piece of work rather than an impossible one |
| Email and phone on the account profile | the theme does not render them and classic accounts expose no customer JSON; needs Zigly's own API |
| Edit Profile, Change Password, Delete Account | no storefront endpoint for any of the three — see *The account section* |
