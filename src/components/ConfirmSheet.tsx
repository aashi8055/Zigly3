/**
 * A yes/no question, asked from the foot of the screen.
 *
 * WHY NOT `Alert.alert`. The account screen's Delete Account already uses one,
 * and a native alert is the quickest thing to reach for -- but it is an OS
 * dialog in the middle of the screen, drawn in the platform's own furniture,
 * and it looks like nothing else in this app. Every other decision this app
 * waits on is asked at the bottom: the sort sheet, the filter sheet, the
 * variant picker. A confirmation is a decision like those, and it is asked
 * where the finger already is rather than in the centre of the screen where
 * nothing else appears.
 *
 * Modelled on ./SortSheet, as ./VariantSheet is, and for the same reason: same
 * Modal, same rise from the foot, same dimmed backdrop, same row metrics. The
 * customer already knows how a sheet in this app behaves.
 *
 * DESTRUCTIVE BY DEFAULT IS WRONG HERE, so it is a prop. Logging out is
 * reversible -- sign in again -- and painting it red would overstate it;
 * deleting something is not. The caller says which, because the caller is the
 * only thing that knows.
 */
import React from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';

interface Props {
  visible: boolean;
  /** The question. Short: it is a heading, not a paragraph. */
  title: string;
  /** One line of consequence, or nothing when the title says it all. */
  message?: string | null;
  /** The label on the button that goes ahead. */
  confirmLabel: string;
  /** The label on the way out. "Cancel" unless the caller has a better word. */
  cancelLabel?: string;
  /**
   * True when going ahead cannot be undone, which paints the confirm row red.
   *
   * False for a sign-out: it is a tap away from being undone, and a red button
   * would tell the customer this is more serious than it is.
   */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmSheet = ({
  visible,
  title,
  message = null,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: Props) => {
  /*
   * A Modal is its own window, outside the inset padding the app applies at
   * its root, so the sheet has to pad itself off the gesture pill. Only the
   * bottom matters: it rises from the foot of the screen. Same as ./SortSheet.
   */
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onCancel}>
      <View style={styles.root}>
        {/*
          Tapping outside cancels. That is the safe answer to every question
          this sheet asks -- a stray tap must never be the one that signs the
          customer out.
        */}
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          onPress={onCancel}
        />

        <View style={[styles.sheet, {paddingBottom: insets.bottom + 12}]}>
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
          </View>

          {/*
            Confirm first, then cancel, reading downwards.

            Deliberate: the button nearest the thumb is the last one in the
            column, and that should be the harmless one. A customer reaching
            without looking lands on Cancel.
          */}
          <Pressable
            onPress={onConfirm}
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
            style={({pressed}) => [
              styles.button,
              styles.confirm,
              destructive && styles.confirmDestructive,
              pressed && styles.pressed,
            ]}>
            <Text
              style={[
                styles.confirmLabel,
                destructive && styles.confirmLabelDestructive,
              ]}>
              {confirmLabel}
            </Text>
          </Pressable>

          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
            style={({pressed}) => [
              styles.button,
              styles.cancel,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.cancelLabel}>{cancelLabel}</Text>
          </Pressable>
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
    paddingHorizontal: 20,
    paddingTop: 22,
    gap: 10,
  },
  head: {paddingBottom: 6, gap: 6},
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 20,
    fontWeight: '600',
    color: '#1B1B1B',
  },
  message: {
    fontFamily: FONT_FAMILY,
    fontSize: 14.5,
    lineHeight: 21,
    color: '#6B7280',
  },
  button: {
    minHeight: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * The pale fill with a red label -- BUTTON_FILL's pairing, which is what
   * this app's secondary actions look like. Not solid red: a sign-out is not
   * the loudest thing on the screen, and `destructive` below is what escalates
   * a question that genuinely cannot be undone.
   */
  confirm: {backgroundColor: '#FDECEC'},
  confirmDestructive: {backgroundColor: COLORS.red},
  confirmLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.red,
  },
  confirmLabelDestructive: {color: COLORS.white},
  cancel: {backgroundColor: '#F4F6F9'},
  cancelLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    fontWeight: '600',
    color: '#1B1B1B',
  },
  pressed: {opacity: 0.85},
});

export default ConfirmSheet;
