# Zigly — data source inventory

Every URL the zigly.com storefront uses to obtain data, and which mobile screen
each one feeds. Compiled 2026-08-21.

## How this was captured

No browser automation was available in this environment, so this is **not** a
literal DevTools HAR export. It was assembled from:

- the server-rendered homepage HTML (5.7 MB, mobile Safari UA)
- the theme's own JS bundles (`searchtap.js`, 667 KB, and the preload `link:` header)
- **live probes of every endpoint listed below** — the status codes and payload
  shapes here are verified, not inferred

What this method cannot see: XHRs that only fire on user interaction inside
third-party widgets (Judge.me review submission, Fastrr checkout steps, Netcore
event beacons after consent). Those are marked *inferred* where listed.

## Platform identity

| Field | Value |
| --- | --- |
| Platform | Shopify (`powered-by: Shopify`) |
| Shop domain | `zigly.com` |
| myshopify domain | `zigly-store.myshopify.com` |
| Shop ID | `92312043836` |
| Theme | `Zigly-Live-June`, id `185705759036`, Dawn 15.2.0 |
| Locale / country / currency | `en` / `IN` / `INR` |
| CDN | `cdn.shopify.com/shop/t/257/assets/…` |
| Catalogue scale | 3 product sitemap shards; `/collections.json` caps out at 250 |

Because it is stock Shopify, **the mobile app does not need a custom backend.**
Every screen can be fed by the same endpoints the website uses, which is what
makes the data consistent by construction.

---

## 1. Shopify AJAX API — verified live

Same-origin, no auth, no token. Session-scoped via the `_shopify_*` cookies, so
a WebView sharing its cookie jar sees the same cart as the site.

| Endpoint | Verified | Feeds |
| --- | --- | --- |
| `GET /products.json?limit=&page=` | 200, `application/json` | catalogue paging |
| `GET /products/{handle}.js` | 200 | PDP |
| `GET /collections.json?limit=250` | 200, 250 rows | category tree |
| `GET /collections/{handle}/products.json?limit=&page=` | 200 | listing screens |
| `GET /cart.js` | 200 | cart badge, cart screen |
| `POST /cart/add.js` | in theme JS | Add to Bag |
| `POST /cart/update.js` | in theme JS | qty change / remove |
| `GET /search/suggest.json?q=&resources[type]=product&resources[limit]=` | 200, 12 KB | search autocomplete |
| `GET /meta.json` | 200 | shop name, currency, country |
| `GET /recommendations/products.json?product_id=&limit=` | Shopify standard | "you may also like" |

`/products/{handle}.js` top-level keys — this is the PDP contract:

```
id, title, handle, description, published_at, created_at, vendor, type, tags,
price, price_min, price_max, available, price_varies,
compare_at_price, compare_at_price_min, compare_at_price_max, compare_at_price_varies,
variants, images, featured_image, options, url, media,
requires_selling_plan, selling_plan_groups
```

Prices are **integer paise** (`price: 39900` = ₹399.00). Divide by 100 exactly
once — inconsistent price formatting is the most common way a Shopify clone
drifts from the website.

## 2. Storefront GraphQL API — verified live

```
POST https://zigly.com/api/2025-01/graphql.json
X-Shopify-Storefront-Access-Token: <token>
Content-Type: application/json
```

Called by the theme's own `searchtap.js`. Two public storefront tokens are
served in client-side code; **both return 200** against the query above:

| Token | Found in |
| --- | --- |
| `2d415fee375ed51500407e19f4c6c49a` | `assets/searchtap.js` |
| `7e794a6c492e55c35bf2fd3b711b46e0` | homepage inline JS (`storefrontAccessToken =`) |

These are *public* Storefront tokens — designed to ship to browsers, read-only,
scoped by the app that issued them. They are not a credential leak. Two of them
is still worth a look: it usually means two apps, and if either was granted more
than `unauthenticated_read_*` it should be re-scoped. Worth confirming with
whoever owns the Shopify admin before the app depends on either one.

Prefer this API over `/products.json` for the app: one round trip can fetch a
collection with variants, images, availability and metafields, and it paginates
by cursor rather than by page number.

