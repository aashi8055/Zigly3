/**
 * Edit Profile: First Name, Last Name, Email, and Save.
 *
 * READ THIS BEFORE WIRING ANYTHING TO IT. Save does not reach Zigly. Shopify's
 * classic customer accounts expose no storefront endpoint that changes a
 * customer's name or email -- addresses are the only thing the storefront can
 * write, which is why the Address screen posts real changes and this does not.
 * Zigly's own app edits these through a backend this app has no access to.
 *
 * So an edit here changes what this app shows, on this device, for this
 * session, and nothing else. That is what was asked for, and the screen says it
 * out loud rather than leaving the customer to discover it: a form that
 * silently kept a change to itself would be worse than no form at all. When a
 * profile endpoint exists, only the save handler changes -- the notice comes
 * off with it, and the screen above it stays as it is.
 *
 * Phone is shown but not editable, and is not on the form in Zigly's own app
 * either. It comes from the OTP login, which makes it the one field here that
 * is genuinely authoritative; letting it be typed over would put a number on
 * screen that nobody can be reached on.
 */
import React, {useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import type {Customer, ProfileEdits} from '../account/accountData';
import {editsFromCustomer} from '../account/accountData';

interface Props {
  customer: Customer;
  /** Applied over what the site rendered; see ../account/accountData. */
  onSave: (edits: ProfileEdits) => void;
}

const Field = ({
  label,
  value,
  onChangeValue,
  ...input
}: {
  label: string;
  value: string;
  onChangeValue: (next: string) => void;
} & React.ComponentProps<typeof TextInput>) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeValue}
      placeholderTextColor="#9AA3AF"
      // The site is the source of these; a keyboard that corrects a surname or
      // an email into something else would be editing them on the way in.
      autoCorrect={false}
      accessibilityLabel={label}
      {...input}
    />
  </View>
);

const EditProfileScreen = ({customer, onSave}: Props) => {
  /**
   * Seeded once, from the customer as the screen was opened.
   *
   * Not kept in step with `customer` afterwards: the account probe re-runs on
   * its own schedule, and a reply landing mid-edit would take the field out
   * from under whoever was typing in it.
   */
  const [edits, setEdits] = useState<ProfileEdits>(() =>
    editsFromCustomer(customer),
  );

  const change = (key: keyof ProfileEdits) => (next: string) =>
    setEdits(current => ({...current, [key]: next}));

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled">
        <Field
          label="First Name"
          value={edits.firstName}
          onChangeValue={change('firstName')}
          autoCapitalize="words"
          textContentType="givenName"
        />
        <Field
          label="Last Name"
          value={edits.lastName}
          onChangeValue={change('lastName')}
          autoCapitalize="words"
          textContentType="familyName"
        />
        <Field
          label="Email"
          value={edits.email}
          onChangeValue={change('email')}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
        />

        {customer.phone ? (
          <View style={styles.field}>
            <Text style={styles.label}>Phone</Text>
            {/* Not a field: it comes from the OTP login and is the one value
                here that is authoritative. */}
            <View style={[styles.input, styles.readOnly]}>
              <Text style={styles.readOnlyText}>{customer.phone}</Text>
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={() => onSave(edits)}
          accessibilityRole="button"
          accessibilityLabel="Save profile"
          style={({pressed}) => [styles.save, pressed && styles.pressed]}>
          <Text style={styles.saveText}>Save</Text>
        </Pressable>

        {/*
          Said plainly, and on the screen rather than only in a commit message.
          The customer is about to change something that will not follow them to
          the website, their orders or their invoices.
        */}
        <Text style={styles.notice}>
          Saved on this device only. Zigly does not offer a way to change your
          name or email from the app yet, so this will not update your account
          on the website.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: COLORS.white},
  scroll: {padding: 18, paddingBottom: 40},

  field: {marginBottom: 18},
  label: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    fontWeight: '700',
    color: '#1B1B1B',
    marginBottom: 8,
  },
  input: {
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    color: '#1B1B1B',
    borderWidth: 1,
    borderColor: '#E3E9F3',
    borderRadius: 10,
    paddingHorizontal: 16,
    // Height rather than vertical padding: an Android TextInput sizes itself
    // from the font otherwise, and the three boxes end up different heights.
    height: 54,
  },
  readOnly: {justifyContent: 'center', backgroundColor: '#F7F8FA'},
  readOnlyText: {
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    color: COLORS.inkMuted,
  },

  save: {
    marginTop: 6,
    backgroundColor: '#0B0B0B',
    borderRadius: 10,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {opacity: 0.85},
  saveText: {
    fontFamily: FONT_FAMILY,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.white,
  },

  notice: {
    fontFamily: FONT_FAMILY,
    marginTop: 16,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.inkMuted,
    textAlign: 'center',
  },
});

export default EditProfileScreen;
