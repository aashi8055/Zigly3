/**
 * Icons, drawn from Views -- with one exception.
 *
 * This app has no icon library and no bitmaps, for the reason `EmptyState`
 * spells out: an asset would need three densities and a dependency would be a
 * whole package for a handful of glyphs. So the tab bar's grid, the paw, the
 * person and the chevrons are geometry -- circles, rotated squares, borders --
 * which costs nothing and scales exactly.
 *
 * The heart is the exception, and the note above it says why: it is the one
 * shape stacked Views cannot draw honestly, and it is also the most-seen icon in
 * the app. It is a real path, and Zigly's own.
 *
 * The heart lives here rather than in NativeHeader because the bottom
 * navigation, the account screen and the wishlist tiles all need the same one,
 * and every copy of it had already drifted from the others.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface Glyph {
  size?: number;
  color?: string;
}

/* -------------------------------------------------------------------------- *
 * The heart
 *
 * This is Zigly's own heart, not one of ours. The path below is lifted verbatim
 * from the `swym-add-to-wishlist` button the theme renders on every product
 * card, along with its viewBox and its stroke width -- so the heart in the
 * bottom bar, in the header and on a wishlist tile is the same drawing the
 * customer sees on the website. Read from the live product card on 2026-08-22.
 *
 * It used to be geometry: two circles for the lobes and a rotated square whose
 * corner made the point, stacked in Views. That is the standard trick and it is
 * how every other glyph in this file still works, but a heart is the one shape
 * it cannot do. The lobes meet the square along a visible seam, the point is a
 * hard 90-degree corner where the real icon has a rounded tip, and the outline
 * variant had to be faked by laying a smaller heart in the background colour
 * over a larger one -- which only gives an even stroke if the two are exactly
 * concentric, and at these sizes they never are. So the outline was heavier at
 * the top than at the point, and it read as a blob rather than as an icon.
 *
 * A real path fixes all of that at once, and costs one dependency
 * (react-native-svg) that the outline also needs for a true stroke rather than
 * an inset silhouette. NOTE: it is a native module, so a JS-only reload will not
 * show it -- the app needs `npm install` and an Android rebuild.
 * -------------------------------------------------------------------------- */

/** Zigly's own wishlist heart. Do not retrace by hand; re-read it from a card. */
const HEART_PATH =
  'M10.3148 1C5.15109 1 0.964844 5.30432 0.964844 10.6137C0.964844 20.2274 ' +
  '12.0148 28.9671 17.9648 31C23.9148 28.9671 34.9648 20.2274 34.9648 ' +
  '10.6137C34.9648 5.30432 30.7786 1 25.6148 1C22.4528 1 19.6563 2.61423 ' +
  '17.9648 5.08495C17.1027 3.82224 15.9573 2.79172 14.6256 2.08066C13.294 ' +
  '1.36959 11.8153 0.998912 10.3148 1Z';

/** Theirs too. The path's coordinates only make sense against this box. */
const HEART_VIEWBOX = '0 0 36 32';

/**
 * Their stroke weight, kept as-is.
 *
 * The path is drawn inset by half of it, which is why the box is 32 tall for a
 * 31-tall heart: scaling the stroke with the icon rather than pinning it to a
 * pixel value is what keeps a 16px heart and a 22px heart looking like the same
 * icon at two sizes.
 */
const HEART_STROKE = 1.26789;

/**
 * The heart, filled or outlined.
 *
 * `Svg` is given a square box while the viewBox is 36x32, so the default
 * `preserveAspectRatio` letterboxes the drawing inside it rather than stretching
 * it. That is deliberate: every caller lays this out as a square of `size`, and
 * an honest 36:32 box here would shift the bottom bar and the header by a pixel
 * or two for no gain.
 */
