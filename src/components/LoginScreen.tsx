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
import {DEFAULT_COUNTRY, emojiFlag} from '../account/dialCodes';
import type {DialCountry} from '../account/dialCodes';
import CountryPickerSheet from './CountryPickerSheet';
import {ChevronDown} from './glyphs';

interface Props {
  /** Sent the country and the digits, in that order. */
  onSubmit: (country: DialCountry, phone: string) => void;
  /**
   * What to open on -- so returning from the OTP screen finds the number that
   * was typed rather than an empty field.
   */
  initialCountry?: DialCountry;
  initialPhone?: string;
  /** Shown under the row. Null draws nothing at all. */
  error?: string | null;
}

const LoginScreen = ({
  onSubmit,
  initialCountry = DEFAULT_COUNTRY,
  initialPhone = '',
  error = null,
}: Props) => {
  const [country, setCountry] = useState<DialCountry>(initialCountry);
  const [phone, setPhone] = useState(initialPhone);
  const [pickerOpen, setPickerOpen] = useState(false);

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
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          accessibilityLabel="Mobile number"
          // No placeholder: the reference field is empty but for the caret.
          style={styles.input}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        onPress={() => onSubmit(country, phone)}
        accessibilityRole="button"
        accessibilityLabel="Receive OTP"
        style={({pressed}) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>Receive OTP</Text>
      </Pressable>

      <View style={styles.spacerBelow} />

      <CountryPickerSheet
        visible={pickerOpen}
        selected={country}
        onSelect={setCountry}
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
