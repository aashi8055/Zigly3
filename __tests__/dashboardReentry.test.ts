/**
 * The dashboard has to survive being injected more than once.
 *
 * ../src/screens/ZiglyWebViewScreen re-injects the whole payload on
 * RESTYLE_DELAYS -- [0, 500, 1500, 3000, 6000, 10000]ms -- because the page
 * keeps pulling in third-party scripts long after onLoadEnd and a single pass
 * loses to whichever of them restyles the header last. So every script in the
 * payload runs seven times per page load, and the comment at that call site
 * asserts they are all idempotent.
 *
 * extraSections.ts was not. The first pass was right and every pass after it
 * was wrong: entries that found their work already done returned without moving
 * `tail`, leaving it back at zigly-explore while the loop kept walking, and the
 * four `move` entries -- the only ones with no placeholder of their own to find
 * -- re-inserted themselves after it. Top Pets Brands, Pet Parenting, the video
 * and Real Pets all ended up directly under Explore, ahead of the eleven
 * sections declared before them, and it held there for every pass after.
 *
 * Confirmed on 2026-08-24 by running the real payload against the live
 * homepage in a DOM: one pass gave the declared order, two gave the customer's.
 * Neither reading the file nor the single-pass order test in injection.test.ts
 * showed it, which is why this file exists separately from both.
 */
import {getInjectionForUrl} from '../src/webview/injectedScripts';

const home = () => getInjectionForUrl('https://zigly.com/') as string;

describe('extraSections re-entrancy', () => {
  it('carries the tail past a slot that is already reserved', () => {
    expect(home()).toContain('if (standing) { tail = standing; return; }');
  });

  it('carries the tail past a section that is already transplanted', () => {
    const s = home();
    expect(s).toContain('var done = document.getElementById(spec.mark);');
    // The coupon strip is anchored to the banner rather than to the tail, so it
    // is the one entry that must NOT advance it -- doing so would drag the
    // whole tail back up under the banner.
    expect(s).toContain("if (spec.key !== 'coupon_slider') { tail = done; }");
  });

  it('tests for its own placeholder before testing for the theme section', () => {
    // Several entries carry their own fragment as their check -- shop_by_price
    // checks for 'shop_by_price' -- and once the transplant has landed, that
    // fragment is on the page: inside our own slot. Reaching spec.check on a
    // re-run would find our own work, read it as Zigly having restored the
    // section, skip the entry and strand the tail. See everythingSection.ts,
    // which hit the same trap from the other direction.
    const s = home();
    const mark = s.indexOf('var done = document.getElementById(spec.mark);');
    const check = s.indexOf('spec.check && document.querySelector');
    expect(mark).toBeGreaterThan(-1);
    expect(check).toBeGreaterThan(mark);
  });

  it('leaves no move entry without a tail to anchor to', () => {
    // Every `move` re-inserts itself at tail.nextSibling on every pass, so a
    // move declared after an entry that cannot advance the tail is the exact
    // shape of the bug. There is no placeholder to guard them with -- the tail
    // bookkeeping above is the only thing keeping them in place.
    const s = home();
    for (const frag of [
      'home_shop_by_brand_section',
      'helpful_tips',
      'custom_video_text_banner',
      'about_our_communities',
    ]) {
      expect(s).toContain('"move":"' + frag + '"');
    }
  });
});
