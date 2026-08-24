/**
 * The splash.
 *
 * It is the first thing anyone sees, and it had been drifting from the real
 * app: a navy field, a wordmark drawn from Views, and a tagline this app had
 * written for itself. What is defended here is that it stays white, that the
 * mark is Zigly's own artwork rather than something redrawn, and that nothing
 * on it is copy we invented.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Image, Text} from 'react-native';
import SplashScreen from '../src/screens/SplashScreen';
import {COLORS} from '../src/constants/appConstants';

/**
 * Every tree rendered here, so it can be taken down again.
 *
 * The splash arms a looping breathe animation on the logo, and its cleanup is
 * what cancels it. A tree that is never unmounted never runs that cleanup, so
 * the animation woke up after Jest had torn the environment down and reached
 * for an `Animated` that was no longer there: a hard crash of the worker, on a
 * suite that otherwise reported itself green.
 */
const trees: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  ReactTestRenderer.act(() => {
    while (trees.length) {
      trees.pop()?.unmount();
    }
  });
});

const render = () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<SplashScreen />);
  });
  trees.push(tree);
  return tree;
};

/** Flatten whatever a style prop happens to be into one object. */
const styleOf = (node: {props: {style?: unknown}}): Record<string, unknown> => {
  const raw = node.props.style;
  const parts = Array.isArray(raw) ? raw.flat(Infinity) : [raw];
  return Object.assign({}, ...parts.filter(Boolean));
};

describe('the splash', () => {
  it('is white, not the old navy field', () => {
    // The page behind it is white while it loads and so is the app's ground, so
    // lifting the splash is a fade between two whites rather than a navy sheet
    // snapping away from a bright page.
    const [root] = render().root.findAll(
      node => node.props.accessibilityRole === 'progressbar',
    );
    expect(styleOf(root).backgroundColor).toBe(COLORS.white);
    expect(styleOf(root).backgroundColor).not.toBe(COLORS.navy);
  });

  it("shows Zigly's own artwork, not a redrawn wordmark", () => {
    const images = render().root.findAllByType(Image);
    expect(images).toHaveLength(1);
    expect(images[0].props.source).toBeTruthy();
  });

  it('never stretches the mark', () => {
    // It is a wordmark; a few percent of stretch is the kind of wrong that is
    // felt without being noticed.
    expect(render().root.findAllByType(Image)[0].props.resizeMode).toBe(
      'contain',
    );
  });

  it('carries no copy of its own', () => {
    // "Everything your pet needs" was this app's line, not Zigly's.
    expect(render().root.findAllByType(Text)).toHaveLength(0);
  });
});

describe('the status bar behind it', () => {
  it('uses dark icons, now that the splash is white', () => {
    // It used to flip to light-content while the splash was up, which was right
    // for a navy field and is invisible on this one.
    const src = require('fs').readFileSync('App.tsx', 'utf8');
    expect(src).toContain('barStyle="dark-content"');
    expect(src).not.toContain("'light-content'");
  });
});

