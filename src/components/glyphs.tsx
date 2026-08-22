/**
 * Icons, drawn from Views.
 *
 * This app has no icon library and no bitmaps, for the reason `EmptyState`
 * spells out: an asset would need three densities and a dependency would be a
 * whole package for a handful of glyphs. Everything here is geometry -- circles,
 * rotated squares, borders -- which costs nothing and scales exactly.
 *
 * `HeartShape` used to live inside NativeHeader. It is here because the bottom
 * navigation and the account screen need the same heart, and a second copy of
 * those proportions would have drifted from the first.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '../constants/appConstants';

interface Glyph {
  size?: number;
  color?: string;
}

/**
 * A filled heart.
 *
 * Proportions tuned so the lobes sit on the square's top edge and its rotated
 * corner forms the point, without either spilling past the box.
 */
export const HeartShape = ({ size = 22, color = '#1B1B1B' }: Glyph) => {
  const lobe = size * 0.52;
  const square = size * 0.7;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: size * 0.02,
          top: size * 0.08,
          width: lobe,
          height: lobe,
          borderRadius: lobe / 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: size * 0.02,
          top: size * 0.08,
          width: lobe,
          height: lobe,
          borderRadius: lobe / 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: (size - square) / 2,
          top: size * 0.22,
          width: square,
          height: square,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
};

/**
 * A heart outline: the filled heart with a smaller one in the ground colour
 * inset over it. The 4px difference leaves a 2px stroke, matching the other
 * icons' weight.
 */
export const HeartOutline = ({
  size = 22,
  color = '#1B1B1B',
  ground = COLORS.white,
}: Glyph & { ground?: string }) => (
  <View style={{ width: size, height: size }}>
    <HeartShape size={size} color={color} />
    <View style={{ position: 'absolute', top: 2, left: 2 }}>
      <HeartShape size={size - 4} color={ground} />
    </View>
  </View>
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
