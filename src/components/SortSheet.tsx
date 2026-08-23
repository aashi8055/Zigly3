/**
 * The sort sheet: the five sorts, over a dimmed listing.
 *
 * Rises from the foot of the screen because that is where the control that
 * opened it is, and covers everything above it -- the announcement bar, the
 * header, the search band -- because a sheet that dims only part of the screen
 * reads as a panel inside the page rather than as a decision the app is waiting
 * on. That is why this is a `Modal` and not a view inside the page stack.
 *
 * The options are the site's own, in the site's own order, read off the page by
 * ../webview/facetBridge; selecting one clicks SearchTap's own button. The tick
 * moves on the tap rather than on the answer -- see `selectSort` in
 * ../listing/facets -- and the sheet closes, so the customer is looking at the
 * results changing rather than at a panel they have finished with.
 */
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {CheckIcon, CloseIcon} from './glyphs';

interface Props {
  visible: boolean;
  options: string[];
  /** The applied sort, ticked and shaded. */
  selected: string;
  onSelect: (label: string) => void;
  onClose: () => void;
}

const SortSheet = ({
  visible,
  options,
  selected,
  onSelect,
  onClose,
}: Props) => {
  /*
   * A Modal is its own window, outside the inset padding the app applies at its
   * root. Only the bottom matters here -- the sheet rises from the foot of the
   * screen, which is where the gesture pill is.
   */
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
        />

        <View style={[styles.sheet, {paddingBottom: insets.bottom + 10}]}>
          <View style={styles.head}>
            <Text style={styles.title}>Sort</Text>
            <Pressable
              onPress={onClose}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel="Close">
              <CloseIcon size={19} color="#1B1B1B" />
            </Pressable>
          </View>

          <ScrollView bounces={false} contentContainerStyle={styles.list}>
            {options.map(option => {
              const on = option === selected;
              return (
                <Pressable
                  key={option}
                  onPress={() => {
                    if (!on) {
                      onSelect(option);
                    }
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{selected: on}}
                  style={({pressed}) => [
                    styles.row,
                    on && styles.rowOn,
                    pressed && !on && styles.pressed,
                  ]}>
                  <Text style={styles.rowLabel}>{option}</Text>
                  {on ? <CheckIcon size={18} color="#1B1B1B" /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, justifyContent: 'flex-end'},
  backdrop: {flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)'},
  sheet: {
    backgroundColor: COLORS.white,
    maxHeight: '62%',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 20,
    fontWeight: '600',
    color: '#1B1B1B',
  },
  list: {paddingBottom: 6},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    minHeight: 58,
  },
  /** The applied sort sits on a shaded row, as the reference has it. */
  rowOn: {backgroundColor: '#F1F1F1'},
  pressed: {backgroundColor: '#F7F8FA'},
  rowLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 17,
    color: '#1B1B1B',
    /**
     * SearchTap's own label for the default is "Best selling". The site draws
     * it title-cased and so does the reference app, and this is the one place
     * the app is allowed to disagree with the string: the value sent back is
     * always the site's, untouched.
     */
    textTransform: 'capitalize',
  },
});

export default SortSheet;