describe('when the splash comes down', () => {
  const shell = () =>
    require('fs').readFileSync('src/screens/ZiglyWebViewScreen.tsx', 'utf8');
  const app = () => require('fs').readFileSync('App.tsx', 'utf8');

  it('waits for the dashboard to report itself assembled', () => {
    /*
     * The bug this pins. The splash used to lift on the dashboard's own
     * onLoadEnd, and a load ending is the *document* arriving, not the page:
     * the sections this app transplants are assembled by scripts that run at
     * that moment and after it. So the customer was handed a home page still
     * filling itself in -- the 100-300ms "twitch" the whole splash exists to
     * prevent. It now waits for `dashboard-ready`; see ../src/webview/
     * readySignal.
     */
    const s = shell();
    const at = s.indexOf("data.tag === 'dashboard-ready'");
    expect(at).toBeGreaterThan(-1);
    expect(s.slice(at, at + 400)).toContain('retireSplash()');
  });

  it('does not lift on the document load event', () => {
    // The one place it must not happen. What load end arms is the grace period
    // below, not the reveal.
    const s = shell();
    const at = s.indexOf('const handleLoadEnd = useCallback(');
    expect(at).toBeGreaterThan(-1);
    const handler = s.slice(at, s.indexOf('  );', at));
    expect(handler).not.toContain('onFirstLoad()');
    expect(handler).toContain('SPLASH_READY_GRACE_MS');
  });

  it('has a deadline for a ready signal that never comes', () => {
    // An injection that did not run, or a page shape the watcher does not
    // recognise, must not cost the whole of SPLASH_MAX_MS.
    const {
      SPLASH_MAX_MS,
      SPLASH_MIN_MS,
      SPLASH_READY_GRACE_MS,
    } = require('../src/constants/appConstants');
    expect(SPLASH_READY_GRACE_MS).toBeGreaterThan(SPLASH_MIN_MS);
    expect(SPLASH_READY_GRACE_MS).toBeLessThan(SPLASH_MAX_MS);
  });

  it('lifts for the error screen, which it would otherwise hide', () => {
    const s = shell();
    const at = s.indexOf("warn('load error:'");
    expect(at).toBeGreaterThan(-1);
    expect(s.slice(at, at + 400)).toContain('retireSplash()');
  });

  it('lifts once and only once', () => {
    // Three callers, one of them a timer that may already have been beaten to
    // it. The guard is what stops the second one re-running App's reveal.
    const s = shell();
    const at = s.indexOf('const retireSplash = useCallback(');
    expect(at).toBeGreaterThan(-1);
    const body = s.slice(at, at + 600);
    expect(body).toContain('if (firstLoadDone.current)');
    expect(body).toContain('clearTimeout(splashGrace.current)');
  });

  it('fades rather than being cut away, and never comes back', () => {
    /*
     * Two failures in one test, because they are the same mistake seen from
     * either end. A splash unmounted the instant the app is ready changes on a
     * single frame boundary, which the eye reports as a glitch; and a reveal
     * driven by a value that can go back down would show the page and then put
     * a loader over it again. So: an opacity animation with an unmount at the
     * end of it, latched on inputs that only ever go true.
     */
    const s = app();
    expect(s).toContain('SPLASH_FADE_MS');
    expect(s).toContain('setSplashGone(true)');
    expect(s).toContain('const ready = minElapsed && webReady;');
    // Gone only when the fade finished, never on `ready` alone.
    expect(s).toContain('{splashGone ? null : (');
    expect(s).not.toContain('splashVisible');
  });

  it('stops swallowing taps as soon as the page is ready', () => {
    // The page underneath is finished; holding taps for the length of the fade
    // would make it feel dead at the very moment it arrived.
    expect(app()).toContain("pointerEvents={ready ? 'none' : 'auto'}");
  });
});

describe('the launcher icon is the real one', () => {
  const png = (path: string) => require('fs').readFileSync(path);

  it('is a PNG at every density, under the names the manifest asks for', () => {
    // The manifest points at @mipmap/ic_launcher and @mipmap/ic_launcher_round.
    // Keeping both names and the .png extension is what let the artwork change
    // without touching the manifest or the Gradle config at all.
    for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
      for (const name of ['ic_launcher', 'ic_launcher_round']) {
        const file = png(
          `android/app/src/main/res/mipmap-${density}/${name}.png`,
        );
        // The source files arrived named .webp but were PNG all along; a real
        // WebP under a .png name is the mistake this catches.
        expect(file.toString('hex', 0, 8)).toBe('89504e470d0a1a0a');
      }
    }
  });

  it('is the expected size for each density', () => {
    const expected: Record<string, number> = {
      mdpi: 48,
      hdpi: 72,
      xhdpi: 96,
      xxhdpi: 144,
      xxxhdpi: 192,
    };
    for (const [density, size] of Object.entries(expected)) {
      const file = png(
        `android/app/src/main/res/mipmap-${density}/ic_launcher.png`,
      );
      expect(file.readUInt32BE(16)).toBe(size);
      expect(file.readUInt32BE(20)).toBe(size);
    }
  });

  it('ships the splash mark at every density Metro looks for', () => {
    // Metro resolves @1.5x/@2x/@3x/@4x from the base name; a missing one is a
    // blurry logo on exactly the devices that have the best screens.
    for (const suffix of ['', '@1.5x', '@2x', '@3x', '@4x']) {
      expect(() => png(`src/assets/zigly-logo${suffix}.png`)).not.toThrow();
    }
  });
});
