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

const BottomNav = ({ active, onSelect }: Props) => (
  <View style={styles.root}>
    {TABS.map(tab => {
      const lit = tab.key === active;
      const color = lit ? ACTIVE : IDLE;
      return (
        <Pressable
          key={tab.key}
          onPress={() => onSelect(tab.key)}
          accessibilityRole="tab"
          accessibilityState={{ selected: lit }}
          accessibilityLabel={tab.label}
          style={styles.tab}
        >
          <TabIcon tab={tab.key} color={color} />
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
    backgroundColor: COLORS.white,
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
  label: {
    fontFamily: FONT_FAMILY,
    fontSize: 11.5,
    textAlign: 'center',
  },
  labelActive: { fontWeight: '700' },
});

export default BottomNav;
