/**
 * The bottom navigation.
 *
 * This app deliberately had no tab bar: the reference app's is drawn by the
 * website (`.fixed-icons`, fixed below 990px), so a native one would have
 * stacked a second bar on top of the site's. Two things about the live site
 * changed that, both verified on 2026-08-22:
 *
 *   1. The site's bar carries four tabs -- Zigly, Collections, Breed-verse,
 *      Wishlist -- and **no Account item at all**. The reference app shows
 *      five. There was nothing to restyle into an Account tab, because there
 *      was nothing there.
 *   2. It lives inside the page, so it disappeared behind every native screen
 *      this app draws: the cart, the wishlist, and now the whole account
 *      section. A tab bar that is missing exactly where the user is is not a
 *      tab bar.
 *
 * So the bar is native and the site's is hidden (see injectedStyles.ts) --
 * never both, which is the one outcome that would be worse than either. The
 * destinations are still the site's own urls, so what the tabs point at stays
 * Zigly's decision; only Wishlist and Account are native screens, because both
 * of those already exist natively in this app.
 *
 * Icons are geometry, like everywhere else here -- see ./glyphs.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, FONT_FAMILY, TABS } from '../constants/appConstants';
import type { TabKey } from '../constants/appConstants';
import {
  GridIcon,
  HeartOutline,
  HeartShape,
  PawIcon,
  PersonIcon,
} from './glyphs';

interface Props {
  /** Which tab is lit, or null when the user is somewhere no tab describes. */
  active: TabKey | null;
  onSelect: (key: TabKey) => void;
  /**
   * Saved-product count, for the badge on the Wishlist tab. 0 hides it.
   *
   * The same number the header's heart carries, from the same state -- see
   * wishlistCount in ../screens/ZiglyWebViewScreen. This bar is why it has to
   * be here as well as there: the header drops the heart on the dashboard and
   * on the wishlist screen itself, and the tab is on screen throughout. Without
   * this the count would simply vanish on the app's own home page, which reads
   * as a wishlist that emptied itself.
   */
  wishlistCount?: number;
}

const ACTIVE = COLORS.navy;
const IDLE = '#5A6472';

const TabIcon = ({ tab, color }: { tab: TabKey; color: string }) => {
  switch (tab) {
    case 'home':
      // The brand's own mark is the red heart; it stays red on both states,
      // as the reference app has it.
      return <HeartShape size={22} color={COLORS.red} />;
    case 'collections':
      return <GridIcon size={21} color={color} />;
    case 'breeds':
      return <PawIcon size={22} color={color} />;
    case 'wishlist':
      return <HeartOutline size={22} color={color} />;
    default:
      return <PersonIcon size={23} color={color} />;
  }
};

const BottomNav = ({ active, onSelect, wishlistCount = 0 }: Props) => (
  <View style={styles.root}>
    {TABS.map(tab => {
      const lit = tab.key === active;
      const color = lit ? ACTIVE : IDLE;
      const count = tab.key === 'wishlist' ? wishlistCount : 0;
      return (
        <Pressable
          key={tab.key}
          onPress={() => onSelect(tab.key)}
          accessibilityRole="tab"
          accessibilityState={{ selected: lit }}
          accessibilityLabel={
            count > 0 ? `${tab.label}, ${count} items` : tab.label
          }
          style={styles.tab}
        >
          {/* The icon and its badge, so the badge is placed against the glyph
              rather than against the whole tab -- the tab is a fifth of the
              screen wide and a counter pinned to its corner would float in
              open space. */}
          <View style={styles.iconWrap}>
            <TabIcon tab={tab.key} color={color} />
            {count > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {count > 99 ? '99+' : String(count)}
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            numberOfLines={1}
            style={[styles.label, { color }, lit && styles.labelActive]}
          >
            {tab.label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: COLORS.ground,
    borderTopWidth: 1,
    borderTopColor: '#E8EDF4',
  },
  tab: {
    // Equal shares, so five tabs divide the width exactly and a long label
    // ("Breed-verse") cannot push its neighbours out of line.
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 7,
    gap: 4,
  },
  /* Wraps the glyph only, so the badge has something glyph-sized to sit on.
     No size of its own: the icons state their own, and a box here would either
     clip one or pad the row. */
  iconWrap: { position: 'relative' },
  /* Deliberately the header's badge, figure for figure -- see NativeHeader's
     `badge`. Two counters for the same wishlist, one above the page and one
     below it, that were drawn differently would read as two different numbers.
     Only the offsets differ, and they differ because the glyph is 22 rather
     than the header's 24-wide button. */
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },
  label: {
    fontFamily: FONT_FAMILY,
    fontSize: 11.5,
    textAlign: 'center',
  },
  labelActive: { fontWeight: '700' },
});

export default BottomNav;