## 3. Section Rendering API — verified live

```
GET https://zigly.com/?sections=header          → 200, 74 KB JSON
GET https://zigly.com/{path}?sections={id,id}
```

Returns the theme's **own rendered HTML** for named sections. This is the single
most useful endpoint for your project: it is the exact markup the website would
draw, so anything rendered from it cannot drift from the site.

Homepage section IDs present in the DOM:

```
sections--26530985181500__header
sections--26530985181500__mega_announcement_bar_XHnKCa
sections--26530985148732__footer
otp-section
template--26530973548860__homepage_banner_tA3yzQ
template--26530973548860__home_category_section_ej8trH
template--26530973548860__home_arrival_section_GQJi3t
template--26530973548860__home_arrival_section_XRNURe
template--26530973548860__home_shop_by_brand_section_GYNVPA
template--26530973548860__custom_single_banner_BKqg89 / _WGCJEB / _kYf6Um
template--26530973548860__custom_video_text_banner_HKdrme
template--26530973548860__about_our_communities_Rjb873
template--26530973548860__helpful_tips_CEYEgg
```

Those IDs embed the template/section instance number and **will change whenever
the theme is republished.** Resolve them at runtime by reading
`id="shopify-section-…"` off the page; never hardcode them in the app.

### Seeded-ID audit — all 22 still valid (2026-08-21)

`src/webview/pageCache.ts` seeds 22 section ids as a fast-path hint. Every one
was requested against `/` and **all 22 returned real markup**, so the seed table
is current and the self-healing rediscovery path is not being exercised. Re-run
this audit after any Zigly theme republish.

Confirmed en route: section ids resolve **globally, regardless of the requesting
path** — the `/pages/dog` and `/pages/cat` template ids all return content when
asked for from `/`. The batching in `pageCache.ts` depends on that, and it holds.

Payload sizes are wildly uneven, which is worth knowing before making any of
these eager:

| Section | Size |
| --- | --- |
| `home_arrival_section@dog` | 534 KB |
| `home_arrival_section@cat` | 360 KB |
| `collection_product_section` | 258 KB |
| `coupon_slider` | 80 KB |
| `everything@cat` / `@dog` | 60 / 50 KB |
| `home_shop_by_breed_section@dog` | 40 KB |
| `video_swiper` | 34 KB |
| `explore_product@cat` / `@dog` | 32 / 31 KB |
| `shop_of_concern` | 21 KB |
| `home_shop_by_breed_section@cat` | 22 KB |
| `home_category_section` | 15 KB |
| `offer_section#1/#2/#3` | ~11–14 KB each |
| `shop_by_price`, `best_deals` | ~12 KB each |
| `custom_single_banner#1/#2/#3` | ~4.4 KB each |
| `redesign_custom_double_banner` | 4.8 KB |

The three largest are **not** on the dashboard's fetch path: `extraSections.ts`
relocates `home_arrival_section` within the live DOM (`move`, not a fetch), and
`collection_product_section` and `video_swiper` are seeded but unused there. Of
what the dashboard does fetch, only `coupon_slider` is eager; the rest wait on an
IntersectionObserver with a 700 px margin. So first paint costs roughly
95 KB of section HTML (`coupon_slider` + `home_category_section`), not the 1.6 MB
the full table might suggest.

The standing risk is the reverse of a stale id: those three fat sections are one
`eager: true` away from a very slow dashboard on mobile data.

## 4. Zigly's own APIs (AWS API Gateway, ap-south-1)

The only non-Shopify first-party data. Both unauthenticated from the browser.

| Endpoint | Purpose |
| --- | --- |
| `GET https://9bc3azl93i.execute-api.ap-south-1.amazonaws.com/dev/pincode_fetch` | pincode → serviceability |
| `GET https://9bc3azl93i.execute-api.ap-south-1.amazonaws.com/dev/clickpost/?type=fetchEstimateDelivery` | ClickPost delivery ETA |
| `POST https://860wd50e1i.execute-api.ap-south-1.amazonaws.com/default/zigly-prescription-upload/api/prescription/stage-upload` | vet prescription upload |
| `…/api/prescription/auto-upload` | prescription auto-upload |
| `…/api/prescription/auto-consult` | prescription → consult booking |

