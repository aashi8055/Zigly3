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
| Listing *sort and filter* | SearchTap — the engine, not the UI; see below |
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
├── listing/facets.ts           sort and filter, as the app sees them — see below
├── wishlist/wishlistItems.ts   parsing the wishlist payload — see below
├── account/accountData.ts      parsing the account payloads — see below
├── utils/money.ts              one formatter, one unit (integer paise)
├── webview/webViewConfig.ts    WebView props
├── webview/accountBridge.ts    reading and writing the account in the page
├── webview/loginRestyle.ts     presenting the site's OTP widget as a screen
├── webview/bannerCarousel.ts   keeping the site's banner Swiper unstuck
├── webview/brandRail.ts        standing the brand Swiper down, so the
│                               rail scrolls by thumb — see below
├── webview/bestsellers.ts      the Bestsellers rail, from the store's own
│                               best-selling sort — see below
├── webview/couponStrip.ts      the copy button, and stopping the marquee
├── webview/facetBridge.ts      reading and driving SearchTap — see below
├── webview/listingPage.ts      flagging a listing page for the listing CSS
├── components/                 NativeHeader, BottomNav, AnnouncementBar,
│                               CartScreen, CartToast, SearchScreen,
│                               WishlistScreen, AccountScreen, OrdersScreen,
│                               AddressScreen, AddressFormScreen, SelectSheet,
│                               SortFilterBar, SortSheet, FilterSheet,
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
listing pages (the Sort / Filter bar takes this slot there, and the reference app
shows that bar *instead of* the tabs — `showsSortFilterBar` in `urlUtils.ts`
mirrors the same path test the injected scripts make), and the login screen.

## Sort and filter

Native, and driven by the site. Three pieces:

| Piece | What it is |
| --- | --- |
| `components/SortFilterBar` | the two halves at the foot of a listing, in the tab bar's own slot |
| `components/SortSheet` | the five sorts, as a sheet over a dimmed screen |
| `components/FilterSheet` | every facet as chips, full screen, over one *Apply* |
| `webview/facetBridge` | reads SearchTap's state out of the page and clicks its controls |
| `listing/facets` | the shape they exchange, and the optimistic updates |

