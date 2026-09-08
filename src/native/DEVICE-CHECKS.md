# Native dashboard — what to check on a device

Nothing in `src/native/` has been seen running. Tests cover data shaping and
section order; they cannot cover proportion, colour or feel. This is the list to
walk when the build is first run, kept as sections are written so nothing is
reconstructed from memory later.

Ordered by how much a wrong answer costs — a shared component's geometry is a
correction in one file that changes every section that uses it, so those come
first.

## 1. Shared geometry (a wrong answer here changes many sections)

- [ ] **Tile disc, 60dp** — `TileRow.tsx` `CIRCLE`. Sized so five fill the width
      `Skeleton.tsx`'s `HomeSkeleton` reserves (five cells at 18%). If the
      hand-off from the placeholder visibly jumps, this is why.
      Affects: categories, breeds-dogs, breeds-cats.
- [ ] **Tile label, 11.5sp / 2 lines** — the theme says 1.4rem/600 on a 62.5%
      rem base. "Labrador Retriever" is the constraint; check it does not clip
      or push the row's height around.
- [ ] **Product card, 156dp wide** — `ProductCard.tsx` `CARD_WIDTH`. Derived
      from `Skeleton.tsx`'s `railCard` (42% of screen). Check two-and-a-bit
      cards land on screen, and that the 32dp two-line title floor does not
      leave short titles looking gappy.
      Affects: hot-picks, bestsellers, and every later product rail.
- [ ] **Product card image, square** — matches `railImage`. Zigly's packshots
      are `contain` on `#F7F8FA`; check tall bags and wide beds both read well.
- [ ] **Rail gutter, 12dp** — every rail. Chosen to match what
      `injectedStyles.ts` settled on for the coupon strip so rails line up
      vertically. Check the left edges of every section agree.
- [ ] **Section heading, 17sp/700** — `TileRow`/`ProductRail`/`OfferRail`/
      `BrandRail` all state this separately. Check it does not read louder than
      the content, and that all four agree.
- [ ] **Tab pills** — `ProductRail`, `ExploreSection`, `BrandRail` each draw
      their own. Check the three look identical, and that the navy fill on the
      selected one is legible.

## 2. Per-section, most likely to be wrong

- [ ] **Banner, 2:1** — `BannerCarousel.tsx` `RATIO`. The crops are 600x400
      (3:2) shown at 2:1, so `cover` trims top and bottom. Check nothing
      important is cut, and that `Skeleton`'s `aspectRatio: 2` matches.
- [ ] **Banner autoplay + loop** — 5s, pauses 8s on touch, wraps both ways.
      This is the "banner stuck" defect the web version had; confirm the last
      slide continues into the first.
- [ ] **Coupon card, 268dp** — `CouponStrip.tsx` `CARD_WIDTH`. Sized for the
      longest live headline on two lines ("INR 750 Off on orders between INR
      10000 - INR 14999"). Check no headline clips.
- [ ] **Coupon strip has no copy button** — deliberate; the field named
      `discount_code` holds offer copy, not codes. Confirm that is still true
      on the live store when checking.
- [ ] **Offer tiles, 132dp square** — `OfferRail.tsx`. Artwork is 650x610 /
      610x650 with 8px radius from the theme.
- [ ] **Offer tiles: any missing?** — these have no labels, so an unresolved
      image is dropped silently. Count the tiles: Applod Food 4, Applod Treats
      4, Zigly Style Steals 7. A short rail means a key no longer matches its
      filename.
- [ ] **best_deals grid, 3 columns** — `BestDeals.tsx`. Theme figures: 126dp
      tiles, 181dp banner, 10dp gaps, 4.26dp tile radius (odd on purpose).
      Drops to 2 columns below 400dp — check on a narrow device.
- [ ] **best_deals: 6 tiles present?** — same silent-drop risk as the offer
      rails.
- [ ] **Zigly Coins opens IN-APP** — `ziglyprime.erlpaas.com` is in
      `INTERNAL_HOSTS` deliberately; that flow asks for a mobile number and
      breaks in a browser. Also confirm the encoded space in
      `/Login%20Microsite` resolves.
- [ ] **Brand logos, 148x84** — `BrandRail.tsx`, the artwork's own 475:268.
      Check wordmarks are not cut.
- [ ] **Brand tabs show "Popular" / "Emerging"** — merchant labels, read live.
      If they read differently, the metaobject changed rather than the code
      breaking.
- [ ] **Price tiles, three across** — `PriceTiles.tsx`. Six tiles, two rows,
      10dp gaps. Matches what `injectedStyles.ts` already forces today
      (`repeat(3, minmax(0, 1fr))`), not the theme's own rail. On a narrow
      screen check "₹1499" is not clipped inside its column — the cell sets
      `minWidth: 0` for exactly that.
- [ ] **Price tile colours** — six pastels with black text, taken from theme
      data rather than `appConstants`. Check contrast is acceptable on all six
      and that none has arrived as the wrong colour.
- [ ] **Price tiles work offline** — the one section that needs no network at
      all. On a first-ever launch in airplane mode this must be fully present
      and tappable.

## 3. Things only a real network shows

- [ ] **First launch with no cache** — categories, breeds and Explore draw
      labels immediately and pictures a moment later. Check that reads as
      loading rather than as broken.
- [ ] **Offer rails and best_deals on a cold first launch** — these have no
      label fallback, so they appear *after* their fetch. Check the page does
      not visibly jump when they land (a skeleton holds their place).
- [ ] **Airplane mode, first ever launch** — categories/breeds/Explore should
      still be complete and tappable (labels ship in the app); offer rails,
      best_deals, coupons, brands and product rails should be absent, not
      empty-framed.
- [ ] **Airplane mode, second launch** — banner and tile artwork should come
      from AsyncStorage. Coupons, brands and products should be absent (never
      cached, deliberately).
- [ ] **Prices** — GraphQL returns decimals; `products.ts` converts to paise
      once. Spot-check one price against the website. A 100x error is the
      failure to look for.
- [ ] **Add to Bag from a rail** — must reach the same cart the WebView has.
      Add natively, then open the cart: the count must agree.
- [ ] **A product with variants** — its card must say "View Options" and open
      the product page, never add a size nobody chose.

## 4. Not yet wired

`ZiglyWebViewScreen.tsx` still renders the WebView dashboard. None of these
components is mounted anywhere, by the "build all, then switch over" plan. The
switch-over is its own piece of work and is where `dashboardSections.ts`'s
`native` flags start being read.