const Heart = ({
  size,
  color,
  filled,
}: {
  size: number;
  color: string;
  filled: boolean;
}) => (
  <Svg width={size} height={size} viewBox={HEART_VIEWBOX}>
    <Path
      d={HEART_PATH}
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth={HEART_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/**
 * A filled heart -- a saved item, and the brand's own mark in the bottom bar.
 *
 * Stroked as well as filled, so its silhouette is identical to the outline's and
 * the two do not appear to change size when one replaces the other.
 */
export const HeartShape = ({ size = 22, color = '#1B1B1B' }: Glyph) => (
  <Heart size={size} color={color} filled />
);

/**
 * A heart outline -- an item not saved.
 *
 * `ground` is accepted and ignored. It used to be the colour of the inset heart
 * that faked the stroke, and every caller passed the background it happened to
 * sit on; a real stroke needs no such thing. Kept in the signature so no call
 * site had to change, and so a stray `ground` does not become a type error.
 */
export const HeartOutline = ({
  size = 22,
  color = '#1B1B1B',
}: Glyph & { ground?: string }) => (
  <Heart size={size} color={color} filled={false} />
);

/** Four rounded squares: the collections tab, as the reference app draws it. */
export const GridIcon = ({ size = 22, color = '#1B1B1B' }: Glyph) => {
  const cell = size * 0.42;
  const gap = size - cell * 2;
  return (
    <View
      style={{ width: size, height: size, justifyContent: 'space-between' }}
    >
      {[0, 1].map(row => (
        <View
          key={row}
          style={{ flexDirection: 'row', justifyContent: 'space-between' }}
        >
          {[0, 1].map(col => (
            <View
              key={col}
              style={{
                width: cell,
                height: cell,
                borderWidth: 1.8,
                borderColor: color,
                borderRadius: 3,
                marginRight: col === 0 ? gap : 0,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

/** A paw: four toes over a wider pad. Breed-verse. */
export const PawIcon = ({ size = 22, color = '#1B1B1B' }: Glyph) => {
  const toe = size * 0.24;
  const pad = size * 0.52;
  return (
    <View style={{ width: size, height: size }}>
      {[0.02, 0.28, 0.54, 0.78].map((left, index) => (
        <View
          key={left}
          style={{
            position: 'absolute',
            left: size * left,
            // The middle two toes sit higher, which is what reads as a paw
            // rather than as four dots in a row.
            top: index === 1 || index === 2 ? 0 : size * 0.14,
            width: toe,
            height: toe * 1.2,
            borderRadius: toe,
            borderWidth: 1.6,
            borderColor: color,
          }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          left: (size - pad) / 2,
          bottom: 0,
          width: pad,
          height: pad * 0.82,
          borderWidth: 1.6,
          borderColor: color,
          borderTopLeftRadius: pad * 0.6,
          borderTopRightRadius: pad * 0.6,
          borderBottomLeftRadius: pad * 0.4,
          borderBottomRightRadius: pad * 0.4,
        }}
      />
    </View>
  );
};

/**
 * A head over shoulders inside a ring: the account tab.
 *
 * The reference app shows a photographic avatar there. A drawn person is the
 * honest equivalent -- this app has no avatar to show and will not ship a stock
 * face standing in for the customer.
 */
export const PersonIcon = ({ size = 24, color = '#1B1B1B' }: Glyph) => {
  const head = size * 0.3;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.8,
        borderColor: color,
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          marginTop: size * 0.14,
          width: head,
          height: head,
          borderRadius: head / 2,
          borderWidth: 1.8,
          borderColor: color,
        }}
      />
      <View
        style={{
          marginTop: size * 0.06,
          width: size * 0.62,
          height: size * 0.4,
          borderWidth: 1.8,
          borderColor: color,
          borderTopLeftRadius: size * 0.31,
          borderTopRightRadius: size * 0.31,
        }}
      />
    </View>
  );
};

/** A parcel: the orders row. An isometric cube in outline. */
export const BoxIcon = ({ size = 22, color = '#1B1B1B' }: Glyph) => (
  <View style={{ width: size, height: size, justifyContent: 'center' }}>
    <View
      style={{
        width: size,
        height: size * 0.84,
        borderWidth: 1.8,
        borderColor: color,
        borderRadius: 3,
      }}
    />
    {/* The lid seam, which is what makes it read as a parcel and not a square. */}
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: size * 0.34,
        height: 1.8,
        backgroundColor: color,
      }}
    />
  </View>
);

/** A map pin: the address row. */
export const PinIcon = ({ size = 22, color = '#1B1B1B' }: Glyph) => {
  const body = size * 0.72;
  return (
    <View style={{ width: size, height: size, alignItems: 'center' }}>
      <View
        style={{
          width: body,
          height: body,
          borderWidth: 1.8,
          borderColor: color,
          borderTopLeftRadius: body / 2,
          borderTopRightRadius: body / 2,
          borderBottomLeftRadius: body / 2,
          // The one square corner, rotated to the bottom, is the point.
          borderBottomRightRadius: 0,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: size * 0.24,
          width: size * 0.24,
          height: size * 0.24,
          borderRadius: size * 0.12,
          borderWidth: 1.8,
          borderColor: color,
        }}
      />
    </View>
  );
};

/** The disclosure chevron on a settings row. */
export const ChevronRight = ({ size = 14, color = '#1B1B1B' }: Glyph) => (
  <View
    style={{
      width: size * 0.62,
      height: size * 0.62,
      borderTopWidth: 1.8,
      borderRightWidth: 1.8,
      borderColor: color,
      transform: [{ rotate: '45deg' }],
    }}
  />
);

/** The chevron a select field carries, pointing down. */
export const ChevronDown = ({ size = 14, color = '#1B1B1B' }: Glyph) => (
  <View style={styles.chevronDownBox}>
    <View
      style={{
        width: size * 0.62,
        height: size * 0.62,
        borderBottomWidth: 1.8,
        borderRightWidth: 1.8,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
      }}
    />
  </View>
);

const styles = StyleSheet.create({
  chevronDownBox: { alignItems: 'center', justifyContent: 'center' },
});
