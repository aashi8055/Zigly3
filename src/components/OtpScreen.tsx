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
  ActivityIndicator,
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
  /**
   * Bumped by the caller when a resend actually went out.
   *
   * The countdown restarts on THIS and not on the press, which is the
   * difference between a timer that means something and one that is decoration.
   * The press only asks: the widget behind this screen may refuse -- its own
   * cooldown, its own captcha -- and a clock that reset itself anyway would
   * tell the customer to wait thirty seconds for a message nobody sent.
   */
  resendToken?: number;
  /**
   * A submit or a resend is out and has not been answered.
   *
   * Presses are ignored while it is true, and Submit SPINS.
   *
   * It did not use to. This screen was drawn from the reference screenshot,
   * which carries no spinner, and a note here said so -- but the screenshot is
   * of a button at rest and says nothing about the second after a press. What
   * is actually waited on is a round trip through the site's own widget (see
   * ../webview/otpDriver), and the only thing that moved in that window was the
   * press opacity, which ends with the finger. A correct code on a slow
   * connection therefore looked like a Submit that had done nothing, and the
   * customer pressed again -- which is the same misread the wishlist tiles, the
   * rail cards and the product bar each grew a spinner to end.
   */
  busy?: boolean;
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
  resendToken = 0,
  busy = false,
}: Props) => {
  const [digits, setDigits] = useState<string[]>(EMPTY);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
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
   * Keyed on `resendToken` so a resend the caller confirmed starts a fresh
   * interval instead of inheriting the remainder of the old one. Cleared on
   * unmount, so it cannot tick into a dead tree.
   */
  useEffect(() => {
    setSecondsLeft(RESEND_SECONDS);
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
  }, [resendToken]);

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
    if (busy) {
      return;
    }
    // Asked, not restarted. The clock is the caller's to restart, by bumping
    // resendToken once the widget has actually sent again -- see the prop.
    onResend();
  };

  const submit = () => {
    if (busy) {
      return;
    }
    onSubmit(code);
  };

  return (
    <View style={styles.root}>
      <View style={styles.spacerAbove} />

      {/*
        One line, always. The brief asks for it in so many words, and the two
        pieces are one sentence: broken over two lines the number reads as a
        heading with a caption under it rather than as the end of the sentence
        it finishes. `adjustsFontSizeToFit` is what keeps the promise on a
        narrow phone or at a large system font size -- the alternative to
        shrinking is truncating, and a number with its last digits replaced by
        an ellipsis is worse than a number a point smaller.
      */}
      <Text
        style={styles.description}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
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
            // The first box takes the caret as the screen arrives, so the
            // keyboard is already up and the customer types the code they are
            // reading rather than tapping a box first.
            autoFocus={index === 0}
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
        onPress={submit}
        accessibilityRole="button"
        accessibilityLabel="Submit"
        accessibilityState={{disabled: busy, busy}}
        style={({pressed}) => [
          styles.submit,
          complete && styles.submitReady,
          /*
           * No dimming while it SPINS, only while it is pressed. A spinner
           * already says the button is working; fading it at the same time
           * reads as disabled, which is the opposite message.
           */
          pressed && !busy && styles.pressed,
        ]}
      >
        {busy ? (
          /*
           * White, because this button is navy once the code is complete --
           * and a submit is only ever in flight from that state, so the
           * default dark spinner would be very nearly invisible on it.
           *
           * `small` is 20dp, inside the button's 34dp, and the label it
           * replaces is a 15pt line -- so the two are close enough in height
           * that the button does not resize under the customer's finger. The
           * width is pinned by `submitBusy` for the same reason: "Submit" is
           * wider than a disc, and a button that shrinks mid-press looks like
           * a different button.
           */
          <ActivityIndicator size="small" color={COLORS.white} />
        ) : (
          <Text style={styles.submitText}>Submit</Text>
        )}
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
            accessibilityState={{disabled: busy}}
            style={({pressed}) => (pressed || busy) && styles.pressed}
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
    /*
     * A FLOOR, so the spinner cannot shrink the button.
     *
     * The width is otherwise the label's, and an ActivityIndicator is a fixed
     * 20dp -- narrower than "Submit" at 15pt with 24 of padding each side. So
     * swapping one for the other would visibly contract the button at the
     * moment of the press, which reads as the button being taken away rather
     * than being waited on. Measured off the label's own box, so the resting
     * button is unchanged and only the spinning one is held out to meet it.
     */
    minWidth: 108,
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
