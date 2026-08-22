/**
 * Empty screens: a glyph, a headline, optional body copy and an optional way out.
 *
 * Two glyphs, because the reference app uses two. The cart shows a smiling bag
 * with a headline and a "Continue Shopping" button; lists like the wishlist show
 * a wireframe box over a bare "No items".
 *
 * Both are geometry rather than assets, which keeps this app free of an icon
 * dependency and of a bitmap that would need three densities:
 *
 *   box  An isometric cube's silhouette is a regular hexagon. Each side is
 *        `SIDE` long and opposite sides are `SIDE * √3` apart, so one bordered
 *        rectangle draws two of them and three at 0°/60°/120° draw all six,
 *        meeting exactly at the vertices. Centre-to-vertex is also `SIDE`, so
 *        the three interior edges are lines in the top half of a full-height
 *        wrapper, rotated to alternating vertices — the top face and two sides.
 *
 *   bag  A rounded rectangle outline, folded corners as two short diagonals,
 *        and a smile made from the bottom edge of a wide box whose bottom
 *        corners are fully rounded. Sparks above, dashes either side.
 */
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';

export type EmptyGlyph = 'box' | 'bag';

interface Props {
  /** Headline. The whole message when `body` is absent, e.g. "No items". */
  title: string;
  body?: string;
  /** Renders a button only when both of these are given. */
  actionLabel?: string;
  onAction?: () => void;
  glyph?: EmptyGlyph;
}

/* ---------------------------------------------------------------- box glyph */

/** Hexagon side: also the centre-to-vertex distance, and each spoke's length. */
const SIDE = 36;
const STROKE = 2.5;
const BOX_W = SIDE * Math.sqrt(3);
const BOX_H = SIDE * 2;

const BoxGlyph = () => (
  <View style={styles.boxGlyph}>
    {/* Six outline edges, two per bordered rectangle. */}
    {[0, 60, 120].map(deg => (
      <View
        key={'edge' + deg}
        style={[styles.edgePair, {transform: [{rotate: deg + 'deg'}]}]}
      />
    ))}
    {/* Three interior edges, meeting at the centre. */}
    {[0, 120, 240].map(deg => (
      <View
        key={'spoke' + deg}
        style={[styles.spokeWrap, {transform: [{rotate: deg + 'deg'}]}]}>
        <View style={styles.spoke} />
      </View>
    ))}
  </View>
);

/* ---------------------------------------------------------------- bag glyph */

const BagGlyph = () => (
  <View style={styles.bagGlyph}>
    {/* Sparks. */}
    <View style={[styles.spark, styles.sparkLeft]} />
    <View style={styles.sparkMiddle} />
    <View style={[styles.spark, styles.sparkRight]} />

    {/* Motion dashes either side, as the reference has them. */}
    <View style={[styles.dash, styles.dashLeft]} />
    <View style={[styles.dash, styles.dashRight]} />

    <View style={styles.bagBody}>
      {/* Folded top corners. */}
      <View style={[styles.fold, styles.foldLeft]} />
      <View style={[styles.fold, styles.foldRight]} />
      {/* Smile: the bottom edge of a box with fully rounded bottom corners. */}
      <View style={styles.smile} />
    </View>
  </View>
);

const EmptyState = ({title, body, actionLabel, onAction, glyph = 'box'}: Props) => (
  <View style={styles.root}>
    {glyph === 'bag' ? <BagGlyph /> : <BoxGlyph />}

    <Text style={body ? styles.title : styles.titleAlone}>{title}</Text>
    {body ? <Text style={styles.body}>{body}</Text> : null}

    {actionLabel && onAction ? (
      <Pressable
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        style={({pressed}) => [styles.action, pressed && styles.pressed]}>
        <Text style={styles.actionText}>{actionLabel}</Text>
      </Pressable>
    ) : null}
  </View>
);

const BOX_LINE = '#C9CDD3';
const BAG_LINE = '#333333';
const BAG_W = 92;
const BAG_H = 82;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  // ---- box
  boxGlyph: {width: BOX_W, height: BOX_H},
  /** One rectangle, bordered left and right: two opposite hexagon sides. */
  edgePair: {
    position: 'absolute',
    left: 0,
    top: SIDE / 2,
    width: BOX_W,
    height: SIDE,
    borderLeftWidth: STROKE,
    borderRightWidth: STROKE,
    borderColor: BOX_LINE,
  },
  /**
   * Full height and centred, so rotating it turns the line inside about the
   * glyph's centre rather than about the line's own middle.
   */
  spokeWrap: {
    position: 'absolute',
    left: (BOX_W - STROKE) / 2,
    top: 0,
    width: STROKE,
    height: BOX_H,
  },
  spoke: {
    position: 'absolute',
    top: 0,
    width: STROKE,
    height: SIDE,
    backgroundColor: BAG_LINE,
    opacity: 0.22,
  },

  // ---- bag
  bagGlyph: {width: BAG_W + 60, height: BAG_H + 34, alignItems: 'center'},
  bagBody: {
    position: 'absolute',
    bottom: 0,
    width: BAG_W,
    height: BAG_H,
    borderWidth: 2.2,
    borderColor: BAG_LINE,
    borderRadius: 4,
    backgroundColor: '#FCFCFD',
    alignItems: 'center',
  },
  fold: {
    position: 'absolute',
    top: 5,
    width: 15,
    height: 2.2,
    backgroundColor: BAG_LINE,
  },
  foldLeft: {left: 1, transform: [{rotate: '45deg'}]},
  foldRight: {right: 1, transform: [{rotate: '-45deg'}]},
  smile: {
    marginTop: 26,
    width: 30,
    height: 15,
    borderBottomWidth: 2.2,
    borderColor: BAG_LINE,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },

  spark: {
    position: 'absolute',
    top: 4,
    width: 2.2,
    height: 17,
    borderRadius: 2,
    backgroundColor: BAG_LINE,
  },
  sparkLeft: {left: 42, transform: [{rotate: '32deg'}]},
  sparkRight: {right: 42, transform: [{rotate: '-32deg'}]},
  sparkMiddle: {
    position: 'absolute',
    top: 0,
    width: 2.2,
    height: 19,
    borderRadius: 2,
    backgroundColor: BAG_LINE,
  },

  dash: {
    position: 'absolute',
    bottom: 12,
    width: 18,
    height: 2.2,
    borderRadius: 2,
    backgroundColor: BAG_LINE,
  },
  dashLeft: {left: 0},
  dashRight: {right: 0},

  // ---- copy
  title: {
    fontFamily: FONT_FAMILY,
    marginTop: 30,
    fontSize: 23,
    fontWeight: '700',
    color: '#1B1B1B',
    textAlign: 'center',
  },
  /** With no body copy beneath it, the headline carries the whole screen. */
  titleAlone: {
    fontFamily: FONT_FAMILY,
    marginTop: 26,
    fontSize: 25,
    color: COLORS.ink,
    textAlign: 'center',
  },
  body: {
    fontFamily: FONT_FAMILY,
    marginTop: 12,
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.inkMuted,
    textAlign: 'center',
  },

  action: {
    marginTop: 26,
    backgroundColor: '#1B1B1B',
    borderRadius: 8,
    paddingHorizontal: 34,
    paddingVertical: 15,
  },
  pressed: {opacity: 0.85},
  actionText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default EmptyState;
