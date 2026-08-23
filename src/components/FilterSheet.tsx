/**
 * The filter screen: every facet the site offers, as chips.
 *
 * A full screen rather than a sheet, because the list is long -- a Zigly
 * collection routinely publishes fourteen facets and two hundred values -- and
 * because that is what the reference app shows. It covers the app's own header
 * for the same reason the sort sheet does: while this is up, it is the screen.
 *
 * Every heading, every value and every count is Zigly's own, read off the page
 * by ../webview/facetBridge, and a tap clicks SearchTap's own checkbox. So a
 * chip applies immediately, exactly as the site's own filter does, and the
 * counts on the other chips come back changed. `Apply` therefore only closes
 * the screen -- it is the site's own Apply, which does the same -- and there is
 * no Clear All, because a chip that is on turns off when it is tapped again.
 *
 * A facet with no counted values never arrives here: that is what keeps
 * SearchTap's price slider and its lone out-of-stock toggle out of a screen the
 * app draws as chips. See `parseGroup` in ../listing/facets.
 */
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {CloseIcon} from './glyphs';
import type {Facets} from '../listing/facets';

interface Props {
  visible: boolean;
  facets: Facets;
  /** A tap is in flight: the site is answering and the counts are about to move. */
  busy: boolean;
  /**
   * Both the facet's position and its heading, because that is what the bridge
   * needs to find the right checkbox: two facets here are both called "Flavor".
   */
  onToggle: (groupIndex: number, groupTitle: string, label: string) => void;
  onClose: () => void;
}

const FilterSheet = ({visible, facets, busy, onToggle, onClose}: Props) => {
  /*
   * A Modal is its own window, so it sits outside the inset padding the app
   * applies at its root -- and this one covers the whole screen. Without these
   * the heading would sit under the clock and Apply under the gesture pill. The
   * context reaches here because the provider is above the whole app.
   */
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={[styles.head, {paddingTop: insets.top + 14}]}>
          <Text style={styles.title}>Filters</Text>
          <View style={styles.headRight}>
            {busy ? (
              <ActivityIndicator size="small" color={COLORS.navy} />
            ) : null}
            <Pressable
              onPress={onClose}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel="Close">
              <CloseIcon size={19} color="#1B1B1B" />
            </Pressable>
          </View>
        </View>

        {facets.groups.length === 0 ? (
          <View style={styles.centre}>
            {/*
              Two different nothings, and telling them apart is the point of
              `ready`. Before the site has answered this is a WAIT -- on a
              collection page SearchTap fetches its facets only when something
              asks, so an empty first frame is normal. Once it has answered and
              there is still nothing, this listing genuinely publishes no
              filters, and a spinner would be a lie that never resolves.
            */}
            {facets.ready ? (
              <Text style={styles.none}>No filters for this listing</Text>
            ) : (
              <ActivityIndicator color={COLORS.navy} />
            )}
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body}>
            {facets.groups.map((group, index) => (
              // Two facets on this store are both called "Flavor", so the
              // heading alone is not a key.
              <View key={`${index}-${group.title}`} style={styles.group}>
                <Text style={styles.groupTitle}>{group.title}</Text>
                <View style={styles.chips}>
                  {group.options.map(option => (
                    <Pressable
                      key={option.label}
                      onPress={() => onToggle(index, group.title, option.label)}
                      accessibilityRole="button"
                      accessibilityState={{selected: option.on}}
                      accessibilityLabel={`${option.label}, ${option.count}`}
                      style={({pressed}) => [
                        styles.chip,
                        option.on && styles.chipOn,
                        pressed && styles.pressed,
                      ]}>
                      <Text
                        style={[
                          styles.chipLabel,
                          option.on && styles.chipLabelOn,
                        ]}>
                        {option.label} ({option.count})
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={[styles.foot, {paddingBottom: insets.bottom + 14}]}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Apply"
            style={({pressed}) => [
              styles.apply,
              pressed && styles.applyPressed,
            ]}>
            <Text style={styles.applyLabel}>Apply</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const CHIP_TEXT = '#3A3A3A';

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: COLORS.white},
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  headRight: {flexDirection: 'row', alignItems: 'center', gap: 16},
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 19,
    fontWeight: '600',
    color: '#1B1B1B',
  },
  centre: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  none: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    color: COLORS.inkMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  body: {paddingHorizontal: 18, paddingBottom: 24},
  group: {marginBottom: 20},
  groupTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: 14.5,
    color: '#1B1B1B',
    marginBottom: 10,
  },
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  chip: {
    backgroundColor: '#F1F2F5',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipOn: {backgroundColor: '#1B1B1B'},
  pressed: {opacity: 0.7},
  chipLabel: {fontFamily: FONT_FAMILY, fontSize: 12.5, color: CHIP_TEXT},
  chipLabelOn: {color: COLORS.white},
  foot: {paddingHorizontal: 14, paddingTop: 8},
  apply: {
    minHeight: 52,
    borderRadius: 6,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyPressed: {opacity: 0.85},
  applyLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 16.5,
    fontWeight: '600',
    color: COLORS.white,
  },
});

export default FilterSheet;