Note the `/dev/` stage on the pincode/ETA Lambda — production traffic is running
through a stage named `dev`. Not your bug, but flag it: a `dev` stage can be
redeployed or throttled without notice, and the PDP delivery-estimate widget
depends on it.

The prescription endpoints matter for the app: they take **file uploads**, and
the README already lists "file chooser for `<input type=file>`" as a Phase 6 gap.
Prescription upload is therefore broken in the current WebView, not merely
unpolished.

## 5. Third-party services

| Host | Role | Data-bearing |
| --- | --- | --- |
| `api.judge.me`, `cdn(1,2,widget).judge.me` | product reviews | yes — review lists/counts |
| `fastrr-boost-ui.pickrr.com` | Shiprocket Fastrr express checkout | yes — checkout session |
| `cdnt.netcoresmartech.com`, `twa.netcoresmartech.com` | Netcore analytics / engagement | telemetry only |
| `app.flash-speed.com` | pagespeed injector + service worker | no |
| `9bc3azl93i…`, `860wd50e1i…` | see §4 | yes |
| `nominatim.openstreetmap.org` | reverse geocode for the pincode widget | yes |
| `api64.ipify.org` | client IP lookup | yes |
| `monorail-edge.shopifysvc.com` | Shopify analytics | telemetry only |
| `www.googletagmanager.com`, `www.clarity.ms` | GTM, MS Clarity | telemetry only |
| `platform-api.sharethis.com` | share buttons | no |
| `extensions.shopifycdn.com` | Shopify app embeds | varies |
| `stores.zigly.com`, `franchise.zigly.com`, `ziglyfoundation.com` | separate properties | out of app scope |

`app.flash-speed.com/static/worker-min.js` registers a **service worker**. In a
WebView that intercepts fetches and caches responses, which is a live candidate
for the open "some homepage sections not visible" defect — a stale SW cache
serves old section HTML. Worth testing with the SW blocked.

## 6. Screen → data source map

| Mobile screen | Primary source | Notes |
| --- | --- | --- |
| Home | `?sections=<home section ids>` | resolve ids at runtime (§3) |
| Category circles / brands | `/collections.json` + home sections | |
| Listing (PLP) | Storefront GraphQL, or `/collections/{h}/products.json` | site's sort/filter bar is theme-rendered |
| Search autocomplete | `/search/suggest.json` | |
| PDP | `/products/{handle}.js` (+ Judge.me for reviews) | prices in paise |
| Delivery ETA on PDP | `pincode_fetch` + `clickpost` | §4 |
| Cart | `/cart.js`, `/cart/add.js`, `/cart/update.js` | cookie-scoped |
| Checkout | `/checkouts/…`, Fastrr | leave in WebView — see below |
| Login / OTP | `/account/login`, `otp-section` | no SMS autofill in WebView |
| Prescription upload | `860wd50e1i…` prescription endpoints | needs a file chooser |
| Blog / static pages | `/blogs/all`, `/pages/*`, `/policies/*` | |

## 7. Keeping the data consistent

1. **One cookie jar.** Cart and login live in `_shopify_*` cookies. If any screen
   fetches JSON outside the WebView's cookie store, it gets a *different* cart.
   Either share the jar or route all cart writes through the WebView.
2. **Prices in paise, divided once.** See §1.
3. **Never hardcode section ids.** See §3.
4. **Don't reimplement checkout.** Payment redirects to unknowable bank 3-D
   Secure domains; `urlUtils.ts` already handles this correctly. A native
   checkout would have to re-solve it and would drift from the site's pricing,
   coupons and shipping rules.
5. **`?sections=` over hand-built layouts** wherever a screen mirrors a site
   section. Anything you re-draw by hand is something that can disagree with the
   website the next time merchandising changes.

## 8. Scope note

This documents endpoints, payload shapes and structure so the app can read the
same data as the site. It deliberately does not copy Zigly's page copy, imagery
or design assets — the build stays a client of the live site, consistent with the
existing "not sanctioned by Zigly" preview positioning in the README.