**The engine is never reimplemented.** zigly.com runs SearchTap (a Vue 3 app with
a Pinia store, mounted over the theme's collection and search templates), and
every heading, value, count and result on this screen is SearchTap's answer. The
bridge reads them out of the rendered DOM — `.st-widget` for a facet,
`.st-widget-title` for its heading, the hidden `input[type=checkbox]` for a
value, `.st-product-number` for its count, `.st-sorting-wrapper button[value]`
for a sort — and applies a change by **clicking** the same control a tap on the
website clicks. Not by writing to their store: a click is their own code path,
so it gets their state update, their request and their analytics event, and it
survives them rebuilding the components.

**The site's own chrome is hidden, never removed** (`injectedStyles.ts`). Its
pills, its left-sliding drawer and its sort panel are all `display: none` on a
listing page — while staying in the document, because they are what the app
clicks. Removing them would break the app's own controls and start SearchTap
throwing on every change.

**Facets are asked for before the sheet opens.** A collection page ships the
theme's server-rendered grid and SearchTap fetches no facets until something
opens Filter — so the bridge clicks the site's own (hidden) Filter pill once per
page, while the app's cover is still up, and closes the drawer that opens through
its own *Apply*. By the time the customer taps Filter the chips are already
there.

**A chip applies on the tap**, exactly as the site's own filter does, so *Apply*
only closes the screen. There is no *Clear All*: a chip that is on turns off when
it is tapped again. Facets with no counted values — SearchTap's price slider, its
lone out-of-stock toggle — never reach the sheet, by what they are rather than by
a list of names.

Two facets on this store are both called **Flavor** (`meta_flavour` and
`st_meta_flavor`) and both offer *chicken*. A chip is therefore addressed by its
facet's **position**, guarded by the heading; position alone would be fragile,
since SearchTap re-renders these on every change, and the heading alone is
ambiguous. `__tests__/facetBridge.test.ts` runs the real script against a
stand-in for that markup rather than only reading it.

### Where the bar appears

`LISTING_PATHS` in `appConstants.ts`, and nowhere else. The app reads it through
`showsSortFilterBar`; the injected scripts are **compiled** against the same
list (`LISTING_TEST_JS` in `listingPage.ts`), so the page and the app cannot
disagree — they used to hold three hand-copied path tests kept in step by a
comment. A market prefix (`/en-in/collections/…`) is stripped on both sides:
zigly.com publishes no market today, and one added in the admin would otherwise
retire the bar silently, on every listing at once.

The list is two entries because the engine exists on two templates. Checked
against the live site on 2026-08-23, by fetching each surface the app can reach
and looking for SearchTap's own markup:

| Surface | Engine | So |
| --- | --- | --- |
| `/collections/{handle}` — including tag, vendor and `/all` listings | yes | bar |
| `/search` | yes (rendered at runtime) | bar |
| `/collections` — the list of collection cards | no | no products to sort |
| `/pages/pet-breeds` | no | — |
| `/pages/dog` and the other breed landing pages | no | 200-odd product cards, but all inside carousels and themed rails. No grid, and nothing the site can sort |

A bar on a rail-based page would need a *second* engine, filtering client-side
over whatever happened to be on the page — which is the one thing this design
refuses to do, because it would drift from the website within a week.

### After a filter: SearchTap's own grid

Applying anything makes SearchTap empty `.searchtap-temp` and render the results
itself, so the customer gets a different card component for the same products.
`injectedStyles.ts` closes that join, and it is mostly not new rules — SearchTap's
card carries the theme's own class names on the parts that matter
(`product-card-wrapper card-wrapper`, `quick-add__submit button--secondary`,
`atc-wrapper`, `mobile-compact-variant-display`), so the listing-card block
already reaches it. What is left is the four things it draws differently: a
bordered, rounded, padded card; the rating as a floating chip over the image
rather than in the flow under it; a row of size chips; and price and Add to Bag
side by side rather than stacked.

Two things were on that list and came off it after the theme's own card was read
back: the **brand line** (`product--brand--wrapper`, with the same veg/non-veg
mark) and the **bold title** (`fw-700`) are on both cards already. "Matching"
them would have been this block introducing the difference it exists to remove.

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

**The OTP step is drawn from the reference app's own screenshot** (2026-08-25):
the block sits low on the screen, the six boxes are near-square and come to 70%
of the width, and Submit is a small mid-grey pill with white type rather than the
pale chip with grey type it used to be. Those numbers are proportions read off a
rescaled screenshot and converted at the phone's own width, so they are accurate
to about a pixel rather than to Zigly's stylesheet; a screenshot at a known
device width is what would settle the last of it. The step's top offset sits on
`.verify-box`, not on the shared `.ol`, because only this step has been measured.

The signup step — the one a phone number new to the shop reaches after the OTP —
asks for First Name, Last Name and the number it just verified. **It does not ask
for an email.** The account is created against the phone number, which is what
the OTP proved, and SimplyOTP's own config already carries `email_enable: false`.
The field is hidden rather than removed and is never filled in; `SIGNUP_EMAIL` in
`loginRestyle.ts` is the one flag that brings it back, and it says there what
would make that necessary.

Success is Shopify's own signal — arriving at any Zigly page that is *not* the
login form means the session exists — and the auth state flips at that moment
rather than after a probe, because what the login WebView is showing right then is
the website's account page. A completed login then **closes the account section
and leaves the customer on the dashboard**: signing in is the end of what they
came to the tab for. A `signedIn` answer that arrives from a *probe* instead
still swaps login for the account screen — that customer never asked to log in,
and must not be thrown to the dashboard for tapping Account. Navigation inside that one WebView is deliberately
looser than everywhere else: any https destination renders, so an OTP provider's
own host cannot bounce the customer into Chrome mid-login. That is the same
relaxation checkout already gets, for the same reason.

**What the reference app has here and this does not**, and why — the account
screen is the one place where the site is thinner than the app that fronts it:

| Missing | Why |
| --- | --- |
| Email and phone on the profile | Dawn's account section renders neither, and classic accounts have no customer JSON endpoint. The app shows an email- or phone-shaped string *if* the theme prints one, and leaves the line out if not |
| Change Password | Classic Shopify has no change-password page for a signed-in customer, only `POST /account/recover`, which emails a reset link — and an OTP-first store's customers mostly have no password for that link to change. The row is deliberately not drawn |
| Wishlist count on the header heart | That total lives in Swym, as it always did |

A profile line that is missing is left blank rather than filled in, which is the
same rule the cart follows about invented numbers.

**Two things here do not do what they appear to do.** Both were asked for
explicitly, to match Zigly's own app while there is no endpoint behind either,
and both are written down at the top of the code that implements them.

- **Edit Profile** opens a real form — First Name, Last Name, Email — and Save
  keeps a **device-local overlay** over what the site rendered. Shopify's
  storefront can write addresses and nothing else about a customer, so the edit
  never reaches Zigly: not the website, not their orders, not their invoices.
  The form says that on screen rather than leaving it to be discovered. It is
  held in memory for the session, because persisting a value that is already not
  the real one would be buying permanence for a fiction. Phone is shown but not
  editable — it comes from the OTP login, which makes it the one authoritative
  field on the screen. The overlay is composed once in ZiglyWebViewScreen, so
  the account screen and the drawer's account block cannot drift apart.

- **Delete Account** signs the customer out and tells them their account was
  deleted. **Nothing is deleted.** No storefront endpoint deletes a Shopify
  customer, so the record, the orders and the addresses are all still there and
  signing in again brings them back. It confirms first and still offers the
  contact form, which is the only route that actually removes an account. This
  is the one screen in the app that tells a customer something untrue about
  their own data; it should not reach a real customer without a delete endpoint
  behind it.

When either endpoint exists, one function changes in each case — saveProfile
and requestAccountDeletion — and the on-screen notices come off with them.

**Both ways out say so, and both end on the dashboard.** Log Out and Delete
Account make the same request — the site's own `/account/logout`, fetched inside
the WebView so the one shared cookie jar is what gets cleared — and the screen
does not change until the site answers, because an account screen that claims
"signed out" over a website that is still signed in is the worse outcome. What
covers that round trip is a toast, put up on the tap: *Logging out…* for one and
*Deleted user data* for the other. When the site confirms, the section closes and
the customer lands on the dashboard. A session that merely **expired** still
collapses the section to the login screen instead — that customer was in the
middle of something and login is the way back to it; `signOutReason` is what
tells the two apart. A sign-out that fails moves nobody: the toast comes down and
the account screen says it did not go through.

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

## The brand rail

Top Pet Brands is the one rail on the dashboard whose Swiper is **alive**, and
that is the whole story of why it would not scroll.

Every other rail here is transplanted — `extraSections.ts` fetches the section's
markup and strips its `<script>` tags, so `el.swiper` is undefined and the
injected CSS is free to lay the track out as a native horizontal scroller. The
brand section is different: it is already on the homepage, so it is **moved**
into the reference order rather than copied, and moving a node does not touch
the Swiper instance attached to it.

Read off the live section on 2026-08-23 (Swiper 11.2.4), the mobile breakpoint
runs `slidesPerView: 'auto'`, `grid: { rows: 2, fill: 'row' }`, `speed: 1000`
and `autoplay: { delay: 2500, disableOnInteraction: false }`. Two consequences,
and both are felt as *the brands don't scroll properly*:

- **Swiper owned the gesture.** It binds its own touch handlers on the
  container, sets `touch-action: pan-y` there via its `swiper-horizontal` class
  — which tells the browser to ignore horizontal pans outright — and answers a
  drag by writing a `transform` on the wrapper. The stylesheet pins that
  wrapper to `transform: none !important`, so Swiper computed a translate on
  every frame of the drag and **none of it ever landed**. The finger moved and
  the rail did not follow; the little movement there was came from whatever part
  of the gesture leaked past Swiper's handler into the real scroller.
- **Autoplay never stopped.** `disableOnInteraction: false` means touching the
  rail does not even pause it, so a timer called `slideNext()` every 2.5s for as
  long as the dashboard was open, tugging at a rail the customer was reading.

`src/webview/brandRail.ts` destroys the instance rather than reconfiguring it.
Reconfiguring would put Swiper's drag physics on the one rail whose every
neighbour on the dashboard uses the platform's, so the gesture would still be
the odd one out. Destroyed, the scroller the CSS already describes is simply
left to work, with the browser's own momentum and rubber-band.

Three details that are load-bearing:

- `destroy(true, true)` — the second argument. Swiper's grid module positions
  the second row with an inline `margin-top` on those slides, and its drag
  writes an inline `transform` on the wrapper. Cleaning styles removes both at
  the source instead of leaving the stylesheet to out-`!important` them. The
  overrides stay anyway, because they also cover the window between first paint
  and this running.
- **It cannot be a one-shot.** The section's own tab handler runs
  `currentSwiper.destroy(true, true)` and then initialises a *fresh* Swiper on
  the newly active tab, on every Popular / Emerging click. Destroying once at
  load would last exactly until the first tab tap. So the sweep runs again after
  a click inside the section — the listener is on `document`, which in the
  bubble phase is reached after the theme's own listener on the `<li>` has
  already made the replacement.
- **The dots are hidden only on a section actually released.** They are
  Swiper's control and dead once it is gone, so `data-zigly-brand-native` is
  written by the script and read by the CSS. If a release ever fails they stay
  visible, because then they are the only way to move the rail.

Nothing here touches a card, an image, a link, or the order of the brands. The
tabs keep working: that handler toggles a class, and the class is what the
stylesheet reads.

### One trap this cost a build on

`MOBILE_CSS` is a single template literal, so **a backtick anywhere in it ends
the string**. Two comments written with backticks around identifier names turned
the whole stylesheet into a parse error — and a stylesheet that does not parse
is a page that looks completely untouched, with nothing in the log. The file's
comments use plain prose for that reason, and `__tests__/brandRail.test.ts`
asserts `MOBILE_CSS` contains no backtick at all. This is the same class of
failure as the eaten-backslash one above, from the same cause.

## Bestsellers

Twelve real product cards, read from `/collections/all?sort_by=best-selling`.

**Why the heading is defensible now and was not before.** This slot has had
three occupants. It began as the homepage's second arrival section, relocated
here on the belief that it held these products — it does not; read 2026-08-22,
the homepage's two arrival sections are "Best Deals" (4 cards) and "Trending
Products" (3 cards), and neither is the rail the reference shows in this
position. It then held the pet page's `collection_product_section`, which Zigly
title **"Pet Parent Favourites"**, transplanted whole and deliberately kept
under that heading: calling somebody else's curated rail "Bestsellers" would
have been this app making a sales claim about Zigly's products on Zigly's
behalf.

That reasoning was right, and it is not being reversed — it was an objection to
*relabelling*, and nothing is relabelled here. The products come from Zigly's own
best-selling sort, so "Bestsellers" describes how the store ordered the list
rather than being a claim this app added to it. Verified 2026-08-24 that the sort
genuinely reorders: unsorted, `/collections/all` opens on Acana alphabetically;
sorted, it opens on Applod and Royal Canin.

**Store-wide on purpose.** Dog and cat products are mixed, in whatever order
they actually sell — the only reading under which the heading is true of the
whole store. Splitting it evenly between the two pets was considered and
rejected: that is a curated mix wearing a bestseller label, which is the same
problem again.

**Real cards, moved not rebuilt.** Each keeps its own `<product-form>`, so Add to
Bag still posts to Shopify, and each keeps its real product link; the custom
element upgrades itself on insertion, which is why the buttons stay live.
Rebuilding cards from a JSON endpoint would be far lighter and would break
exactly that.

**One section, not the page.** The whole collection page is ~1.4 MB; the product
grid alone, through Shopify's Section Rendering API, is ~585 KB for the same 22
cards in the same order. The query string survives into the section render, so
the sort survives with it. The whole page remains the fallback, because a
theme-generated section id changes without notice — and the id here *cannot* be
discovered the way `pageCache` discovers the others: on a collection page
"product-grid" appears in the section's id, in a bare `<ul id="product-grid">`,
and in four ids on every single card, so a `[id*=…]` lookup would be resolving by
document order and hoping. Hence a known id plus a fallback that cannot go stale.

Two smaller decisions worth not re-litigating:

- The fetched markup is parsed with `DOMParser`, not by assigning `innerHTML` to
  a detached div. A parsed document is inert — no scripts, no image requests —
  and this markup carries 22 products' worth of photographs, so a div would have
  the page fetch every one of them just to throw ten away.
- The rail lives inside the reserved `zigly-x-bestsellers` slot, which is not
  cosmetic: every card fix the transplanted sections already carry is scoped to
  `[id^="zigly-x-"]` — the sticky-ATC containment, Add to Bag un-hidden and
  shaped, the compact variant picker hidden, and `position: relative` on
  `.quick-add__submit` (without which the button's absolutely positioned
  `::before`/`::after` cover the whole card and swallow every tap into
  add-to-cart). Verified 2026-08-24 that all of those class names are present on
  the collection grid's cards, 22 of each, so the rail needs no new card CSS at
  all — only its own heading and scroller.

If the rail ends up empty, it removes itself rather than leaving a heading over
nothing; the dashboard simply ends that block and nothing below it moves.

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
- [ ] OTP login completes *through the restyled widget*, and lands on the app's
      dashboard rather than on the website's account page  <-- verify first, with
      a real account: everything signed-in is untestable without one
- [ ] A phone number the shop has never seen reaches the signup step, and that
      step's **Email field is not shown** -- and SimplyOTP still creates the
      account without it. See `SIGNUP_EMAIL`: if it turns out to be required,
      that one flag brings the field back
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
| Sort/Filter bar emptied itself after a filter change, and never appeared on `/search` | Superseded: the bar and both panels are native now, and the site's controls are hidden rather than moved. See *Sort and filter* |
| Sort and Filter opened SearchTap's own panels — a sheet of the site's design, and a drawer that slid in from the left | Fixed: both are the app's own, over the header as the reference shows. The engine is still SearchTap's, through `facetBridge` |
| A filtered listing showed a different product card from an unfiltered one — SearchTap renders its own grid once anything is applied | Fixed. See *After a filter* |
| Three hand-copied listing-path tests — the app's, the flag script's and the bridge's — kept in step by a comment asking the next person to | Fixed: one `LISTING_PATHS`, compiled into the scripts |
| The page cover came off *before* the page reported itself ready — `PAGE_COVER_CAP_MS` was 3000ms against a page deadline of ~3600ms — so any page that took a moment to settle was revealed half-built | Fixed by making the page's deadline the shorter of the two (2.4s) and the cap a genuine failsafe (4.2s). The page will not report ready while it is still unstyled at all |
| The app sat on a warm off-white while every section the store paints is pure white, so the seam between them moved as a page assembled and read as flicker | Fixed: the ground is white. The native list screens that need a card separator use `COLORS.surface` |
| Listing cards showed the compact variant picker, not the reference's full-width Add to Bag | Fixed via `body.zigly-listing` — but see the row below; the first attempt did nothing |
| Cards had *no* add control at all on a phone: the variant picker hidden by us, Add to Bag hidden by the theme | Fixed. Two mobile rules hid its container — `base.css`'s `.small-hide` and `product-card.css`'s `.product-card-wrapper .quick-add`. `display:block` on the button could never bring back a parent that is `display:none`, so the earlier fix was a no-op. The container is un-hidden and the floating "+ Add" chip hidden in its place |
| The banner could not be swiped past its last slide | Fixed — see *Carousels*. The theme nests `loop` inside `autoplay`, where Swiper ignores it |
| The coupon strip scrolled itself, and its copy button did nothing | Fixed — see *The coupon strip* |
| Category circles never became the reference's set | Fixed. `homeLayout` called `window.__ziglyFetchSection` and `pageCache` — which defines it — was concatenated *after* it, so the call threw on every load into that module's own `catch`. The fetcher now installs first |
| "Everything For" never appeared | Fixed. It checked `[id*="everything"]` to see whether the site already rendered the section, and matched our own reserved slot `zigly-x-everything`, so it disabled itself every time. The check now ignores `zigly-` ids |
| Explore tiles opened empty listings | Fixed. Merged tiles had their link rewritten to a collection handle guessed from the label, guarded by a HEAD request — which passes for a published-but-empty collection. Five of sixteen tiles led to zero products. Tiles now keep the link Zigly gave them |
| Brand cards showed two brands stacked per column | Fixed. The section's Swiper is initialised with `grid: { rows: 2 }`; the rail is laid out as a single-row native scroller instead |
| The brand rail would not scroll smoothly by thumb | Fixed — see *The brand rail*. The CSS described a native scroller but the section's Swiper was still **alive**, holding the gesture and answering a drag with a transform that CSS pinned to `none`. `src/webview/brandRail.ts` stands the instance down |
| Bestsellers was the homepage's "Trending Products" | Fixed, then superseded twice — see the two rows below |
| That slot then showed Zigly's "Pet Parent Favourites" rail, transplanted under its own heading | Deliberate at the time: relabelling somebody else's curated rail "Bestsellers" would have been this app making a sales claim on their behalf. Superseded, not reversed — the objection was about relabelling, and nothing is relabelled now |
| The dashboard had no bestsellers at all | Fixed — see *Bestsellers*. Twelve real product cards read from Zigly's own `sort_by=best-selling`, so the heading describes the store's ordering rather than adding a claim to it |
| Logging in left the app: the Account tab, and every `/account` link, opened Shopify's own account page | Fixed — native account section, and account urls are taken over before they navigate |
| No Account item in the bottom navigation | Fixed — the site's bar has none to restyle, so the bar is native and carries five tabs |
| Some homepage sections not visible | Resolved. Each had its own cause, none of them the site's mobile design; the last outstanding one, the reference app's closing "From Our Instagram", is now built — see the row below |
| The reference's "From Our Instagram" | Built, from Zigly's own Instagram rather than from the site. No section on zigly.com is called that and none pulls a feed, so for a while the theme's own photo grid (`gallery` on `/pages/store-home-page-section`, "Happy Moments") stood in for it under its own heading — retitling that would have told the customer these photos came from a feed they could follow, which is not where they came from. The rail now shows real posts from @ziglypetcare, so the heading is accurate and the stand-in is gone. The posts are **hardcoded**, read from the account on 2026-08-23 and frozen: see `src/webview/instagramSection.ts` for how to refresh the list, and note that it ages |

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
| A real Edit Profile and a real Delete Account | both are drawn and both are local-only; no storefront endpoint exists for either, so they need Zigly's own backend — see *The account section* |
| Change Password | no storefront endpoint; the row is not drawn |
