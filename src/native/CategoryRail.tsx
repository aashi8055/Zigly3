/**
 * The category circles, drawn natively.
 *
 * The first section of the dashboard to leave the WebView. It is the right one
 * to go first for three reasons: it is the topmost thing under the search band,
 * so the speed is the speed the customer feels; its content is the site's own
 * theme settings rather than live product data; and ../components/Skeleton
 * already reserves its exact shape, so there is a placeholder to hand over from.
 *
 * DRAWN AS A NATIVE RAIL, NOT AS THE SITE DRAWS IT. The brief is the app's
 * styling in a React Native idiom, not a transcription of the theme's CSS, so
 * this is a `ScrollView` with real momentum and real overscroll rather than the
 * `overflow-x: auto` box ../webview/injectedStyles had to graft onto a dead
 * Swiper. Two things are still taken from the site deliberately, because they
 * are the section's identity rather than its implementation: the pale disc
 * (`#e8eef5`, the theme's own `bg_color`) and the eight labels and destinations.
 *
 * WHAT THE WEB VERSION HAD TO WORK AROUND AND THIS DOES NOT. On the dashboard
 * the rail is a transplanted copy, so its Swiper never initialises and every
 * circle past the fifth was on the page and unreachable until a native-scroll
 * rule was added (see the long note in ../webview/injectedStyles). None of that
 * exists here: a ScrollView scrolls because it is a ScrollView.
 *
 * THE HAND-OFF HAS TO LAND ON THE SKELETON'S GEOMETRY. `HomeSkeleton` draws
 * five circles at 18% width each, `space-between`, with an 8px gap to a label.
 * If this rail used a different size or pitch the dashboard would visibly jump
 * at the moment the placeholder came off -- which is the specific defect this
 * app treats as unacceptable. `CIRCLE` and the paddings below are chosen so
 * five discs and their gaps fill the same width the skeleton claimed.
 */
import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {
  CATEGORIES,
  fetchCategoryIcons,
  loadCategoryIcons,
  saveCategoryIcons,
  type CategoryItem,
  type IconMap,
} from './categoryIcons';
import {useSectionData} from './useSectionData';

/**
 * The disc, and the pitch it sits on.
 *
 * Sized from the skeleton rather than from the theme's 70px: five cells must
 * span the screen the way `HomeSkeleton`'s five 18%-wide cells do, and on a
 * 360dp phone that is a 60dp disc on a 72dp pitch. Fixed dp rather than a
 * percentage because a horizontal ScrollView has no width to take a percentage
 * of -- its content is as wide as its children.
 */
const CIRCLE = 60;
const PITCH = 12;

/** The theme's own `bg_color` for this section, behind a transparent PNG. */
const DISC = '#e8eef5';

type Props = {
  /**
   * Where a tap goes. A storefront path (`/pages/dog`), handed up rather than
   * navigated here, so this component stays drawable in a test and the screen
   * keeps the single decision about how a path is opened.
   */
  onOpen: (path: string) => void;
};

/**
 * One circle.
 *
 * An icon that has not resolved falls back to the label's initial on the same
 * disc, so the cell keeps its size, its label and its tap target. That is the
 * degradation ../webview/instagramSection settled on and the reason the icons
 * are safe to learn from the network at all: the rail is never missing, only
 * ever unillustrated.
 */
const Circle = ({
  item,
  icon,
  onOpen,
}: {
  item: CategoryItem;
  icon?: string;
  onOpen: (path: string) => void;
}) => (
  <Pressable
    onPress={() => onOpen(item.path)}
    accessibilityRole="link"
    accessibilityLabel={item.label}
    style={styles.cell}
    // The disc is 60dp but the cell is the target, so the whole column
    // including the label is tappable -- a 60dp circle is the minimum and the
    // label is the part a thumb aims at.
    hitSlop={4}
  >
    {({pressed}) => (
      <>
        <View style={[styles.disc, pressed && styles.discPressed]}>
          {icon ? (
            <Image
              source={{uri: icon}}
              style={styles.icon}
              // `contain`: these are transparent PNGs of a whole animal or
              // object, and `cover` would crop the subject at the disc's edge.
              resizeMode="contain"
              accessible={false}
            />
          ) : (
            <Text style={styles.initial}>{item.label.charAt(0)}</Text>
          )}
        </View>
        <Text numberOfLines={1} style={styles.label}>
          {item.label}
        </Text>
      </>
    )}
  </Pressable>
);

