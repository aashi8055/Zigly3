/**
 * Add or edit an address.
 *
 * The fields are Shopify's, not this app's: every one of them is a
 * `customer_address` form field, in the order the reference app lists them, and
 * saving posts them under those names to `/account/addresses`. Nothing is
 * invented and nothing is dropped, which is what makes an address saved here
 * usable by the website's checkout.
 *
 * Country and State come from the shop's own country dataset
 * (`/services/countries.js`), which is also where the *labels* come from: India
 * calls the subdivision a State and the postcode a PIN code, other countries
 * call them other things, and Shopify already knows which. A country with no
 * subdivisions has no State field at all, exactly as Shopify's own form does --
 * showing an empty dropdown there would be asking for something that does not
 * exist.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { COLORS, FONT_FAMILY } from '../constants/appConstants';
import type { AddressFields, Country } from '../account/accountData';
import { addressIsSavable, defaultCountry } from '../account/accountData';
import SelectSheet from './SelectSheet';
import { ChevronDown } from './glyphs';

interface Props {
  /** The values to open with: blank for a new address, the saved ones to edit. */
  initial: AddressFields;
  /** The shop's countries, or [] while they are still being fetched. */
  countries: Country[];
  /** True while a save is in flight. */
  saving: boolean;
  /** Set when the last save came back unconfirmed. */
  error: string | null;
  onSave: (fields: AddressFields) => void;
}

/** Which of the two dropdowns is open, if either. */
type Sheet = 'country' | 'province' | null;

