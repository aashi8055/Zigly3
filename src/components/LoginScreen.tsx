/**
 * Login With OTP -- the phone-number step, drawn natively.
 *
 * Every measurement here is read off the reference screenshot and nothing else.
 * In particular it is NOT taken from ../webview/loginRestyle.ts: that stylesheet
 * dresses the site's own widget, its numbers were fitted to a different screen,
 * and reusing them is how this screen came to be wrong the first time.
 *
 * What the screen is, and all it is:
 *
 *   a lot of white, then "Login With OTP", then one bordered row holding the
 *   country selector and the number, then Receive OTP.
 *
 * No header: the app draws one above every screen in the account section (see
 * ../components/NativeHeader, mounted by ../screens/ZiglyWebViewScreen), which
 * is where the back arrow and the wordmark come from. A second one here would be
 * two.
 *
 * The vertical position is proportional rather than a fixed top offset. In the
 * reference the title sits a little under half way down, with roughly nine
 * tenths as much space above it as below the button -- so the two spacers carry
 * that ratio and the block lands in the same place on a short phone as on a tall
 * one. A fixed `paddingTop` matching one device is a screen that is wrong on
 * every other.
 */
import React, {useState} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {
  DEFAULT_COUNTRY,
  digitsOnly,
  emojiFlag,
  validatePhone,
} from '../account/dialCodes';
import type {DialCountry} from '../account/dialCodes';
import CountryPickerSheet from './CountryPickerSheet';
import {ChevronDown} from './glyphs';

interface Props {
  /**
   * Sent the country and the digits, in that order -- and only ever a number
   * that passed ../account/dialCodes' rules for that country. A caller can
   * therefore treat this as "send an OTP", not as "consider sending one".
   */
  onSubmit: (country: DialCountry, phone: string) => void;
  /**
   * What to open on -- so returning from the OTP screen finds the number that
   * was typed rather than an empty field.
   */
  initialCountry?: DialCountry;
  initialPhone?: string;
  /**
   * Shown under the row. Null draws nothing at all.
   *
   * This is the *provider's* verdict, forwarded by the caller. What the field
   * itself refuses is decided here; see `press` below for why the two are kept
   * apart.
   */
  error?: string | null;
  /**
   * A send is out and has not been answered yet.
   *
   * Presses are ignored while it is true, which is the whole of its job: the
   * widget behind this screen charges for an SMS, and a second tap during the
   * second it takes to hear back sends a second one. Drawn as the press state
   * and nothing more -- the reference screen has no spinner on it, and adding
   * one would be inventing UI the brief does not ask for.
   */
  busy?: boolean;
}

