/**
 * Order history.
 *
 * Read out of the account page -- the same request that answers "is anyone
 * signed in", so opening this costs nothing beyond what the account screen
 * already asked for. Every field is Shopify's own: the order name, the date,
 * the two status labels and the total exactly as the theme printed it.
 *
 * The total is the one money value in this app that is a rendered string rather
 * than integer paise, because there is no `/account/orders.json` to get it from.
 * It is shown as the site wrote it and never parsed -- a figure this app cannot
 * recompute is one it must not reformat either.
 *
 * Tapping an order opens Shopify's own order page, inside the app, in a page
 * layer under the same native header. That page carries the line items, the
 * shipping and tax breakdown and the fulfilment tracking, all of which are
 * numbers this app has no second source for -- so it shows Zigly's page rather
 * than a native screen that would have to invent the arithmetic.
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
import type { Order } from '../account/accountData';
import EmptyState from './EmptyState';
import { ChevronRight } from './glyphs';

interface Props {
  /** null while the read is out; [] means the customer has no orders. */
  orders: Order[] | null;
  onOpenOrder: (order: Order) => void;
}

const Chip = ({ label }: { label: string }) => (
  <View style={styles.chip}>
    <Text style={styles.chipText}>{label}</Text>
  </View>
);

const OrdersScreen = ({ orders, onOpenOrder }: Props) => {
  if (orders === null) {
    // The same rule the cart follows: a screen that has not been told yet must
    // wait, not claim the customer has never ordered anything.
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={COLORS.navy} />
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View style={styles.root}>
        <EmptyState title="No Items" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.list}>
        {orders.map(order => (
          <Pressable
            key={order.url}
            onPress={() => onOpenOrder(order)}
            accessibilityRole="button"
            accessibilityLabel={`Order ${order.name}`}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.cardText}>
              <View style={styles.topLine}>
                <Text style={styles.name}>{order.name}</Text>
                {order.total ? (
                  <Text style={styles.total}>{order.total}</Text>
                ) : null}
              </View>
              {order.date ? (
                <Text style={styles.date}>{order.date}</Text>
              ) : null}
              <View style={styles.chips}>
                {order.fulfillmentStatus ? (
                  <Chip label={order.fulfillmentStatus} />
                ) : null}
                {order.paymentStatus ? (
                  <Chip label={order.paymentStatus} />
                ) : null}
              </View>
            </View>
            <ChevronRight size={15} color="#8C97A8" />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  /**
   * `surface`, not `ground`: the order rows are white cards with a gap between
   * them and no border, so they need a ground to be lifted off. The app's own
   * ground is white now, which would flatten the list into one sheet.
   */
  root: { flex: 1, backgroundColor: COLORS.surface },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  list: { paddingVertical: 10, gap: 10 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: COLORS.white,
  },
  pressed: { opacity: 0.75 },
  cardText: { flex: 1, minWidth: 0, gap: 5 },
  topLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  name: {
    fontFamily: FONT_FAMILY,
    fontSize: 17,
    fontWeight: '700',
    color: '#1B1B1B',
  },
  total: {
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    fontWeight: '600',
    color: '#1B1B1B',
  },
  date: { fontFamily: FONT_FAMILY, fontSize: 13.5, color: COLORS.inkMuted },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  chip: {
    borderRadius: 4,
    backgroundColor: '#EFF1F5',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  chipText: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '600',
    color: '#4A5361',
  },
});

export default OrdersScreen;
