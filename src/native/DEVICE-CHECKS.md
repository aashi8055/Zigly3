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
- [ ] **Tab pills** — `ProductRail`, `TabbedTileSection` and `BrandRail` each
      draw their own. Check the three look identical, and that the navy fill on
      the selected one is legible. (Explore and Everything For share
      `TabbedTileSection`, so those two cannot disagree with each other.)

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
- [ ] **Single banners, 20:7 full-bleed** — `SingleBanner.tsx`. The Vet Care
      banner (under the price tiles) and the brand-claims strip (last section).
      Edge to edge with square corners, matching the hero carousel — the
      section's own 10px radius is dropped on purpose. Check neither reads as a
      card floating in a gutter.
- [ ] **Brand-claims strip is NOT tappable** — its `button_link` is empty in
      the theme. Check it takes no press state and a screen reader calls it an
      image, not a link.
- [ ] **Furpro banner is absent** — the dog page shows it, the app does not
      (extraSections seeds its id but places no entry). If it appears, that is
      a regression, not a fix.
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
- [ ] **Concern cards, 148dp** — `ConcernRail.tsx`. The theme shows 2.5 cards
      (`calc(100% / 2.5) - 10px`); these are a little wider for the three lines
      of text. Check "Weight Management" and "Skin & Coat Care" both wrap to two
      lines without clipping, and that every card's button sits on the same
      line (the subheading reserves two lines for exactly that).
- [ ] **Concern card: whole card taps** — not just the button. The theme makes
      only the button a link and `concernCards.ts` has to fix that on the web
      side; here one `Pressable` wraps the card. Check tapping the photo and
      the heading both work, and that the red button does not feel like a
      second competing target.
- [ ] **Deworming card opens a BLOG POST** — the only card that does not go to
      a collection. It says "Shop Now" and lands on an article; that is Zigly's
      choice, not a bug.
- [ ] **Joint Pain card opens `/collections/hip-joint`** — the label and the
      handle disagree on the site. If it 404s, someone derived the handle from
      the heading.
- [ ] **Bestsellers really are best sellers** — `Bestsellers.tsx`. Compare the
      first three cards against `zigly.com/collections/all?sort_by=best-selling`
      in a browser. They should agree, and they should NOT be alphabetical
      (unsorted opens on Acana; sorted opens on Applod / Royal Canin). This is
      the check that keeps the heading honest.
- [ ] **Bestsellers mixes dogs and cats** — store-wide on purpose. A rail of
      only dog products would mean the sort is being filtered somewhere.
- [ ] **Bestsellers shows 12 cards** — the source page carries 22.

- [ ] **Everything For: tabs say Dogs / Cats** — the app's own labels. If they
      read Puppy/Adult or Kitten/Cat, the merge in `everything.ts` was lost.
- [ ] **Everything For: 8 tiles under Dogs, 12 under Cats** — a short row means
      a filename key no longer matches. The wet-dog-food-adult slot is absent on
      purpose (it has a link and no artwork).
- [ ] **Explore and Everything For look like the same component** — they are,
      since `TabbedTileSection.tsx`. Only the tab wrapping differs (Explore
      wraps, Everything does not).
- [ ] **Instagram: 8 square cards, 46% wide** — `InstagramRail.tsx`. Matches
      the `.zigly-ig` CSS measurement for measurement (14dp radius, 12dp gap,
      `#EFEFEF` ground). Two and a bit cards on screen.
- [ ] **Instagram: reel badge on 6 of 8** — 26dp at top/right 8dp,
      `rgba(0,0,0,0.45)`, white play triangle. Photos get none. If all eight
      carry one, `isVideo` was lost.
- [ ] **Instagram: order is NOT grouped by type** — reels and photos
      interleaved, as the account has them. A tidy "all reels first" is the
      regression to watch for.
- [ ] **Instagram tap opens the Instagram app** — `instagram.com` is in
      `EXTERNAL_HOSTS`, so it should hand off, not open a login wall inside the
      shopping session.
- [ ] **Instagram works in airplane mode, first launch** — covers are bundled
      JPEGs, so this section needs no network at all. Along with the price
      tiles, it is one of only two that are fully present offline.
- [ ] **Video block: poster, heading, paragraph on navy** — `VideoBlock.tsx`.
      No play glyph unless an `onPlay` handler is wired (see the open decision
      in that file). Check the white-on-navy paragraph is comfortable to read.
- [ ] **Community cards stack, 2 of them** — `CommunityCards.tsx`. Logos are
      `contain`ed, so check no wordmark is cut. Both "Know More" buttons should
      leave the app.
- [ ] **Article cards, 1.5 on screen** — `TipsRail.tsx`, the theme's own
      `slidesPerView: 1.5`, so these are the widest cards on the dashboard.
      Check titles clamp at two lines and the "View All" link sits on the
      heading row.
- [ ] **Article cards are the only section fed by parsed HTML** — if this one
      is empty while others draw, the theme's article-card class names changed.
      That is the fragility the blog-scope constraint forces.

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
- [ ] **A product with variants** — its card must say "Add to Bag", same as
      every other card, and add its first in-stock variant. This is what the
      website's own cards do; the card used to say "View Options" here and
      navigate instead, which is the bug this replaced.
- [ ] **A product whose lead variant is sold out** — the variant that lands in
      the cart must be an in-stock one, not the sold-out first.

## 4. Wired — what to check about the switch-over itself

`ZiglyWebViewScreen.tsx` now draws `NativeDashboard` over the home WebView,
which stays mounted as the app's session.

- [ ] **The dashboard is native** — no part of it should be the website
      assembling itself. If sections appear one at a time from the top, the
      native list is not covering the WebView.
- [ ] **The search band is there** — on the dashboard only. It is the NATIVE
      band now (`showSearch={onDashboard(stack)}`), because the injected one is
      behind the native list. A page layer still shows its own injected band.
- [ ] **The band folds away when the drawer opens** — `searchCollapsed={menuOpen}`.
      The band sits above `body`, outside what the drawer covers, so an
      expanded band would stand over the open panel as a pale strip.
      `menu.test.tsx` guards this; it caught the bug when `showSearch` was
      turned on.
- [ ] **Back from a page returns instantly, scroll intact** — the native
      dashboard is an absolutely-positioned layer like the page layers, so it
      is never unmounted.
- [ ] **Add to Bag reaches the SAME cart** — add from a native rail, then open
      the cart. The count must agree. This goes through `cartBridge` inside the
      WebView on purpose; a native fetch would write to a second session.
- [ ] **Cart and wishlist badges still update** — they are read from the
      WebView, which nobody looks at any more. If they stop moving, the
      counters lost their source.
- [ ] **Account, wishlist, cart and search still draw over the dashboard** —
      they are rendered after it in the tree, so they should.
- [ ] **The splash hands over to the dashboard, not to a gap** — `homePainted`
      is driven by the native list's first layout now, not by the WebView's
      ready signal.

### Known cost, deferred deliberately

The home WebView still runs the twelve injected scripts that build the *old*
dashboard — fetching and transplanting a couple of MB of section HTML for a
screen nobody sees, seven times per load on `RESTYLE_DELAYS`. Suppressing them
on the homepage is a ~5-line change in `injectedScripts.ts`, and it was tried:
it breaks 55 existing tests that assert those scripts are present for the
homepage URL. That is a separate change with its own test migration, not
something to fold into the switch-over. The waste is real but invisible —
it costs battery and data, not correctness.