const LoginScreen = ({
  onSubmit,
  initialCountry = DEFAULT_COUNTRY,
  initialPhone = '',
  error = null,
  busy = false,
}: Props) => {
  const [country, setCountry] = useState<DialCountry>(initialCountry);
  const [phone, setPhone] = useState(initialPhone);
  const [pickerOpen, setPickerOpen] = useState(false);
  /**
   * What this screen itself refused, as opposed to what the provider refused.
   *
   * Two sources, one line of red under the row. Kept apart because they expire
   * differently: a local complaint is answered by the next keystroke, and a
   * provider's is not this screen's to withdraw.
   */
  const [localError, setLocalError] = useState<string | null>(null);

  /**
   * Receive OTP.
   *
   * Validated here rather than by the caller, because this is where the country
   * and the number are: a caller that had to be handed both in order to check
   * them would be a caller that could also be handed an unchecked pair, and the
   * cost of that is an SMS to a number that cannot receive one.
   */
  const press = () => {
    if (busy) {
      return;
    }
    const said = validatePhone(country, phone);
    setLocalError(said);
    if (said !== null) {
      return;
    }
    // Digits only: what the customer typed may carry the spaces a keypad
    // offers, and the widget behind this screen wants the bare number.
    onSubmit(country, digitsOnly(phone));
  };

  /**
   * Changing the country re-judges the number against the new country's rules
   * rather than leaving a complaint that was about the old one's. The number
   * itself is kept -- a customer correcting the country has not changed their
   * mind about their number.
   */
  const chooseCountry = (next: DialCountry) => {
    setCountry(next);
    setLocalError(null);
  };

  const shown = localError ?? error;

  return (
    <View style={styles.root}>
      {/* The white above the block. See the note on proportions above. */}
      <View style={styles.spacerAbove} />

      <Text style={styles.title}>Login With OTP</Text>

      {/*
        One row, one border. The country cell and the number share it, divided
        by a hairline -- not two boxes with a gap, which is what the reference
        does not show.
      */}
      <View style={styles.row}>
        <Pressable
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Country, ${country.name}, plus ${country.dial}`}
          style={({pressed}) => [styles.country, pressed && styles.pressed]}
        >
          <Text style={styles.flag}>{emojiFlag(country.iso2)}</Text>
          <ChevronDown size={13} color="#1B1B1B" />
          <Text style={styles.dial}>{`+${country.dial}`}</Text>
        </Pressable>

        <View style={styles.separator} />

        <TextInput
          value={phone}
          onChangeText={value => {
            setPhone(value);
            // The complaint was about what was there a keystroke ago.
            setLocalError(null);
          }}
          keyboardType="phone-pad"
          autoComplete="tel"
          // The keyboard's own Done sends, so the customer never has to put it
          // away to reach a button it is sitting on.
          returnKeyType="done"
          onSubmitEditing={press}
          accessibilityLabel="Mobile number"
          // No placeholder: the reference field is empty but for the caret.
          style={styles.input}
        />
      </View>

      {shown ? <Text style={styles.error}>{shown}</Text> : null}

      <Pressable
        onPress={press}
        accessibilityRole="button"
        accessibilityLabel="Receive OTP"
        accessibilityState={{disabled: busy}}
        style={({pressed}) => [
          styles.button,
          (pressed || busy) && styles.pressed,
        ]}
      >
        <Text style={styles.buttonText}>Receive OTP</Text>
      </Pressable>

      <View style={styles.spacerBelow} />

      <CountryPickerSheet
        visible={pickerOpen}
        selected={country}
        onSelect={chooseCountry}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
};

/** The row's own border colour, and the hairline dividing it. */
const BORDER = '#9AA7B8';
/** Side margin. The row and the button share it, as the reference has them. */
const GUTTER = 16;

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: COLORS.white},

  /*
   * The ratio the reference sets: the title sits just under half way down, so
   * there is a little less room above the block than below it. Weights rather
   * than heights, so this holds on any screen.
   */
  spacerAbove: {flex: 0.87},
  spacerBelow: {flex: 1},

  title: {
    fontFamily: FONT_FAMILY,
    marginBottom: 22,
    fontSize: 17,
    fontWeight: '500',
    color: '#1B1B1B',
    textAlign: 'center',
  },

  row: {
    flexDirection: 'row',
    // Stretch, so the divider is the full height of the row and meets both
    // borders rather than floating inside it.
    alignItems: 'stretch',
    marginHorizontal: GUTTER,
    height: 52,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    // Keeps the divider and the field's own corners inside the radius.
    overflow: 'hidden',
    backgroundColor: COLORS.white,
  },
  country: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  flag: {fontSize: 20},
  dial: {
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    color: '#1B1B1B',
  },
  separator: {width: 1, backgroundColor: BORDER},
  input: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    color: '#1B1B1B',
  },

  error: {
    fontFamily: FONT_FAMILY,
    marginHorizontal: GUTTER,
    marginTop: 7,
    fontSize: 13,
    color: COLORS.red,
  },

  /* Pale red ground, red type, and the row's own width. */
  button: {
    marginHorizontal: GUTTER,
    marginTop: 14,
    height: 46,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDECEC',
  },
  buttonText: {
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.red,
  },

  pressed: {opacity: 0.7},
});

export default LoginScreen;
