/**
 * The signed-in account screen.
 *
 * A profile block, four rows, and the two buttons at the foot -- the reference
 * app's layout, with two departures that are worth stating plainly because both
 * are about not pretending:
 *
 *   **Change Password opens a password *reset*, and the destination is
 *   unconfirmed.** The row is drawn because Zigly's own app draws it. What sits
 *   behind it is the problem: zigly.com runs Shopify's classic customer
 *   accounts, which have no signed-in change-password page at all. The only
 *   mechanism the platform has is `POST /account/recover`, which emails a reset
 *   link, and since the store signs people in by OTP many customers have never
 *   set a password for that link to change. So the row opens the recover form,
 *   and that destination is **UNCONFIRMED** -- nobody has checked what the
 *   reference app actually shows after the tap. See CHANGE_PASSWORD_URL in
 *   ../constants/appConstants.ts, which carries the same warning, and open
 *   question 1 on this work.
 *
 *   **Edit Profile does not reach Zigly.** Shopify's storefront can create and
 *   edit *addresses* -- which is why the Address screen is fully working -- but
 *   it exposes no way to change a customer's name, email or phone. The button
 *   is here because Zigly's own app has it, and it opens a real form; what it
 *   saves is a device-local overlay over what the site rendered, and the form
 *   says so. See ../account/accountData and ./EditProfileScreen.
 *
 * The profile block shows what the site actually renders for this customer,
 * which on a stock theme can be very little; see ../account/accountData.ts for
 * why. A missing line is left out rather than filled in.
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { COLORS, FONT_FAMILY } from '../constants/appConstants';
import type { Customer } from '../account/accountData';
import {
  BoxIcon,
  ChevronRight,
  HeartOutline,
  LockIcon,
  PersonIcon,
  PinIcon,
} from './glyphs';

export type AccountRow =
  | 'orders'
  | 'address'
  | 'favorites'
  /** A WebView over the site's own password page. See the note above. */
  | 'changePassword';

interface Props {
  /** null while the probe is still out. */
  customer: Customer | null;
  onOpenRow: (row: AccountRow) => void;
  /** Opens the Edit Profile form. */
  onEditProfile: () => void;
  onLogOut: () => void;
  onDeleteAccount: () => void;
  /** Shown when a sign-out did not take, rather than pretending it did. */
  notice: string | null;
}

const ROWS: {
  key: AccountRow;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}[] = [
  {
    key: 'orders',
    title: 'Orders',
    subtitle: 'Manage your orders',
    icon: <BoxIcon size={22} color="#1B1B1B" />,
  },
  {
    key: 'address',
    title: 'Address',
    subtitle: 'Manage your addresses',
    icon: <PinIcon size={22} color="#1B1B1B" />,
  },
  {
    key: 'changePassword',
    title: 'Change Password',
    subtitle: 'Change your password',
    icon: <LockIcon size={22} color="#1B1B1B" />,
  },
  {
    key: 'favorites',
    title: 'Favorites',
    subtitle: 'Manage your favorite products',
    icon: <HeartOutline size={22} color="#1B1B1B" ground="#F7F8FA" />,
  },
];

const AccountScreen = ({
  customer,
  onOpenRow,
  onEditProfile,
  onLogOut,
  onDeleteAccount,
  notice,
}: Props) => {
  if (customer === null) {
    // The read is still out. Showing the rows over an empty profile would be
    // showing an account screen to somebody the app cannot yet confirm is
    // signed in -- and if the answer is "no", this screen is about to become
    // the login screen instead.
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={COLORS.navy} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.profile}>
          <View style={styles.avatar}>
            {customer.initials ? (
              <Text style={styles.initials}>{customer.initials}</Text>
            ) : (
              <PersonIcon size={34} color={COLORS.white} />
            )}
          </View>
          <View style={styles.who}>
            <Text style={styles.name} numberOfLines={1}>
              {customer && customer.name
                ? `Hi, ${customer.name}`
                : 'Your account'}
            </Text>
            {customer.email ? (
              <Text style={styles.contact} numberOfLines={1}>
                {customer.email}
              </Text>
            ) : null}
            {customer.phone ? (
              <Text style={styles.contact} numberOfLines={1}>
                {customer.phone}
              </Text>
            ) : null}
          </View>

          {/* To the right of the details, as Zigly's own app places it. */}
          <Pressable
            onPress={onEditProfile}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            style={({ pressed }) => [styles.edit, pressed && styles.pressed]}
          >
            <Text style={styles.editText}>Edit Profile</Text>
          </Pressable>
        </View>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <View style={styles.rows}>
          {ROWS.map((row, index) => (
            <Pressable
              key={row.key}
              onPress={() => onOpenRow(row.key)}
              accessibilityRole="button"
              accessibilityLabel={`${row.title}. ${row.subtitle}`}
              style={({ pressed }) => [
                styles.row,
                index > 0 && styles.rowDivided,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.rowIcon}>{row.icon}</View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{row.title}</Text>
                <Text style={styles.rowSubtitle}>{row.subtitle}</Text>
              </View>
              <ChevronRight size={15} color="#1B1B1B" />
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Pinned, as the reference app pins them. */}
      <View style={styles.footer}>
        <Pressable
          onPress={onDeleteAccount}
          accessibilityRole="button"
          accessibilityLabel="Delete account"
          style={({ pressed }) => [
            styles.footerButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.footerText, styles.deleteText]}>
            Delete Account
          </Text>
        </Pressable>
        <Pressable
          onPress={onLogOut}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          style={({ pressed }) => [
            styles.footerButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.footerText}>Log Out</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.ground },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.ground,
  },
  scroll: { paddingBottom: 24 },

  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 20,
    backgroundColor: '#EFF1F5',
  },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#9AA7B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: FONT_FAMILY,
    color: COLORS.white,
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  who: { flex: 1, minWidth: 0, gap: 2 },
  /**
   * Sized to its label rather than stretched. `flexShrink: 0` because the
   * details beside it are `flex: 1` with `numberOfLines`, and without it a long
   * email would squeeze the button until "Edit Profile" wrapped.
   */
  edit: {
    flexShrink: 0,
    borderWidth: 1,
    borderColor: '#D6DBE3',
    borderRadius: 8,
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  editText: {
    fontFamily: FONT_FAMILY,
    fontSize: 14.5,
    fontWeight: '600',
    color: '#1B1B1B',
  },
  name: {
    fontFamily: FONT_FAMILY,
    fontSize: 19,
    fontWeight: '700',
    color: '#1B1B1B',
  },
  contact: {
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    color: '#4A5361',
  },

  notice: {
    fontFamily: FONT_FAMILY,
    marginHorizontal: 18,
    marginTop: 14,
    fontSize: 13.5,
    lineHeight: 19,
    color: COLORS.red,
  },

  rows: { marginTop: 6, backgroundColor: '#F7F8FA' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  rowDivided: { borderTopWidth: 1, borderTopColor: '#E4E8EF' },
  rowIcon: { width: 24, alignItems: 'center' },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: 18,
    fontWeight: '600',
    color: '#1B1B1B',
  },
  rowSubtitle: {
    fontFamily: FONT_FAMILY,
    fontSize: 13.5,
    color: COLORS.inkMuted,
  },
  pressed: { opacity: 0.7 },

  footer: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
    backgroundColor: COLORS.white,
  },
  footerButton: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DDE3EC',
    borderRadius: 9,
  },
  footerText: {
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    fontWeight: '600',
    color: '#1B1B1B',
  },
  deleteText: { color: COLORS.red },
});

export default AccountScreen;
