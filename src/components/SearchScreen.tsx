/**
 * Native search.
 *
 * The old search was a text field in the header that submitted to the site's
 * `/search?q=` page: nothing happened until you pressed enter, and the pre-typing
 * screen was blank. This is the screen the reference app shows instead —
 * suggestions as you type, recents before you start.
 *
 * What it does *not* do is own the results. The first row is always "See all
 * results", which hands off to the site's own search page: that page is
 * SearchTap-rendered, so it carries Zigly's real ranking, facets and sort. The
 * suggestions here are a fast path over Shopify's predictive search, not a
 * second search engine to keep in sync — see webview/searchBridge.ts.
 */
import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {money, percentOff} from '../utils/money';
import {isEmpty} from '../search/suggestions';
import type {
  CollectionHit,
  ProductHit,
  QueryHit,
  Suggestions,
} from '../search/suggestions';

interface Props {
  query: string;
  onQueryChange: (query: string) => void;
  /** Enter, or a tap on "See all results": hands off to the site's search. */
  onSubmit: (query: string) => void;
  /** Opens a product, collection or suggested query in a page layer. */
  onOpenUrl: (url: string) => void;
  /** Null until the first reply for the current query arrives. */
  suggestions: Suggestions | null;
  busy: boolean;
  recents: string[];
  onClearRecents: () => void;
}

const SearchIcon = ({size = 18}: {size?: number}) => (
  <View style={{width: size, height: size}}>
    <View style={styles.searchLens} />
    <View style={styles.searchHandle} />
  </View>
);

/** Chevron pointing right, for the rows that navigate away. */
const Arrow = () => <Text style={styles.arrow}>{'›'}</Text>;

const SectionLabel = ({children}: {children: string}) => (
  <Text style={styles.sectionLabel}>{children}</Text>
);

const TextRow = ({
  label,
  onPress,
  hint,
}: {
  label: string;
  onPress: () => void;
  hint?: string;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    style={({pressed}) => [styles.textRow, pressed && styles.pressed]}>
    <SearchIcon size={16} />
    <Text style={styles.textRowLabel} numberOfLines={1}>
      {label}
    </Text>
    {hint ? <Text style={styles.textRowHint}>{hint}</Text> : null}
    <Arrow />
  </Pressable>
);

const ProductRow = ({
  product,
  onPress,
}: {
  product: ProductHit;
  onPress: () => void;
}) => {
  const off =
    product.compareAt !== null
      ? percentOff(product.compareAt, product.price)
      : 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({pressed}) => [styles.productRow, pressed && styles.pressed]}>
      {product.image ? (
        <Image source={{uri: product.image}} style={styles.thumb} />
      ) : (
        <View style={styles.thumb} />
      )}

      <View style={styles.productDetails}>
        {product.vendor ? (
          <Text style={styles.vendor} numberOfLines={1}>
            {product.vendor}
          </Text>
        ) : null}
        <Text style={styles.productTitle} numberOfLines={2}>
          {product.title}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{money(product.price)}</Text>
          {product.compareAt !== null ? (
            <Text style={styles.was}>{money(product.compareAt)}</Text>
          ) : null}
          {off > 0 ? <Text style={styles.off}>{off}% off</Text> : null}
        </View>
        {!product.available ? (
          <Text style={styles.soldOut}>Out of stock</Text>
        ) : null}
      </View>
    </Pressable>
  );
};

