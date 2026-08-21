/**
 * Centralised DOM selectors for zigly.com.
 *
 * The site is a Shopify storefront on the Dawn 15.2.0 theme, so the most stable
 * hooks are Dawn's custom elements and its documented state classes -- both are
 * load-bearing for the theme's own JavaScript and cannot be renamed without
 * breaking the store. Prefer those over visual class names.
 *
 * NEVER match a full Shopify section id. They carry a generated suffix
 * (`home_arrival_section_XRNURe`) that regenerates whenever the merchant
 * duplicates or re-saves the theme. Match the stable fragment instead:
 *   [id*="home_arrival_section"]
 *
 * Verified against the live DOM on 2026-08-20.
 */
export const domSelectors = {
  /** Dawn header wrapper. Sticky behaviour is driven by data-sticky-type. */
  stickyHeader: 'sticky-header',

  /**
   * Applied by Dawn to the header's section wrapper while it is hidden after a
   * downward scroll. Dawn's CSS translates it off-screen.
   */
  headerHidden: '.shopify-section-header-hidden',

  /** Applied while the header is pinned to the viewport. */
  headerSticky: '.shopify-section-header-sticky',

  /** Mobile navigation drawer (hamburger). */
  headerDrawer: 'header-drawer',

  /** Cart icon; Dawn intercepts the click and opens the drawer. */
  cartIcon: '#cart-icon-bubble',

  /** Cart drawer. Its innerHTML is replaced wholesale on every cart update. */
  cartDrawer: 'cart-drawer',

  /**
   * The site's own fixed bottom navigation (Zigly / Collections / Breed-verse /
   * Wishlist). Fixed below 990px, hidden above. This is why the app ships no
   * native tab bar.
   */
  bottomNav: '.fixed-icons',

  /** SearchTap mobile search trigger. Third-party; restyle, never rebuild. */
  searchTriggerMobile: '.st-search-icon-mobile',

  /** Gorgias support launcher, which can overlap the bottom nav. */
  supportLauncher: '[class*="gorgias"]',
} as const;
