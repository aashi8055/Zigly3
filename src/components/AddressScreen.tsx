/**
 * Saved addresses.
 *
 * "No saved addresses" over an "Add New Address" button when there are none,
 * matching the reference app; a card per address once there are, each with the
 * Edit and Delete that Shopify's own form supports.
 *
 * Both writes go through the storefront's documented `customer_address` form
 * with the session this app already shares, so an address added here is the
 * same address the website's checkout offers -- which is the whole point of
 * doing it this way rather than keeping a copy the app owns.
 */
import React from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { COLORS, FONT_FAMILY } from '../constants/appConstants';
import type { Address } from '../account/accountData';
import { Block, usePulse } from './Skeleton';

interface Props {
  /** null while the read is out. */
  addresses: Address[] | null;
  onAdd: () => void;
  onEdit: (address: Address) => void;
  onDelete: (address: Address) => void;
  /** Set when a write could not be confirmed. */
  notice: string | null;
}

/** One saved address's shape: the name line, then two shorter address lines. */
const AddressCardSkeleton = ({ pulse }: { pulse: Animated.Value }) => (
  <View style={styles.card}>
    <Block pulse={pulse} style={styles.skName} />
    <Block pulse={pulse} style={styles.skLine} />
    <Block pulse={pulse} style={styles.skLineShort} />
  </View>
);

const AddressScreen = ({
  addresses,
  onAdd,
  onEdit,
  onDelete,
  notice,
}: Props) => {
  if (addresses === null) {
    const pulse = usePulse(true);
    return (
      <View style={styles.root}>
        <View style={styles.scroll}>
          <AddressCardSkeleton pulse={pulse} />
          <AddressCardSkeleton pulse={pulse} />
        </View>
      </View>
    );
  }

  const AddButton = (
    <Pressable
      onPress={onAdd}
      accessibilityRole="button"
      accessibilityLabel="Add new address"
      style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
    >
      <Text style={styles.addLabel}>Add New Address</Text>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {addresses.length === 0 ? (
          <>
            <Text style={styles.empty}>No saved addresses</Text>
            {AddButton}
          </>
        ) : (
          <>
            {addresses.map(address => (
              <View key={address.id} style={styles.card}>
                {address.isDefault ? (
                  <Text style={styles.default}>Default</Text>
                ) : null}
                {address.lines.map((line, index) => (
                  <Text
                    key={line + index}
                    style={index === 0 ? styles.cardName : styles.cardLine}
                  >
                    {line}
                  </Text>
                ))}
                {address.fields.phone ? (
                  <Text style={styles.cardLine}>{address.fields.phone}</Text>
                ) : null}

                <View style={styles.actions}>
                  <Pressable
                    onPress={() => onEdit(address)}
                    accessibilityRole="button"
                    accessibilityLabel="Edit address"
                    style={({ pressed }) => [
                      styles.action,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.actionText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onDelete(address)}
                    accessibilityRole="button"
                    accessibilityLabel="Delete address"
                    style={({ pressed }) => [
                      styles.action,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.actionText, styles.deleteText]}>
                      Delete
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {AddButton}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.ground },
  scroll: { paddingHorizontal: 16, paddingTop: 34, paddingBottom: 28, gap: 16 },

  empty: {
    fontFamily: FONT_FAMILY,
    fontSize: 19,
    color: '#5A6472',
    textAlign: 'center',
    marginBottom: 18,
  },
  notice: {
    fontFamily: FONT_FAMILY,
    fontSize: 13.5,
    lineHeight: 19,
    color: COLORS.red,
  },

  addButton: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1B1B1B',
    borderRadius: 9,
  },
  addLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 19,
    color: '#1B1B1B',
  },
  pressed: { opacity: 0.7 },

  card: {
    borderWidth: 1,
    borderColor: '#E4E8EF',
    borderRadius: 10,
    padding: 16,
    gap: 3,
  },
  default: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: COLORS.navy,
    marginBottom: 4,
  },
  cardName: {
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    fontWeight: '700',
    color: '#1B1B1B',
  },
  cardLine: { fontFamily: FONT_FAMILY, fontSize: 14.5, color: '#4A5361' },

  actions: { flexDirection: 'row', gap: 22, marginTop: 12 },
  action: { paddingVertical: 4 },
  actionText: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.navy,
  },
  deleteText: { color: COLORS.red },

  skName: { height: 16, width: '52%', borderRadius: 4, marginBottom: 6 },
  skLine: { height: 14.5, width: '80%', borderRadius: 4, marginBottom: 6 },
  skLineShort: { height: 14.5, width: '44%', borderRadius: 4 },
});

export default AddressScreen;
