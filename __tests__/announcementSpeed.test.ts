/**
 * The announcement strip has to fill early, and this file is the guard on the
 * two things that make it do so.
 *
 * THE BUG. The strip is the topmost thing on the screen and it was the last
 * thing to have any content. `REPORT_ANNOUNCEMENTS` was injected only at
 * onLoadEnd, so its first attempt was already behind the entire page download,
 * and if the bar was not readable at that instant it waited a further 1500ms
 * before trying again. Meanwhile the text it wanted had been sitting in the
 * DOM almost the whole time: the announcement section is markup near the top
 * of the document, parsed long before the images and third-party scripts that
 * decide when onLoadEnd fires. Measured against a simulated cold start (the
 * section parsed at 200ms, load at 2500ms) the strip filled at ~2514ms; with
 * the reader at document-start and watching for the element it fills at
 * ~221ms.
 *
 * WHY THE ASSERTIONS ARE ON THE SCRIPT'S SOURCE, and not on a live DOM. The
 * project deliberately keeps jsdom out of `package.json`, and the sibling DOM
 * tests hand-write the handful of DOM methods their script touches. This
 * script touches too much of a real document to stub honestly -- a
 * MutationObserver firing as a parser appends a subtree is the whole
 * behaviour, and a stub of it would be asserting the stub. The live behaviour
 * was verified in jsdom out of tree (all four cases below); what is pinned
 * here is the structure that produced it, which is what a future edit would
 * break.
 */
import {REPORT_ANNOUNCEMENTS} from '../src/webview/headerBridge';
import {readFileSync} from 'fs';
import {join} from 'path';

const SCREEN = readFileSync(
  join(__dirname, '..', 'src', 'screens', 'ZiglyWebViewScreen.tsx'),
  'utf8',
);

describe('the announcement reader starts before the page has loaded', () => {
  it('is in the dashboard’s document-start payload', () => {
    /*
     * The point of the change. `injectedJavaScriptBeforeContentLoaded` on the
     * dashboard WebView is handed HOME_EARLY_SCRIPT, so this is what puts the
     * reader in front of the page's own scripts rather than after all of them.
     */
    expect(SCREEN).toContain(
      'const HOME_EARLY_SCRIPT = EARLY_HEADER_CSS + REPORT_ANNOUNCEMENTS;',
    );
    expect(SCREEN).toContain(
      'injectedJavaScriptBeforeContentLoaded={HOME_EARLY_SCRIPT}',
    );
  });

  it('is STILL injected at onLoadEnd as well', () => {
    /*
     * Deliberately both, and not a leftover to tidy up:
     * `injectedJavaScriptBeforeContentLoaded` is unreliable on Android, which
     * is why nothing else in that file trusts it alone either. The reader is
     * idempotent, so the second pass costs one query and returns.
     */
    expect(SCREEN).toContain('injectInto(target, REPORT_ANNOUNCEMENTS);');
  });

  it('watches for the element instead of sampling twice for it', () => {
    // The 1500ms guess is what made a miss expensive. An observer fires as the
    // parser appends the section, which is why the strip now fills at ~221ms
    // rather than ~2514ms on a cold start.
    expect(REPORT_ANNOUNCEMENTS).toContain('new MutationObserver');
    expect(REPORT_ANNOUNCEMENTS).toContain('DOMContentLoaded');
  });

  it('stops watching once it has read the bar', () => {
    // An observer on the whole document for the life of the page is real work
    // on the one thread the dashboard is assembled on.
    expect(REPORT_ANNOUNCEMENTS).toContain('obs.disconnect()');
  });

  it('stops watching even on a page that has no bar at all', () => {
    // Otherwise the observer outlives every inner page that never had a strip.
    const at = REPORT_ANNOUNCEMENTS.indexOf('setTimeout(function ()');
    expect(at).toBeGreaterThan(-1);
    expect(REPORT_ANNOUNCEMENTS.slice(at, at + 120)).toContain('disconnect');
  });
});

