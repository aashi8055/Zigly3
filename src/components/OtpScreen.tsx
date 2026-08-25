/**
 * The OTP step, drawn natively.
 *
 * Measured off the reference screenshot only -- not from
 * ../webview/loginRestyle.ts, whose numbers dress the site's own widget and were
 * fitted to a different screen.
 *
 * What the screen is:
 *
 *   white, then "You will receive OTP on <number>", then "Edit phone number"
 *   underlined, then six square boxes in one row, then a small Submit, then the
 *   resend line.
 *
 * No header: the app draws one above every account screen already -- see
 * ../components/NativeHeader -- and that is where the back arrow and the
 * wordmark come from.
 *
 * The vertical placement is a ratio rather than a fixed offset, as on
 * ./LoginScreen: the description sits around two fifths of the way down, with
 * roughly seven tenths as much room above it as below the resend line.
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';

/** Boxes, as the reference draws them. */
export const OTP_LENGTH = 6;

/** The countdown the reference opens on. */
export const RESEND_SECONDS = 30;

interface Props {
  /** The number the code went to, country code included: "+919004976917". */
  phone: string;
  onSubmit: (code: string) => void;
  /** Back to the phone step, keeping what was entered there. */
  onEditPhone: () => void;
  onResend: () => void;
  /** Shown under the boxes. Null draws nothing. */
  error?: string | null;
}

/** Digits only, in order. A character loop, per the project's no-pattern rule. */
const digitsOf = (value: string): string => {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 48 && code <= 57) {
      out += value.charAt(i);
    }
  }
  return out;
};

const EMPTY: string[] = new Array(OTP_LENGTH).fill('');