const CategoryRail = ({onOpen}: Props) => {
  /**
   * The labels are never waited for.
   *
   * `CATEGORIES` is the theme's own block list, read at build time, so the rail
   * is complete and tappable on the very first frame with or without a network.
   * Only the pictures are learned -- which is why this section has no loading
   * state at all and no skeleton of its own: there is nothing to wait for.
   */
  const {data: icons} = useSectionData<IconMap>({
    load: loadCategoryIcons,
    fetcher: signal => fetchCategoryIcons(signal),
    save: learned => saveCategoryIcons(learned),
    isEmpty: map => !map || Object.keys(map).length === 0,
    empty: EMPTY_ICONS,
  });

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.track}
      style={styles.root}
      // The rail is short and the page under it is long, so a horizontal drag
      // that starts a few degrees off should still scroll the rail rather than
      // handing the gesture to the page.
      directionalLockEnabled
    >
      {CATEGORIES.map(item => (
        <Circle
          key={item.key}
          item={item}
          icon={icons[item.key]}
          onOpen={onOpen}
        />
      ))}
    </ScrollView>
  );
};

/**
 * A stable empty map.
 *
 * `{}` written inline would be a new object every render, and `useSectionData`
 * holds it as the initial state -- a fresh identity each time is a needless
 * change of a value the hook compares against.
 */
const EMPTY_ICONS: IconMap = {};

const styles = StyleSheet.create({
  root: {
    // The section's own vertical rhythm, matching `HomeSkeleton`'s `circles`
    // block so the hand-off does not shift the banner below it.
    marginBottom: 18,
  },
  track: {
    // The gutter belongs to the track, not the scroller: padding on a
    // horizontal ScrollView's own box is scrolled away at the start and
    // dropped at the end on older Android, which is the exact defect the
    // coupon strip hit (see ../webview/injectedStyles). On the content
    // container it is part of the scrollable width and both ends keep it.
    paddingHorizontal: PITCH,
    alignItems: 'flex-start',
  },
  cell: {
    width: CIRCLE,
    alignItems: 'center',
    marginRight: PITCH,
  },
  disc: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: DISC,
    alignItems: 'center',
    justifyContent: 'center',
    // Clip the artwork to the disc: several of the theme's icons are drawn to
    // the edge of their canvas and would otherwise square off the circle.
    overflow: 'hidden',
    marginBottom: 8,
  },
  /**
   * The press state, and it is on the disc rather than the whole cell.
   *
   * A scale on the cell would move the label, which reads as the row twitching.
   * The web version does this with a `:hover` background swap to the theme's
   * `#183761`, which has no meaning on a touch device -- a brief dim is the
   * native equivalent of the same intent.
   */
  discPressed: {
    opacity: 0.62,
  },
  icon: {
    // Inset from the disc so the artwork has a margin inside the circle, which
    // is how the theme's own 70px wrapper around a 70px image reads once its
    // border is accounted for.
    width: CIRCLE * 0.78,
    height: CIRCLE * 0.78,
  },
  /** The fallback mark when an icon has not resolved. */
  initial: {
    fontFamily: FONT_FAMILY,
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.navy,
  },
  label: {
    fontFamily: FONT_FAMILY,
    // The theme sets 1.4rem/600 at #2B2B2A. 11.5 rather than 14 because the
    // theme's rem base is 62.5% (1.4rem = 14px CSS px on a wider viewport),
    // and because the label must not wrap under a 60dp disc -- "New Pet Parent"
    // is the constraint, and it is why this is the size it is.
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: '600',
    color: '#2B2B2A',
    textAlign: 'center',
  },
});

export default CategoryRail;
