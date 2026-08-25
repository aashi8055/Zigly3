/**
 * The country selector, as a bottom sheet.
 *
 * A sheet and not a dropdown: the reference screen opens something that covers
 * essentially the whole screen from the bottom, with a search field at the top
 * and the list under it. Two hundred countries in a popover anchored to a 64dp
 * cell is a scroll nobody can aim at.
 *
 * Built on core `Modal`, like ./SelectSheet, ./SortSheet and ./FilterSheet
 * already are -- `animationType="slide"` is the platform's own upward
 * transition, so the sheet animates in from the bottom without this file owning
 * an Animated value. That is also why there is no gesture handler here: nothing
 * else in this app has one, and a sheet that closes on a drag but nowhere else
 * would be the only such surface in it.
 */
import React, {useMemo, useState} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {
  DIAL_COUNTRIES,
  emojiFlag,
  filterCountries,
} from '../account/dialCodes';
import type {DialCountry} from '../account/dialCodes';
import {CloseIcon} from './glyphs';

interface Props {
  visible: boolean;
  /** Ticked in the list, so the sheet opens showing where the user already is. */
  selected: DialCountry;
  onSelect: (country: DialCountry) => void;
  onClose: () => void;
}

const CountryPickerSheet = ({
  visible,
  selected,
  onSelect,
  onClose,
}: Props) => {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const shown = useMemo(
    () => filterCountries(DIAL_COUNTRIES, query),
    [query],
  );

  const close = () => {
    // Cleared on the way out, as ./SelectSheet clears its filter and for the
    // same reason: reopening onto an abandoned search reads as the app having
    // remembered something the user did not ask it to.
    setQuery('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={close}
    >
      {/* The strip of screen the sheet does not cover. Tapping it closes, which
          is the gesture the scrim exists for. */}
      <Pressable
        style={[styles.backdrop, {height: insets.top + BACKDROP_H}]}
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={close}
      />

      <View style={[styles.sheet, {paddingBottom: insets.bottom}]}>
        <View style={styles.head}>
          <Text style={styles.title}>Select country</Text>
          <Pressable
            onPress={close}
            hitSlop={14}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <CloseIcon size={16} color="#1B1B1B" />
          </Pressable>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor="#8C97A8"
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Search countries"
          style={styles.search}
        />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
        >
          {shown.length === 0 ? (
            <Text style={styles.none}>No matches</Text>
          ) : (
            shown.map(country => {
              const lit = country.iso2 === selected.iso2;
              return (
                <Pressable
                  key={country.iso2}
                  onPress={() => {
                    onSelect(country);
                    close();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{selected: lit}}
                  accessibilityLabel={`${country.name}, plus ${country.dial}`}
                  style={({pressed}) => [
                    styles.row,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.flag}>{emojiFlag(country.iso2)}</Text>
                  <Text
                    style={[styles.name, lit && styles.nameSelected]}
                    numberOfLines={1}
                  >
                    {country.name}
                  </Text>
                  <Text style={styles.dial}>{`+${country.dial}`}</Text>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

/** How much of the screen is left uncovered above the sheet. */
const BACKDROP_H = 34;

const styles = StyleSheet.create({
  backdrop: {backgroundColor: 'rgba(15, 33, 59, 0.35)'},
  /** Everything below the strip above: the sheet is the rest of the screen. */
  sheet: {
    flex: 1,
    backgroundColor: COLORS.ground,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDF4',
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 17,
    fontWeight: '700',
    color: '#1B1B1B',
  },
  search: {
    fontFamily: FONT_FAMILY,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: '#DDE3EC',
    borderRadius: 8,
    fontSize: 15,
    color: '#1B1B1B',
  },
  list: {paddingVertical: 6},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  pressed: {backgroundColor: '#F2F4F8'},
  flag: {fontSize: 22},
  name: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    color: '#1B1B1B',
  },
  nameSelected: {fontWeight: '700', color: COLORS.navy},
  dial: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    color: COLORS.inkMuted,
  },
  none: {
    fontFamily: FONT_FAMILY,
    padding: 22,
    fontSize: 15,
    color: COLORS.inkMuted,
    textAlign: 'center',
  },
});

export default CountryPickerSheet;