const OtpScreen = ({
  phone,
  onSubmit,
  onEditPhone,
  onResend,
  error = null,
}: Props) => {
  const [digits, setDigits] = useState<string[]>(EMPTY);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  /** Bumped by Resend, which is how the countdown below starts over. */
  const [run, setRun] = useState(0);
  // The instance type, not the component type: react-native 0.87's TextInput is
  // a function component, so `TextInput` names its props rather than its handle.
  const boxes = useRef<Array<React.ComponentRef<typeof TextInput> | null>>([]);

  /**
   * The countdown.
   *
   * One interval, armed per run rather than a timeout re-armed on every tick:
   * a per-tick timeout makes the clock depend on the render that follows each
   * state change to schedule the next second, which is a clock that can drift or
   * stall under load. This one ticks on its own and stops itself at zero.
   *
   * Keyed on `run` so pressing Resend starts a fresh interval instead of
   * inheriting the remainder of the old one. Cleared on unmount, so it cannot
   * tick into a dead tree.
   */
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft(current => {
        if (current <= 1) {
          clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [run]);

  const code = digits.join('');
  const complete = code.length === OTP_LENGTH;

  /**
   * One box changed.
   *
   * Handles a paste or an SMS autofill in the same path as a keystroke: whatever
   * arrives is reduced to digits and laid across the boxes from this one on, so
   * a six-digit code dropped into the first box fills all six. Focus then moves
   * to the first box still empty.
   */
  const change = (index: number, value: string) => {
    const typed = digitsOf(value);
    const next = digits.slice();
    if (typed.length === 0) {
      next[index] = '';
      setDigits(next);
      return;
    }
    for (let i = 0; i < typed.length && index + i < OTP_LENGTH; i++) {
      next[index + i] = typed.charAt(i);
    }
    setDigits(next);
    const landed = Math.min(index + typed.length, OTP_LENGTH - 1);
    boxes.current[landed]?.focus();
  };

  /** Backspace on an empty box steps back and clears the one before it. */
  const backspace = (index: number) => {
    if (digits[index] !== '' || index === 0) {
      return;
    }
    const next = digits.slice();
    next[index - 1] = '';
    setDigits(next);
    boxes.current[index - 1]?.focus();
  };

  const resend = () => {
    onResend();
    // The visual timer restarts here. Whether the request succeeded is the
    // caller's to know; this is the countdown, not the confirmation.
    setSecondsLeft(RESEND_SECONDS);
    setRun(current => current + 1);
  };

  return (
    <View style={styles.root}>
      <View style={styles.spacerAbove} />

      <Text style={styles.description}>
        You will receive OTP on <Text style={styles.number}>{phone}</Text>
      </Text>

      <Pressable
        onPress={onEditPhone}
        accessibilityRole="button"
        accessibilityLabel="Edit phone number"
        style={({pressed}) => [styles.editWrap, pressed && styles.pressed]}
      >
        <Text style={styles.edit}>Edit phone number</Text>
      </Pressable>

      <View style={styles.boxes}>
        {digits.map((digit, index) => (
          <TextInput
            key={index}
            ref={node => {
              boxes.current[index] = node;
            }}
            value={digit}
            onChangeText={value => change(index, value)}
            onKeyPress={({nativeEvent}) => {
              if (nativeEvent.key === 'Backspace') {
                backspace(index);
              }
            }}
            keyboardType="number-pad"
            // Long enough to accept a pasted or autofilled code in one box,
            // which `change` above then spreads across the row.
            maxLength={OTP_LENGTH}
            selectTextOnFocus
            // Platform OTP autofill. iOS reads the code from the message with
            // the first, Android with the second.
            textContentType="oneTimeCode"
            autoComplete={index === 0 ? 'sms-otp' : 'off'}
            accessibilityLabel={`Digit ${index + 1} of ${OTP_LENGTH}`}
            style={styles.box}
          />
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        onPress={() => onSubmit(code)}
        accessibilityRole="button"
        accessibilityLabel="Submit"
        style={({pressed}) => [
          styles.submit,
          complete && styles.submitReady,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.submitText}>Submit</Text>
      </Pressable>

      {secondsLeft > 0 ? (
        <Text style={styles.resend}>{`Resend OTP in ${secondsLeft}s`}</Text>
      ) : (
        <View style={styles.resendRow}>
          <Text style={styles.resend}>Didn't receive OTP?</Text>
          <Pressable
            onPress={resend}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Resend OTP"
            style={({pressed}) => pressed && styles.pressed}
          >
            <Text style={styles.resendAction}>Resend OTP</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.spacerBelow} />
    </View>
  );
};

/** The border the boxes share. */
const BORDER = '#9AA7B8';

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: COLORS.white},

  /* The reference's proportion: a little over two fifths of the way down. */
  spacerAbove: {flex: 0.7},
  spacerBelow: {flex: 1},

  description: {
    fontFamily: FONT_FAMILY,
    paddingHorizontal: 24,
    fontSize: 15,
    lineHeight: 21,
    color: '#5A6472',
    textAlign: 'center',
  },
  /** The number itself, as the reference weights it. */
  number: {fontWeight: '700', color: '#1B1B1B'},

  editWrap: {alignSelf: 'center', marginTop: 5},
  edit: {
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    color: '#5A6472',
    textDecorationLine: 'underline',
    textAlign: 'center',
  },

  /* Six squares, one row, equally spaced and centred. */
  boxes: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 9,
    marginTop: 30,
  },
  box: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    // Zero padding, or Android insets the digit and it stops reading as centred.
    padding: 0,
    fontFamily: FONT_FAMILY,
    fontSize: 20,
    color: '#1B1B1B',
    textAlign: 'center',
    backgroundColor: COLORS.white,
  },

  error: {
    fontFamily: FONT_FAMILY,
    marginTop: 10,
    paddingHorizontal: 24,
    fontSize: 13,
    color: COLORS.red,
    textAlign: 'center',
  },

  /*
   * Small and centred, sized to its label -- not a full-width action. Grey
   * until all six boxes carry a digit.
   *
   * Appearance only: the press is never swallowed, so an incomplete code still
   * reaches the caller and still gets whatever answer it gives.
   */
  submit: {
    alignSelf: 'center',
    marginTop: 18,
    paddingHorizontal: 24,
    height: 34,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#808080',
  },
  submitReady: {backgroundColor: COLORS.navy},
  submitText: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.white,
  },

  resend: {
    fontFamily: FONT_FAMILY,
    marginTop: 20,
    fontSize: 13.5,
    color: '#5A6472',
    textAlign: 'center',
  },
  /** The expired state: what happened, and the way to act on it. */
  resendRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
  },
  resendAction: {
    fontFamily: FONT_FAMILY,
    marginTop: 20,
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.red,
  },

  pressed: {opacity: 0.7},
});

export default OtpScreen;
