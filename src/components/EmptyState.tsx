/**
 * The "No items" empty state, drawn as the reference app draws it: a wireframe
 * box outline above a single line of text, centred on a light ground, with no
 * call to action. Getting out is the header's back arrow.
 *
 * The box is geometry rather than an asset or an icon font. An isometric cube's
 * silhouette is a regular hexagon, and its three interior edges run from the
 * centre to every other vertex — so the whole glyph is three pairs of parallel
 * lines plus three spokes, which plain Views can draw exactly:
 *
 *   - each hexagon side is `SIDE` long, and opposite sides are `SIDE * √3`
 *     apart, so one bordered rectangle draws two of them; three rectangles at
 *     0°, 60° and 120° draw all six, meeting precisely at the vertices.
 *   - centre-to-vertex on a regular hexagon is also `SIDE`, so each spoke is a
 *     line occupying the top half of a full-height wrapper, rotated about the
 *     centre. 0°, 120°, 240° lands them on alternating vertices, which is the
 *     top face and the two side faces.
 *
 * Exact by construction, so it cannot drift at other sizes, and it keeps this
 * app free of an icon dependency for one glyph.
 */
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';

interface Props {
  /** The single line beneath the glyph, e.g. "No items". */
  label: string;
}

/** Hexagon side, which is also the centre-to-vertex distance and the spoke length. */
const SIDE = 36;
const STROKE = 2.5;
const GLYPH_W = SIDE * Math.sqrt(3);
const GLYPH_H = SIDE * 2;
const LINE = '#C9CDD3';

const BoxGlyph = () => (
  <View style={styles.glyph}>
    {/* Six outline edges, two per rectangle. */}
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

const EmptyState = ({label}: Props) => (
  <View style={styles.root}>
    <BoxGlyph />
    <Text style={styles.label}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: {flex: 1, alignItems: 'center', justifyContent: 'center'},

  glyph: {width: GLYPH_W, height: GLYPH_H},

  /**
   * One rectangle, bordered left and right: two opposite sides of the hexagon,
   * the right distance apart and the right length.
   */
  edgePair: {
    position: 'absolute',
    left: 0,
    top: SIDE / 2,
    width: GLYPH_W,
    height: SIDE,
    borderLeftWidth: STROKE,
    borderRightWidth: STROKE,
    borderColor: LINE,
  },

  /**
   * Full height and centred, so rotating it turns the line inside about the
   * glyph's centre rather than about the line's own middle.
   */
  spokeWrap: {
    position: 'absolute',
    left: (GLYPH_W - STROKE) / 2,
    top: 0,
    width: STROKE,
    height: GLYPH_H,
  },
  spoke: {
    position: 'absolute',
    top: 0,
    width: STROKE,
    height: SIDE,
    backgroundColor: LINE,
  },

  label: {
    fontFamily: FONT_FAMILY,
    marginTop: 26,
    fontSize: 25,
    color: COLORS.ink,
  },
});

export default EmptyState;
