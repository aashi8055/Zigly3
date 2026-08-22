/**
 * A picker for one value out of a list.
 *
 * React Native dropped `Picker` from core, and the community replacements are a
 * native dependency each -- for two fields on one form. This is a Modal with a
 * list in it, which is what those packages are on Android anyway.
 *
 * The filter field is not decoration: the country list from the shop is 240-odd
 * entries, and scrolling to Zimbabwe is not a checkout experience. It appears
 * only when the list is long enough to need it.
 */
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { COLORS, FONT_FAMILY } from '../constants/appConstants';

/** Above this many options the list gets a filter field. */
export const FILTER_THRESHOLD = 12;

interface Props {
  visible: boolean;
  title: string;
  options: string[];
  /** The current value, highlighted in the list. */
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

const SelectSheet = ({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: Props) => {
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return options;
    }
    return options.filter(
      option => option.toLowerCase().indexOf(trimmed) !== -1,
    );
  }, [options, query]);

  const close = () => {
    // Cleared on the way out: reopening to somebody else's half-typed filter
    // would look like the app had remembered a search that was abandoned.
    setQuery('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={close}
    >
      <Pressable
        style={styles.backdrop}
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={close}
      />
      <View style={styles.sheet}>
        <View style={styles.head}>
          <Text style={styles.title}>{title}</Text>
          <Pressable
            onPress={close}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>

        {options.length > FILTER_THRESHOLD ? (
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor="#8C97A8"
            autoCorrect={false}
            style={styles.filter}
          />
        ) : null}

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
        >
          {shown.length === 0 ? (
            <Text style={styles.none}>No matches</Text>
          ) : (
            shown.map(option => (
              <Pressable
                key={option}
                onPress={() => {
                  onSelect(option);
                  close();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: option === selected }}
                style={({ pressed }) => [
                  styles.option,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    option === selected && styles.optionSelected,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 33, 59, 0.35)' },
  sheet: {
    // Two thirds of the screen, so the field being filled stays in view above.
    maxHeight: '70%',
    backgroundColor: COLORS.ground,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingBottom: 8,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDF4',
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 17,
    fontWeight: '700',
    color: '#1B1B1B',
  },
  close: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.navy,
  },
  filter: {
    fontFamily: FONT_FAMILY,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: '#DDE3EC',
    borderRadius: 8,
    fontSize: 15,
    color: '#1B1B1B',
  },
  list: { paddingVertical: 6 },
  option: { paddingHorizontal: 18, paddingVertical: 14 },
  pressed: { backgroundColor: '#F2F4F8' },
  optionText: { fontFamily: FONT_FAMILY, fontSize: 16, color: '#1B1B1B' },
  optionSelected: { fontWeight: '700', color: COLORS.navy },
  none: {
    fontFamily: FONT_FAMILY,
    padding: 22,
    fontSize: 15,
    color: COLORS.inkMuted,
    textAlign: 'center',
  },
});

export default SelectSheet;
