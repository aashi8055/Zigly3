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
import {ActivityIndicator, Image, Text} from 'react-native';
import SplashScreen from '../src/screens/SplashScreen';
import {COLORS} from '../src/constants/appConstants';

const render = () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<SplashScreen />);
  });
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

  it('keeps a spinner, in a colour that shows on white', () => {
    // A white spinner on a white ground is an empty space where something is
    // plainly meant to be.
    const [spinner] = render().root.findAllByType(ActivityIndicator);
    expect(spinner).toBeDefined();
    expect(spinner.props.color).toBe(COLORS.navy);
    expect(spinner.props.color).not.toBe(COLORS.white);
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