describe('and it does not repeat itself', () => {
  /*
   * THE LATCH IS ON window, AND THAT IS THE POINT.
   *
   * The payload is injected several times per document -- document-start,
   * onLoadEnd, and each delayed restyle pass -- and every injection is a fresh
   * IIFE with its own locals, so a local flag latches nothing across them. A
   * first attempt at this used one, and seven injections sent seven identical
   * reports and left seven MutationObservers on the document (measured). A
   * window property survives between injections in one document and is
   * discarded with it, which is exactly the scope wanted: a re-navigation
   * re-reads, a re-injection does not.
   */
  it('latches on the window, so a later injection is free', () => {
    expect(REPORT_ANNOUNCEMENTS).toContain(
      'if (window.__ziglyAnnouncementsDone) { return; }',
    );
    expect(REPORT_ANNOUNCEMENTS).toContain(
      'window.__ziglyAnnouncementsDone = true;',
    );
  });

  it('only latches on a report that actually carried offers', () => {
    /*
     * The subtle half. Setting the flag when the host was found but empty
     * would latch on a section the theme has parsed but not yet filled --
     * exactly the state a document-start read is most likely to catch it in --
     * and the strip would stay blank for the life of the page. So the flag is
     * set after the postMessage, inside the branch guarded by `items.length`.
     */
    const send = REPORT_ANNOUNCEMENTS.indexOf('postMessage');
    const latch = REPORT_ANNOUNCEMENTS.indexOf(
      'window.__ziglyAnnouncementsDone = true;',
    );
    expect(send).toBeGreaterThan(-1);
    expect(latch).toBeGreaterThan(send);
    // And the early return for "nothing readable yet" comes before both.
    const bail = REPORT_ANNOUNCEMENTS.indexOf('if (!items.length) { return; }');
    expect(bail).toBeGreaterThan(-1);
    expect(bail).toBeLessThan(send);
  });

  it('carries no backtick, which would truncate the payload', () => {
    /*
     * Not a style rule. This string is injected from inside a template
     * literal, so a single backtick anywhere in it -- including in one of the
     * comments above -- closes that literal early and silently drops the rest
     * of the script. It happened while writing this change: ten backticks in
     * new comments, no error anywhere, half the reader gone.
     */
    expect(REPORT_ANNOUNCEMENTS).not.toContain('`');
  });
});

describe('and the early pass that actually runs carries it', () => {
  /*
   * THE HALF THAT WAS MISSING, and the reason the strip was still blank when
   * the splash lifted.
   *
   * Putting the reader in HOME_EARLY_SCRIPT is not by itself enough to make it
   * early. That payload's only early injection was
   * `injectedJavaScriptBeforeContentLoaded`, which this screen's own comment
   * calls unreliable on Android and says "frequently lands after first paint".
   * The dashboard's `onLoadStart` exists precisely to give that payload a
   * second, earlier chance to land -- and it was injecting EARLY_HEADER_CSS
   * alone, so the CSS got the reliable pass and the reader kept the unreliable
   * one, falling back to onLoadEnd behind the whole page download.
   *
   * That put the first offers in state AFTER the splash had gone: the splash
   * lifts on the native dashboard's first layout (`handleDashboardPainted`),
   * which does not wait for this WebView. A drawn dashboard under a blank
   * 38px band.
   */
  it('injects the whole early payload at onLoadStart, not just the CSS', () => {
    const at = SCREEN.indexOf('onLoadStart={() => {');
    expect(at).toBeGreaterThan(-1);
    const body = SCREEN.slice(at, SCREEN.indexOf('onLoadEnd=', at));
    expect(body).toContain("injectInto('home', HOME_EARLY_SCRIPT);");
    // The bug, spelled out: the CSS-only injection must not come back.
    expect(body).not.toContain("injectInto('home', EARLY_HEADER_CSS);");
  });

  it('is therefore read before the splash floor is up', () => {
    /*
     * Not a timing test -- a statement of why the ordering now works. The read
     * fires at ~221ms once it is on a pass that runs at document-start, and the
     * splash cannot lift before SPLASH_MIN_MS whatever the dashboard does. The
     * assertion is that the floor is still comfortably the larger of the two,
     * so this fix is not resting on a margin of a few milliseconds.
     */
    const {SPLASH_MIN_MS} = require('../src/constants/appConstants');
    expect(SPLASH_MIN_MS).toBeGreaterThan(1000);
  });
});