const SearchScreen = ({
  query,
  onQueryChange,
  onSubmit,
  onOpenUrl,
  suggestions,
  busy,
  recents,
  onClearRecents,
}: Props) => {
  const trimmed = query.trim();
  const typing = trimmed.length > 0;
  /**
   * Only trust a result set that answers what is currently in the field. A
   * reply for an earlier keystroke would otherwise flash the wrong products
   * under the new query.
   */
  const current =
    suggestions !== null && suggestions.query === trimmed ? suggestions : null;

  const submit = () => {
    if (trimmed.length > 0) {
      onSubmit(trimmed);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.band}>
        <View style={styles.field}>
          <SearchIcon />
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            onSubmitEditing={submit}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            placeholder="Search for food, treats, toys…"
            placeholderTextColor="#8C97A8"
            returnKeyType="search"
            style={styles.input}
            accessibilityLabel="Search Zigly"
          />
          {typing ? (
            <Pressable
              onPress={() => onQueryChange('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear search">
              <Text style={styles.clear}>{'×'}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}>
        {!typing ? (
          <>
            {recents.length > 0 ? (
              <>
                <View style={styles.recentsHeader}>
                  <SectionLabel>Recent searches</SectionLabel>
                  <Pressable
                    onPress={onClearRecents}
                    hitSlop={8}
                    accessibilityRole="button">
                    <Text style={styles.clearRecents}>Clear</Text>
                  </Pressable>
                </View>
                {recents.map(term => (
                  <TextRow
                    key={term}
                    label={term}
                    onPress={() => onSubmit(term)}
                  />
                ))}
              </>
            ) : (
              /*
               * A real empty state rather than a blank screen. Nothing is
               * invented here: the reference app's trending list is empty in
               * the live config, and this app does not publish a "popular"
               * list it would have to make up.
               */
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>What are you looking for?</Text>
                <Text style={styles.emptyBody}>
                  Search by product, brand or breed — food, treats, toys,
                  grooming, or a vet visit.
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Always first, and always available: the site's own search is
                the authority on results, and it finds things Shopify's
                predictive index does not. */}
            <TextRow
              label={`See all results for “${trimmed}”`}
              onPress={submit}
            />

            {current === null ? (
              busy ? (
                <View style={styles.centre}>
                  <ActivityIndicator color={COLORS.navy} />
                </View>
              ) : null
            ) : (
              <>
                {current.queries.length > 0 ? (
                  <>
                    <SectionLabel>Suggestions</SectionLabel>
                    {current.queries.map((hit: QueryHit) => (
                      <TextRow
                        key={hit.url}
                        label={hit.text}
                        onPress={() => onOpenUrl(hit.url)}
                      />
                    ))}
                  </>
                ) : null}

                {current.collections.length > 0 ? (
                  <>
                    <SectionLabel>Categories</SectionLabel>
                    {current.collections.map((hit: CollectionHit) => (
                      <TextRow
                        key={hit.url}
                        label={hit.title}
                        hint="Category"
                        onPress={() => onOpenUrl(hit.url)}
                      />
                    ))}
                  </>
                ) : null}

                {current.products.length > 0 ? (
                  <>
                    <SectionLabel>Products</SectionLabel>
                    {current.products.map((hit: ProductHit) => (
                      <ProductRow
                        key={hit.id + hit.url}
                        product={hit}
                        onPress={() => onOpenUrl(hit.url)}
                      />
                    ))}
                  </>
                ) : null}

                {isEmpty(current) ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>No quick matches</Text>
                    <Text style={styles.emptyBody}>
                      Nothing came back for “{trimmed}”. The full store search
                      above looks wider than this list does.
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: COLORS.white},

  // Pale blue band, matching the header's own search band.
  band: {backgroundColor: '#BFD3EE', paddingHorizontal: 14, paddingVertical: 10},
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1B1B1B',
    paddingHorizontal: 12,
    height: 44,
  },
  input: {
    fontFamily: FONT_FAMILY,
    flex: 1,
    fontSize: 15,
    color: COLORS.ink,
    padding: 0,
  },
  clear: {
    fontFamily: FONT_FAMILY,
    fontSize: 22,
    lineHeight: 24,
    color: '#5A6472',
    paddingHorizontal: 2,
  },

  searchLens: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 1.6,
    borderColor: '#5A6472',
  },
  searchHandle: {
    position: 'absolute',
    right: 0,
    bottom: 1,
    width: 6,
    height: 1.8,
    backgroundColor: '#5A6472',
    transform: [{rotate: '45deg'}],
  },

  list: {flex: 1},
  listContent: {paddingBottom: 32},

  sectionLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: COLORS.inkMuted,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 6,
  },
  recentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
  },
  clearRecents: {
    fontFamily: FONT_FAMILY,
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.red,
    paddingTop: 12,
  },

  textRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
  },
  textRowLabel: {
    fontFamily: FONT_FAMILY,
    flex: 1,
    fontSize: 15,
    color: '#1B1B1B',
  },
  textRowHint: {
    fontFamily: FONT_FAMILY,
    fontSize: 12.5,
    color: COLORS.inkMuted,
  },
  arrow: {fontFamily: FONT_FAMILY, fontSize: 19, color: '#B4BCC7'},
  pressed: {backgroundColor: '#F6F8FB'},

  productRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
  },
  thumb: {width: 60, height: 60, borderRadius: 8, backgroundColor: '#F5F5F5'},
  productDetails: {flex: 1},
  vendor: {
    fontFamily: FONT_FAMILY,
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: COLORS.inkMuted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  productTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: 14.5,
    lineHeight: 19,
    color: '#1B1B1B',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 5,
  },
  price: {
    fontFamily: FONT_FAMILY,
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1B1B1B',
  },
  was: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    color: '#9A9A9A',
    textDecorationLine: 'line-through',
  },
  off: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.red,
  },
  soldOut: {
    fontFamily: FONT_FAMILY,
    fontSize: 12.5,
    color: COLORS.inkMuted,
    marginTop: 3,
  },

  centre: {paddingVertical: 36, alignItems: 'center'},
  empty: {paddingHorizontal: 32, paddingTop: 48, alignItems: 'center'},
  emptyTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.navy,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: FONT_FAMILY,
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.inkMuted,
    textAlign: 'center',
  },
});

export default SearchScreen;