const AddressFormScreen = ({
  initial,
  countries,
  saving,
  error,
  onSave,
}: Props) => {
  const [fields, setFields] = useState<AddressFields>(initial);
  const [sheet, setSheet] = useState<Sheet>(null);
  /** Set by a Save that could not go through, so the reason sits by the field. */
  const [touched, setTouched] = useState(false);

  const set = (key: keyof AddressFields) => (value: string) =>
    setFields(prev => ({ ...prev, [key]: value }));

  /**
   * Open on the shop's home country once its list has arrived.
   *
   * An effect rather than an initial value because the list is fetched when this
   * screen opens, so on a first visit it is not there yet at mount. Only ever
   * fills a blank: a country the customer has chosen, or one read off an address
   * being edited, is never overwritten.
   */
  useEffect(() => {
    if (countries.length === 0) {
      return;
    }
    const fallback = defaultCountry(countries);
    if (!fallback) {
      return;
    }
    setFields(prev =>
      prev.country ? prev : { ...prev, country: fallback.name },
    );
  }, [countries]);

  const country = useMemo(
    () => countries.find(entry => entry.name === fields.country) ?? null,
    [countries, fields.country],
  );

  const provinces = country ? country.provinces : [];
  const provinceLabel = country ? country.provinceLabel : 'State';
  const zipLabel = country ? country.zipLabel : 'Zip/Postal Code';

  const chooseCountry = (name: string) => {
    setFields(prev => ({
      ...prev,
      country: name,
      // The old state belongs to the old country. Keeping "Maharashtra" while
      // the country said Germany would post an address Shopify rejects.
      province: '',
    }));
  };

  const savable = addressIsSavable(fields) && !saving;

  const submit = () => {
    setTouched(true);
    if (!savable) {
      return;
    }
    onSave(fields);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Field
          label="First Name"
          value={fields.first_name}
          onChange={set('first_name')}
          autoCapitalize="words"
        />
        <Field
          label="Last Name"
          value={fields.last_name}
          onChange={set('last_name')}
          autoCapitalize="words"
        />
        <Field
          label="Phone Number"
          value={fields.phone}
          onChange={set('phone')}
          keyboardType="phone-pad"
        />
        <Field
          label="Company"
          value={fields.company}
          onChange={set('company')}
        />
        <Field
          label="Address"
          value={fields.address1}
          onChange={set('address1')}
        />
        <Field
          label="Apartment, suite, etc. (optional)"
          value={fields.address2}
          onChange={set('address2')}
        />

        <Select
          label="Country"
          value={fields.country}
          // Nothing to choose from until the shop's list has arrived; the field
          // says so rather than opening an empty sheet.
          placeholder={
            countries.length === 0 ? 'Loading countries…' : 'Country'
          }
          disabled={countries.length === 0}
          onPress={() => setSheet('country')}
        />

        {/* Hidden for countries Shopify records no subdivisions for. */}
        {provinces.length > 0 ? (
          <Select
            label={provinceLabel}
            value={fields.province}
            placeholder={provinceLabel}
            disabled={false}
            onPress={() => setSheet('province')}
          />
        ) : null}

        <Field label="City" value={fields.city} onChange={set('city')} />
        <Field
          label={zipLabel}
          value={fields.zip}
          onChange={set('zip')}
          autoCapitalize="characters"
        />

        {touched && !addressIsSavable(fields) ? (
          <Text style={styles.error}>
            Address, City and Country are needed to save.
          </Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={submit}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Save address"
          style={({ pressed }) => [
            styles.save,
            !savable && styles.saveIdle,
            pressed && styles.pressed,
          ]}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </Pressable>
      </ScrollView>

      <SelectSheet
        visible={sheet === 'country'}
        title="Country"
        options={countries.map(entry => entry.name)}
        selected={fields.country}
        onSelect={chooseCountry}
        onClose={() => setSheet(null)}
      />
      <SelectSheet
        visible={sheet === 'province'}
        title={provinceLabel}
        options={provinces}
        selected={fields.province}
        onSelect={set('province')}
        onClose={() => setSheet(null)}
      />
    </View>
  );
};

/**
 * One text field.
 *
 * The label is the placeholder, as the reference app's form has it: ten stacked
 * boxes each with a label above it would not fit a phone screen without
 * scrolling past the Save button.
 */
const Field = ({
  label,
  value,
  onChange,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboardType?: 'phone-pad';
  autoCapitalize?: 'words' | 'characters';
}) => (
  <View style={styles.box}>
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={label}
      placeholderTextColor="#8C97A8"
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize ?? 'sentences'}
      autoCorrect={false}
      accessibilityLabel={label}
      style={styles.input}
    />
  </View>
);

/** One dropdown: a pressable box that opens a sheet. */
const Select = ({
  label,
  value,
  placeholder,
  disabled,
  onPress,
}: {
  label: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={value ? `${label}: ${value}` : label}
    style={({ pressed }) => [
      styles.box,
      styles.selectBox,
      pressed && styles.pressed,
    ]}
  >
    <Text style={value ? styles.selectValue : styles.selectPlaceholder}>
      {value || placeholder}
    </Text>
    <ChevronDown size={15} color="#1B1B1B" />
  </Pressable>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },
  scroll: { padding: 16, paddingBottom: 28, gap: 14 },

  box: {
    minHeight: 58,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E4E8EF',
    borderRadius: 9,
    paddingHorizontal: 16,
  },
  input: {
    fontFamily: FONT_FAMILY,
    fontSize: 17,
    color: '#1B1B1B',
    // Android's TextInput carries its own vertical padding; zeroing it keeps
    // the text on the box's centre line with the placeholders in the selects.
    paddingVertical: 0,
  },
  selectBox: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  selectValue: {
    fontFamily: FONT_FAMILY,
    flex: 1,
    fontSize: 17,
    color: '#1B1B1B',
  },
  selectPlaceholder: {
    fontFamily: FONT_FAMILY,
    flex: 1,
    fontSize: 17,
    color: '#1B1B1B',
  },
  pressed: { opacity: 0.7 },

  error: {
    fontFamily: FONT_FAMILY,
    fontSize: 13.5,
    lineHeight: 19,
    color: COLORS.red,
  },

  save: {
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: '#000000',
  },
  /** Still pressable: tapping it is how the customer finds out what is missing. */
  saveIdle: { backgroundColor: '#4A4A4A' },
  saveText: {
    fontFamily: FONT_FAMILY,
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.white,
  },
});

export default AddressFormScreen;
