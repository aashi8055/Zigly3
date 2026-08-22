/**
 * The application.
 *
 * Layout, from the outside in:
 *
 *   announcement bar   \  app chrome: drawn once, never covered
 *   native header      /  (the bar stands down only on the search screen)
 *   ------------------ <- everything below is inside `body`
 *   dashboard WebView     mounted for the life of the app
 *   account section       native: account, orders, address, the login widget
 *   page layers           inner pages: one on screen, the rest parked off it
 *   cart screen
 *   ------------------
 *   bottom navigation     five tabs, native, outside `body` like the header
 *
 * The header and the bottom bar sit *outside* `body`, and every overlay is
 * positioned inside it. That is load-bearing: the layers used to be absolutely
 * positioned against the whole screen, so opening any inner page covered the
 * header with it and left the user on a page with no back arrow and no cart.
 * The bottom bar is native for the same reason -- the site's own is drawn inside
 * the page, so every native screen in this list hid it, and it has no Account
 * tab to begin with.
 *
 * The account section is *below* the page layers on purpose: an order, or a
 * product opened from Favorites, is a real page and has to be drawn over the
 * screen it was opened from, so that Back returns there rather than to the
 * dashboard.
 *
 * Remounting the dashboard would drop the Shopify session cookie and the user's
 * place on the page, so navigation is performed by driving these WebViews
 * rather than by swapping screens. Inner pages are managed by
 * ../navigation/pageStack, which keeps recently visited pages mounted so that
 * Back and re-entry are paints rather than 2 MB page loads.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Alert,
  BackHandler,
  Linking,
  StyleSheet,
  View,
} from 'react-native';
import type {NativeScrollEvent, NativeSyntheticEvent} from 'react-native';
import {WebView} from 'react-native-webview';
// react-native-webview@14 declares `class WebView<P = undefined>`, which makes
// its default props type `WebViewProps & undefined` — i.e. `never`. Supplying
// an explicit type argument restores the real prop types at the call site.
type Web = WebView<object>;
import type {
  WebViewNavigation,
  ShouldStartLoadRequest,
} from 'react-native-webview/lib/WebViewTypes';
import NetInfo from '@react-native-community/netinfo';

import {
  COLORS,
  LOGIN_URL,
  START_URL,
  SUPPORT_EMAIL,
  SUPPORT_PAGE_URL,
  TABS,
  ZIGLY_ORIGIN,
} from '../constants/appConstants';
import type {TabKey} from '../constants/appConstants';
import {baseWebViewProps} from '../webview/webViewConfig';
import {
  classifyUrl,
  isAccountUrl,
  isCheckoutUrl,
  isInternalHost,
  parseUrl,
  showsSortFilterBar,
} from '../utils/urlUtils';
import {getInjectionForUrl} from '../webview/injectedScripts';
import {PREFETCH_SCRIPT} from '../webview/prefetch';
import {log, warn} from '../utils/logger';
import LoadingBar from '../components/LoadingBar';
import PageCover, {PAGE_COVER_CAP_MS} from '../components/PageCover';
import NativeHeader from '../components/NativeHeader';
import AnnouncementBar from '../components/AnnouncementBar';
import CartToast from '../components/CartToast';
import MessageToast from '../components/MessageToast';
import CartScreen from '../components/CartScreen';
import type {CartData} from '../components/CartScreen';
import {
  READ_CART_SCRIPT,
  addToCartScript,
  changeQtyScript,
} from '../webview/cartBridge';
import WishlistScreen from '../components/WishlistScreen';
import {
  WISHLIST_SCRIPT,
  removeFromWishlistScript,
} from '../webview/wishlistBridge';
import {parseWishlist} from '../wishlist/wishlistItems';
import type {WishlistItem} from '../wishlist/wishlistItems';
import {
  REPORT_CART_COUNT,
  EARLY_HEADER_CSS,
  REPORT_ANNOUNCEMENTS,
} from '../webview/headerBridge';
import MenuDrawer from '../components/MenuDrawer';
import type {MenuDrawerHandle} from '../components/MenuDrawer';
import {READ_MENU_SCRIPT} from '../webview/menuBridge';
import {parseMenu} from '../menu/menuTree';
import type {MenuNode} from '../menu/menuTree';
import NetworkErrorScreen from '../components/NetworkErrorScreen';
import SearchScreen from '../components/SearchScreen';
import {
  MIN_QUERY_LENGTH,
  REPORT_SEARCH_PLACEHOLDERS,
  SUGGEST_DEBOUNCE_MS,
  SUGGEST_TIMEOUT_MS,
  suggestScript,
} from '../webview/searchBridge';
import {parseSuggestions, rememberSearch} from '../search/suggestions';
import type {Suggestions} from '../search/suggestions';
import {
  DEFAULT_PLACEHOLDER_MS,
  SEED_PLACEHOLDERS,
  acceptInterval,
  mergePlaceholders,
} from '../search/placeholders';
import {
  EMPTY_STACK,
  closeTopPage,
  goToDashboard,
  noteNavigation,
  onDashboard,
  openPage,
  visibleLayer,
} from '../navigation/pageStack';
import type {PageStack} from '../navigation/pageStack';
import BottomNav from '../components/BottomNav';
import AccountScreen from '../components/AccountScreen';
import EditProfileScreen from '../components/EditProfileScreen';
import OrdersScreen from '../components/OrdersScreen';
import AddressScreen from '../components/AddressScreen';
import AddressFormScreen from '../components/AddressFormScreen';
import {
  ACCOUNT_PROBE,
  ADDRESSES_PROBE,
  COUNTRIES_PROBE,
  LOGOUT_SCRIPT,
  WRITE_TIMEOUT_MS,
  deleteAddressScript,
  saveAddressScript,
} from '../webview/accountBridge';
import {LOGIN_RESTYLE} from '../webview/loginRestyle';
import {
  EMPTY_ADDRESS_FIELDS,
  NO_PROFILE_EDITS,
  applyProfileEdits,
  parseAddresses,
  parseCountries,
  parseCustomer,
  parseOrders,
} from '../account/accountData';
import type {
  Address,
  AddressFields,
  AuthState,
  Country,
  Customer,
  Order,
  ProfileEdits,
} from '../account/accountData';
import {
  EMPTY_ACCOUNT_STACK,
  closeAccount,
  openAccount,
  popScreen,
  pushScreen,
  resolveAuth,
  topScreen,
} from '../navigation/accountStack';
import type {AccountStack} from '../navigation/accountStack';

interface Props {
  /** Fired once the first page has painted, so the splash can retire. */
  onFirstLoad: () => void;
}

/**
 * Which WebView an injection is aimed at. 'home' is the dashboard; a number is
 * a page layer's key. Resolved at the moment of injection, so a delayed pass
 * into a layer that has since been evicted is a no-op rather than a warning.
 */
type Target = 'home' | 'login' | number;

/**
 * Whether a page is a shopping page.
 *
 * The reference app's collection, product and search screens carry the wishlist
 * heart and the search band; its breed and content pages show only a back arrow
 * and the logo.
 */
export const isShopUrl = (url: string): boolean => {
  const path = url.split('?')[0].split('#')[0];
  return (
    path.indexOf('/collections') !== -1 ||
    path.indexOf('/products') !== -1 ||
    path.indexOf('/search') !== -1
  );
};

/** True for the dashboard itself, ignoring query and trailing slash. */
const isHomeUrl = (url: string): boolean => {
  let path = url.split('?')[0].split('#')[0];
  const scheme = path.indexOf('//');
  const start = scheme >= 0 ? path.indexOf('/', scheme + 2) : -1;
  path = start >= 0 ? path.slice(start) : '/';
  while (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return path === '' || path === '/' || path === '/index';
};

/** Injection is re-applied on this schedule; see applyStyles. */
const RESTYLE_DELAYS = [0, 500, 1500, 3000, 6000, 10000];

const ZiglyWebViewScreen = ({onFirstLoad}: Props) => {
  /**
   * The dashboard, mounted once and never navigated away from: it is expensive
   * to assemble (several section requests plus transplants) and Zigly's pages
   * carry no cache-control, so navigating back to '/' rebuilt it from scratch.
   */
  const webRef = useRef<Web>(null);
  /** One entry per mounted page layer, keyed as pageStack keys them. */
  const layerRefs = useRef<Map<number, Web>>(new Map());

  /** Read inside native callbacks, so it must be a ref, not state. */
  const canGoBackRef = useRef(false);
  const inCheckoutRef = useRef(false);
  const firstLoadDone = useRef(false);

  /**
   * Which WebView is mid-navigation, or null. Only the visible one's progress
   * is drawn -- a hidden layer finishing a load is not the user's business.
   */
  const [loadingTarget, setLoadingTarget] = useState<Target | null>(null);
  /** Mirrors the site's own cart bubble; never tracked independently. */
  const [cartCount, setCartCount] = useState(0);
  /** Offer strings mirrored from the site's own announcement bar. */
  const [announcements, setAnnouncements] = useState<string[]>([]);
  /**
   * The prompts the header's search bar types through.
   *
   * Seeded with Zigly's observed copy so the bar is never blank, then grown
   * with whatever the site's own search box is seen typing -- see
   * ../search/placeholders.ts.
   */
  const [searchPlaceholders, setSearchPlaceholders] =
    useState<string[]>(SEED_PLACEHOLDERS);
  /** Per-letter cadence, replaced once the site's own has been measured. */
  const [searchTypeMs, setSearchTypeMs] = useState(DEFAULT_PLACEHOLDER_MS);
  /**
   * Page layers that have finished loading at least once.
   *
   * A layer whose key is not in here is covered by `PageCover` -- the app's own
   * blank screen and spinner -- rather than showing the website drawing itself.
   * Keyed rather than a single flag because layers are kept alive: coming back to
   * one that already loaded must be instant, and it is, because its key is
   * already here.
   */
  const [paintedLayers, setPaintedLayers] = useState<number[]>([]);
  /**
   * A profile edit, laid over what the site rendered.
   *
   * Device-local and session-only. Shopify's storefront cannot change a
   * customer's name or email, so this changes what the app shows and nothing
   * else -- the form says as much. See ../account/accountData.
   */
  const [profileEdits, setProfileEdits] = useState<ProfileEdits | null>(
    NO_PROFILE_EDITS,
  );
  /**
   * A brief message at the foot of the screen, outside the account section.
   *
   * The delete notice cannot live on the account screen: by the time it shows,
   * signing out has already replaced that screen with the login one.
   */
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  /** True once scrolled away from the top; collapses the search band. */
  const [searchCollapsed, setSearchCollapsed] = useState(false);
  /** Shown when the page reports an add; the site still owns the cart. */
  const [cartToast, setCartToast] = useState(false);
  /**
   * The native cart. Zigly's own /cart page carries none of the reference
   * app's wording, so that screen is native there too -- but every figure and
   * every change still comes from Shopify, read inside the WebView.
   */
  const [showCart, setShowCart] = useState(false);
  const [cart, setCart] = useState<CartData | null>(null);

  /**
   * The wishlist. Native, and sourced from the site's own storage.
   *
   * There used to be a hidden WebView here, loading /pages/swym-wishlist off
   * screen so that Swym would render something to read. Swym is not on this
   * store any more: the wishlist is a list of handles in the page's own
   * localStorage, written by the theme's assets/wishlist.js. So the read is a
   * question put to the dashboard WebView, which is already loaded, and the
   * whole off-screen page load is gone. See ../webview/wishlistBridge.
   */
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [wishlist, setWishlist] = useState<WishlistItem[] | null>(null);
  const wishlistOpenRef = useRef(false);
  /** Shown only when a removal could not be confirmed. */
  const [wishlistNotice, setWishlistNotice] = useState<string | null>(null);
  /**
   * Tiles taken off screen optimistically, kept with the position they held so
   * one that turns out not to have been removed goes back where it was rather
   * than reappearing at the end of the grid.
   */
  const pendingRemovals = useRef<Map<string, {item: WishlistItem; at: number}>>(
    new Map(),
  );
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Search. The screen is native, but the suggestions come from Shopify's own
   * predictive search, fetched inside the dashboard WebView so the request
   * carries the site's session -- see ../webview/searchBridge.
   */
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  /** Session-scoped: this app adds no storage dependency for eight strings. */
  const [recents, setRecents] = useState<string[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Incremented per request and echoed back by the page. Replies do not arrive
   * in the order they were asked for, so anything but the latest is discarded.
   */
  const searchToken = useRef(0);
  const searchOpenRef = useRef(false);

  /**
   * The menu drawer.
   *
   * Native, drawn by ../components/MenuDrawer, but every row in it is read off
   * the page by ../webview/menuBridge -- the categories are Zigly's, only the
   * presentation is ours.
   */
  const [menuOpen, setMenuOpen] = useState(false);
  const [menu, setMenu] = useState<MenuNode[]>([]);
  const menuOpenRef = useRef(false);
  const menuRef = useRef<MenuDrawerHandle | null>(null);

  /**
   * The account section.
   *
   * Native, and the reason this app now draws its own bottom bar: the site's
   * has no Account tab, and every screen here would have hidden it anyway.
   * Nothing in here is a second copy of the customer's data -- the session is
   * the website's, the addresses are Shopify's, and every read goes out through
   * the dashboard WebView so it carries that session. See ../webview/
   * accountBridge.ts.
   */
  const [auth, setAuth] = useState<AuthState>('unknown');
  const [customer, setCustomer] = useState<Customer | null>(null);
  /** null means "not read yet"; [] means the customer really has none. */
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  /** The shop's own country list, fetched once the address form is first opened. */
  const [countries, setCountries] = useState<Country[]>([]);
  const countriesAsked = useRef(false);
  const [accountScreens, setAccountScreens] =
    useState<AccountStack>(EMPTY_ACCOUNT_STACK);
  /** The address the form is editing, or null when it is adding a new one. */
  const [editing, setEditing] = useState<Address | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  /** Shown on the form when a save came back unconfirmed. */
  const [addressError, setAddressError] = useState<string | null>(null);
  /** Shown on the address list when a delete came back unconfirmed. */
  const [addressNotice, setAddressNotice] = useState<string | null>(null);
  /** Shown on the account screen when a sign-out did not take. */
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  /** Read inside native callbacks, so they must be refs, not state. */
  const authRef = useRef<AuthState>('unknown');
  const accountScreensRef = useRef<AccountStack>(EMPTY_ACCOUNT_STACK);
  const loginRef = useRef<Web>(null);
  /**
   * Mirrors inCheckoutRef as state: the bottom bar has to come down over
   * Shopify's checkout, and a ref cannot re-render it.
   */
  const [inCheckout, setInCheckout] = useState(false);

  /** Inner pages. See ../navigation/pageStack for the rules. */
  const [stack, setStack] = useState<PageStack>(EMPTY_STACK);
  /** Mirrors `stack` for the native back handler, which reads a ref. */
  const stackRef = useRef(stack);
  /** Mirrors showCart for the native back handler, which reads a ref. */
  const showCartRef = useRef(false);
  /**
   * Whether the connection is unmetered. Prefetching trades data for speed,
   * which should not happen silently on mobile data.
   */
  const unmeteredRef = useRef(false);
  const [offline, setOffline] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const showing = visibleLayer(stack);

  // ---------------------------------------------------------------- network
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      unmeteredRef.current = state.type === 'wifi' || state.type === 'ethernet';
      const isOffline = state.isConnected === false;
      setOffline(prev => {
        if (prev !== isOffline) {
          log(isOffline ? 'device went offline' : 'device back online');
        }
        return isOffline;
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    stackRef.current = stack;
  }, [stack]);

  useEffect(() => {
    showCartRef.current = showCart;
  }, [showCart]);

  useEffect(() => {
    searchOpenRef.current = searchOpen;
  }, [searchOpen]);

  useEffect(() => {
    wishlistOpenRef.current = wishlistOpen;
  }, [wishlistOpen]);

  useEffect(() => {
    menuOpenRef.current = menuOpen;
  }, [menuOpen]);

  /** This layer has something to show; PageCover comes off it. */
  const markPainted = useCallback((key: number) => {
    setPaintedLayers(prev => (prev.includes(key) ? prev : [...prev, key]));
  }, []);

  /**
   * Reveal the covered layer no later than PAGE_COVER_CAP_MS, whatever the
   * network does.
   *
   * The cover exists so nobody watches a website assemble itself. It must never
   * become a screen they are stuck behind: a page that is genuinely slow is
   * better shown half-drawn, with the header's back arrow right there, than
   * hidden indefinitely.
   *
   * An effect rather than something `showPage` arms, so it covers every way into
   * a layer -- a category circle, a search result, a drawer row, a link inside
   * another page. The cleanup cancels it when the page paints first, or when the
   * customer leaves before it does.
   */
  useEffect(() => {
    if (showing === null || paintedLayers.includes(showing.key)) {
      return;
    }
    const key = showing.key;
    const timer = setTimeout(() => markPainted(key), PAGE_COVER_CAP_MS);
    return () => clearTimeout(timer);
  }, [showing, paintedLayers, markPainted]);

  /**
   * Forget layers that have been evicted.
   *
   * Keys are monotonic and never reused, so a stale entry can never let a new
   * layer skip its cover -- but the list would grow by one for every page opened
   * in a session, and it is read on every render of every layer. Bounded to
   * whatever is actually mounted instead.
   */
  useEffect(() => {
    const live = new Set(stack.layers.map(layer => layer.key));
    setPaintedLayers(prev => {
      const next = prev.filter(key => live.has(key));
      // Same array when nothing was dropped, or this would loop forever.
      return next.length === prev.length ? prev : next;
    });
  }, [stack.layers]);

  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  useEffect(() => {
    accountScreensRef.current = accountScreens;
  }, [accountScreens]);

  /** Stop both the pending request and the wait for one. */
  const cancelSuggestTimers = useCallback(() => {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
      searchTimeout.current = null;
    }
  }, []);

  useEffect(() => cancelSuggestTimers, [cancelSuggestTimers]);

  useEffect(
    () => () => {
      if (noticeTimer.current) {
        clearTimeout(noticeTimer.current);
      }
    },
    [],
  );

  /**
   * The search band describes whatever is on screen, so it opens when a
   * different page comes to the front instead of inheriting the collapsed state
   * of the one that was scrolled.
   */
  useEffect(() => {
    setSearchCollapsed(false);
  }, [showing?.key]);

  // ---------------------------------------------------------------- injection
  /**
   * Inject into one specific WebView.
   *
   * Everything went into the dashboard before, including the re-style passes
   * fired after an inner page loaded -- so inner pages were styled exactly once,
   * by their initial injectedJavaScript, and any late third-party script that
   * restyled them afterwards won.
   */
  const injectInto = useCallback((target: Target, script: string) => {
    let view: Web | null | undefined;
    if (target === 'home') {
      view = webRef.current;
    } else if (target === 'login') {
      view = loginRef.current;
    } else {
      view = layerRefs.current.get(target);
    }
    if (!view) {
      return;
    }
    try {
      view.injectJavaScript(script);
    } catch (e) {
      warn('inject failed', e);
    }
  }, []);

  /**
   * Apply the mobile stylesheet. Runs on every completed navigation because a
   * full page load discards the previously injected <style> node.
   */
  const applyStyles = useCallback(
    (target: Target, url: string) => {
      const script = getInjectionForUrl(url);
      if (!script) {
        log('injection skipped for', url);
        return;
      }
      injectInto(target, REPORT_CART_COUNT);
      if (target === 'home') {
        // The bar mirrors the dashboard's own announcements; an inner page
        // reporting its (possibly absent) bar would blank it.
        injectInto(target, REPORT_ANNOUNCEMENTS);
        // The rotating search prompts, read off the site's own search box. Only
        // from the dashboard: the reader is idempotent and one page's worth of
        // phrases is the whole list.
        injectInto(target, REPORT_SEARCH_PLACEHOLDERS);
      }
      // Re-apply on a short schedule. The page keeps loading images and
      // third-party scripts well after onLoadEnd, and those late arrivals can
      // restyle the header after a single pass. The script is idempotent, so
      // repeating it is safe and cheap.
      RESTYLE_DELAYS.forEach(ms => {
        setTimeout(() => injectInto(target, script), ms);
      });
    },
    [injectInto],
  );

  // -------------------------------------------------------------- page stack
  /**
   * Open an inner page. Re-shows it from the keep-alive stack when it is still
   * mounted, so tapping the same product twice costs one page load, not two.
   */
  const showPage = useCallback((url: string) => {
    setStack(prev => openPage(prev, url));
  }, []);

  /**
   * Return to the dashboard. It is still mounted, so this is instant -- and its
   * scroll position is left alone: the user asked not to be sent back to the
   * top of a page they had already loaded.
   */
  const dismissPages = useCallback(() => {
    if (onDashboard(stackRef.current)) {
      // Tapping the logo while already home is the one place a jump to the top
      // is being asked for. Returning from a page is not: that is somewhere the
      // user already was, and it used to be reset to the top on every Back,
      // which reads as a reload even though the page never left memory.
      injectInto('home', 'window.scrollTo({top: 0, behavior: "smooth"}); true;');
      return;
    }
    setStack(prev => goToDashboard(prev));
    // The cart may have changed while away; re-read the site's own counter.
    injectInto('home', REPORT_CART_COUNT);
  }, [injectInto]);

  /**
   * Bring the dashboard to the front without the logo's scroll-to-top.
   *
   * `dismissPages` treats "already home" as a request to jump to the top, which
   * is right for the logo and for the Zigly tab and wrong for everything else:
   * opening the account section would silently throw away the customer's place
   * on the home page behind it, which they would find on the way back.
   */
  const clearPages = useCallback(() => {
    if (onDashboard(stackRef.current)) {
      return;
    }
    setStack(prev => goToDashboard(prev));
    injectInto('home', REPORT_CART_COUNT);
  }, [injectInto]);

  /**
   * One step back out of the inner pages: through the visible layer's own
   * history first, then out of the layer itself.
   */
  const stepBack = useCallback(() => {
    const current = visibleLayer(stackRef.current);
    if (!current) {
      return false;
    }
    if (current.canGoBack) {
      layerRefs.current.get(current.key)?.goBack();
      return true;
    }
    setStack(prev => closeTopPage(prev));
    injectInto('home', REPORT_CART_COUNT);
    return true;
  }, [injectInto]);

  // ------------------------------------------------------------------ search
  /**
   * Ask the page for suggestions, debounced.
   *
   * Cancelling the timer is the whole of the "cancel in-flight" story: a
   * request already sent cannot be recalled, so its reply is discarded by
   * token instead. That is cheaper than aborting and behaves the same.
   */
  const requestSuggestions = useCallback(
    (query: string) => {
      cancelSuggestTimers();
      const trimmed = query.trim();
      if (trimmed.length < MIN_QUERY_LENGTH) {
        // One or two letters match half the catalogue; the screen shows
        // recents until there is enough to go on.
        setSuggestions(null);
        setSearchBusy(false);
        return;
      }
      setSearchBusy(true);
      searchTimer.current = setTimeout(() => {
        searchTimer.current = null;
        searchToken.current += 1;
        const token = searchToken.current;
        injectInto('home', suggestScript(trimmed, token));
        searchTimeout.current = setTimeout(() => {
          searchTimeout.current = null;
          // Nothing came back. Stop the spinner rather than leaving it turning
          // on a request that is not coming; the next keystroke asks again.
          if (searchToken.current === token) {
            warn('no suggestions returned for', trimmed);
            setSearchBusy(false);
          }
        }, SUGGEST_TIMEOUT_MS);
      }, SUGGEST_DEBOUNCE_MS);
    },
    [cancelSuggestTimers, injectInto],
  );

  const changeSearchQuery = useCallback(
    (query: string) => {
      setSearchQuery(query);
      requestSuggestions(query);
    },
    [requestSuggestions],
  );

  const openSearch = useCallback(() => {
    setSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    // Cleared on the way out: reopening to a stale query and its results would
    // look like the app had remembered a search the user abandoned.
    setSearchQuery('');
    setSuggestions(null);
    setSearchBusy(false);
    cancelSuggestTimers();
  }, [cancelSuggestTimers]);

  /**
   * Hand a search to the website. The results page is SearchTap-rendered, so
   * it carries Zigly's own ranking, facets and sort -- none of which this app
   * reimplements.
   */
  const submitSearch = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) {
        return;
      }
      setRecents(prev => rememberSearch(prev, trimmed));
      closeSearch();
      showPage(`${ZIGLY_ORIGIN}/search?q=${encodeURIComponent(trimmed)}`);
    },
    [closeSearch, showPage],
  );

  /** A product, collection or completion tapped in the suggestion list. */
  const openFromSearch = useCallback(
    (url: string) => {
      setRecents(prev => rememberSearch(prev, searchQuery));
      closeSearch();
      showPage(url);
    },
    [closeSearch, searchQuery, showPage],
  );

  // ---------------------------------------------------------------- wishlist
  const openWishlist = useCallback(() => {
    // Re-read every time it opens: the shopper may have saved something on a
    // product page since. Asked of the dashboard, which is already loaded, so
    // the answer costs one storage read plus a request per saved product.
    setWishlist(null);
    setShowCart(false);
    setWishlistOpen(true);
    injectInto('home', WISHLIST_SCRIPT);
  }, [injectInto]);

  const closeWishlist = useCallback(() => {
    setWishlistOpen(false);
    setWishlistNotice(null);
  }, []);

  /**
   * Un-save an item.
   *
   * The tile goes immediately. The write is a press of the site's own control
   * inside the dashboard WebView, which is quick but not instant, and waiting
   * for it would make the tap feel broken. The reply then either confirms it or
   * puts the tile back; see ../webview/wishlistBridge for why it is verified.
   */
  const removeFromWishlist = useCallback(
    (item: WishlistItem) => {
      setWishlist(prev => {
        if (!prev) {
          return prev;
        }
        const at = prev.findIndex(saved => saved.handle === item.handle);
        if (at === -1) {
          return prev;
        }
        pendingRemovals.current.set(item.handle, {item, at});
        return prev.filter(saved => saved.handle !== item.handle);
      });
      setWishlistNotice(null);
      injectInto('home', removeFromWishlistScript(item.handle));
    },
    [injectInto],
  );

  /** Put a tile back, at the position it held, and say why. */
  const restoreWishlistItem = useCallback((handle: string, why: string) => {
    const pending = pendingRemovals.current.get(handle);
    pendingRemovals.current.delete(handle);
    if (!pending) {
      return;
    }
    setWishlist(prev => {
      if (!prev) {
        return prev;
      }
      const next = prev.slice();
      next.splice(Math.min(pending.at, next.length), 0, pending.item);
      return next;
    });
    warn('wishlist removal not confirmed:', handle, why);
    setWishlistNotice(
      'Could not remove that from your wishlist. Open the product to remove it there.',
    );
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
    }
    noticeTimer.current = setTimeout(() => {
      noticeTimer.current = null;
      setWishlistNotice(null);
    }, 6000);
  }, []);

  const closeCart = useCallback(() => {
    setShowCart(false);
    // The badge may have changed while the cart was open.
    injectInto('home', REPORT_CART_COUNT);
  }, [injectInto]);

  const openCart = useCallback(() => {
    setCart(null);
    setShowCart(true);
    injectInto('home', READ_CART_SCRIPT);
  }, [injectInto]);

  // ----------------------------------------------------------------- account
  /**
   * Ask the site who is signed in.
   *
   * Every account read goes through the dashboard WebView, which is mounted for
   * the life of the app and holds the session -- the same route the cart and the
   * search suggestions take, and the reason the app and the website are one
   * signed-in customer rather than two.
   */
  const probeAccount = useCallback(() => {
    injectInto('home', ACCOUNT_PROBE);
  }, [injectInto]);

  const probeAddresses = useCallback(() => {
    setAddresses(null);
    injectInto('home', ADDRESSES_PROBE);
  }, [injectInto]);

  /** The country list is the same for every customer, so it is asked for once. */
  const probeCountries = useCallback(() => {
    if (countriesAsked.current) {
      return;
    }
    countriesAsked.current = true;
    injectInto('home', COUNTRIES_PROBE);
  }, [injectInto]);

  /**
   * Apply an auth answer.
   *
   * Kept in one place because three different messages carry one -- the account
   * read, the sign-out reply and the login screen's own navigation -- and they
   * must all leave the app in the same state. Anything that is not a definite
   * yes or no is left alone: an errored probe is not evidence of a signed-out
   * customer, and treating it as one would sign people out on a dropped packet.
   */
  const applyAuth = useCallback((state: AuthState) => {
    setAuth(state);
    setAccountScreens(prev => resolveAuth(prev, state));
    if (state === 'signedOut') {
      setCustomer(null);
      setOrders(null);
      setAddresses(null);
      setEditing(null);
    }
  }, []);

  /**
   * Open the account section.
   *
   * Signed out this is the login screen, which is the requirement this feature
   * exists for: the tab must not open the website's account page. The state is
   * re-checked on every open, because a session can expire while the app is
   * sitting on the dashboard.
   */
  const openAccountSection = useCallback(() => {
    setAccountNotice(null);
    // Always to the front. Page layers are drawn over the section, so a section
    // opened from a link inside a page -- the drawer's Login/Register, say --
    // would otherwise open underneath the page it was opened from.
    clearPages();
    setAccountScreens(openAccount(authRef.current));
    probeAccount();
  }, [clearPages, probeAccount]);

  const closeAccountSection = useCallback(() => {
    setAccountScreens(closeAccount());
  }, []);

  /** One step back inside the section. Empty means it has closed. */
  const stepBackAccount = useCallback((): boolean => {
    if (accountScreensRef.current.length === 0) {
      return false;
    }
    setAccountScreens(prev => popScreen(prev));
    return true;
  }, []);

  const openAccountRow = useCallback(
    (row: 'orders' | 'address' | 'favorites') => {
      if (row === 'favorites') {
        // The same wishlist the bottom navigation opens, and the same state:
        // there is one wishlist screen in this app, reached from two places.
        openWishlist();
        return;
      }
      if (row === 'orders') {
        setAccountScreens(prev => pushScreen(prev, 'orders'));
        // Orders arrive with the account read, so this is usually already
        // filled. Re-asked only when that read did not land.
        if (orders === null) {
          probeAccount();
        }
        return;
      }
      setAddressNotice(null);
      setAccountScreens(prev => pushScreen(prev, 'address'));
      probeAddresses();
    },
    [openWishlist, orders, probeAccount, probeAddresses],
  );

  const openEditProfile = useCallback(() => {
    setAccountScreens(prev => pushScreen(prev, 'editProfile'));
  }, []);

  /**
   * Keep a profile edit, and come back.
   *
   * Kept, not sent. Shopify's storefront has no endpoint that changes a
   * customer's name or email, so this is an overlay over what the site
   * rendered -- see ../account/accountData, and the notice on the form itself.
   * When a profile endpoint exists this is the one function that changes.
   */
  const saveProfile = useCallback((edits: ProfileEdits) => {
    setProfileEdits(edits);
    setAccountScreens(prev => popScreen(prev));
  }, []);

  // ------------------------------------------------------------- menu drawer
  /**
   * Open the drawer, and re-read the menu while it slides in.
   *
   * Read on every tap rather than once: `drawerExtras` appends Store Locator,
   * Blogs and About Us to the site's own list a second or two after load, and
   * a menu captured before that would be missing them for the rest of the
   * session. The reply is cheap and the drawer already has the previous one to
   * show in the meantime, so there is nothing to wait for.
   */
  const openMenu = useCallback(() => {
    setMenuOpen(true);
    injectInto('home', READ_MENU_SCRIPT);
  }, [injectInto]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  /**
   * A row in the drawer was tapped.
   *
   * The support block at the foot of the menu is `tel:`, `mailto:` and a
   * WhatsApp link, so those go to the OS. Everything else is a storefront page
   * -- except Zigly's own account route, which this app answers natively; see
   * `handleShouldStart` for the same rule applied to links inside the page.
   */
  const openFromMenu = useCallback(
    (url: string) => {
      closeMenu();
      const action = classifyUrl(url);
      if (action.kind === 'appIntent' || action.kind === 'external') {
        Linking.openURL(action.url).catch(() =>
          warn('could not open', action.url),
        );
        return;
      }
      if (isAccountUrl(url)) {
        openAccountSection();
        return;
      }
      closeAccountSection();
      setWishlistOpen(false);
      showPage(url);
    },
    [closeAccountSection, closeMenu, openAccountSection, showPage],
  );

  const openAccountFromMenu = useCallback(() => {
    closeMenu();
    setWishlistOpen(false);
    openAccountSection();
  }, [closeMenu, openAccountSection]);

  const openAddressForm = useCallback(
    (address: Address | null) => {
      setEditing(address);
      setAddressError(null);
      probeCountries();
      setAccountScreens(prev => pushScreen(prev, 'addressForm'));
    },
    [probeCountries],
  );

  /**
   * Stop waiting for a write that is not going to answer.
   *
   * Both writes confirm themselves by re-reading the list, so a reply is two
   * requests away. If the page navigated or the renderer was killed in between,
   * nothing comes back -- and a Save button that spins for ever looks exactly
   * like an app that has crashed.
   */
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearWriteWatch = useCallback(() => {
    if (writeTimer.current) {
      clearTimeout(writeTimer.current);
      writeTimer.current = null;
    }
  }, []);

  const watchWrite = useCallback(
    (giveUp: () => void) => {
      clearWriteWatch();
      writeTimer.current = setTimeout(() => {
        writeTimer.current = null;
        giveUp();
      }, WRITE_TIMEOUT_MS);
    },
    [clearWriteWatch],
  );

  useEffect(() => clearWriteWatch, [clearWriteWatch]);

  const saveAddress = useCallback(
    (fields: AddressFields) => {
      setSavingAddress(true);
      setAddressError(null);
      watchWrite(() => {
        warn('address save never reported back');
        setSavingAddress(false);
        setAddressError(
          'That did not reach Zigly. Check your connection and try again.',
        );
      });
      injectInto(
        'home',
        saveAddressScript(fields, editing ? editing.id : null),
      );
    },
    [editing, injectInto, watchWrite],
  );

  const deleteAddress = useCallback(
    (address: Address) => {
      Alert.alert(
        'Delete address',
        'Remove this address from your Zigly account?',
        [
          {text: 'Keep it', style: 'cancel'},
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              setAddressNotice(null);
              setAddresses(null);
              watchWrite(() => {
                warn('address delete never reported back');
                setAddressNotice(
                  'That did not reach Zigly. Your addresses are as they were.',
                );
                probeAddresses();
              });
              injectInto('home', deleteAddressScript(address.id));
            },
          },
        ],
      );
    },
    [injectInto, probeAddresses, watchWrite],
  );

  /**
   * Sign out.
   *
   * The site's own /account/logout, fetched inside the WebView so the one
   * shared cookie jar is what gets cleared. The screen is not updated here: it
   * waits for the reply, because an account screen that says "signed out" over
   * a website that is still signed in is the one outcome worse than a moment's
   * delay.
   */
  const logOut = useCallback(() => {
    setAccountNotice(null);
    injectInto('home', LOGOUT_SCRIPT);
  }, [injectInto]);

  /**
   * Delete Account.
   *
   * READ THIS BEFORE THIS BUILD GOES TO ANY REAL CUSTOMER.
   *
   * It signs the customer out and tells them their account was deleted. Nothing
   * is deleted. Shopify's storefront exposes no endpoint that deletes a
   * customer -- only Zigly's own backend can, and this app has no access to it,
   * so the record, the orders and the addresses are all still there and signing
   * in again brings them back.
   *
   * This was asked for explicitly, with that consequence spelled out, to match
   * Zigly's own app while there is no endpoint behind it. It is written down
   * here rather than left to be discovered because it is the one screen in this
   * app that tells the customer something untrue about their own data.
   *
   * When a delete endpoint exists: call it here, and only sign out and show the
   * notice once it answers. The confirmation step below stays either way.
   */
  const requestAccountDeletion = useCallback(() => {
    Alert.alert(
      'Delete account',
      'This signs you out of the app. To have your Zigly account and its data ' +
        'removed for good, ask through their contact form or email ' +
        SUPPORT_EMAIL +
        '.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Open contact form',
          onPress: () => showPage(SUPPORT_PAGE_URL),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // logOut clears accountNotice, and the account screen is replaced
            // by the login screen a moment later -- so the confirmation has to
            // be the toast, which is drawn outside the section.
            logOut();
            setToastMessage('Deleted user');
          },
        },
      ],
    );
  }, [logOut, showPage]);

  /**
   * A bottom-navigation tab.
   *
   * Tapping a tab is a reset to that tab's root: any native screen closes and
   * the page stack is dismissed, so the tab shows what the tab is for rather
   * than whatever was on top of it.
   */
  const selectTab = useCallback(
    (key: TabKey) => {
      setSearchOpen(false);
      setShowCart(false);

      if (key === 'account') {
        setWishlistOpen(false);
        // Brings the dashboard forward itself, so the section is never opened
        // underneath a page layer.
        openAccountSection();
        return;
      }

      if (key === 'wishlist') {
        closeAccountSection();
        clearPages();
        openWishlist();
        return;
      }

      setWishlistOpen(false);
      closeAccountSection();

      const tab = TABS.find(entry => entry.key === key);
      if (key === 'home' || !tab || !tab.url) {
        dismissPages();
        return;
      }
      showPage(tab.url);
    },
    [
      clearPages,
      closeAccountSection,
      dismissPages,
      openAccountSection,
      openWishlist,
      showPage,
    ],
  );

  // ------------------------------------------------------------ back button
  useEffect(() => {
    const onBack = (): boolean => {
      // The drawer is over everything, so it answers first: out of a category,
      // then out of the drawer.
      if (menuOpenRef.current) {
        if (!menuRef.current?.stepBack()) {
          closeMenu();
        }
        return true;
      }
      if (searchOpenRef.current) {
        closeSearch();
        return true;
      }
      if (wishlistOpenRef.current) {
        closeWishlist();
        return true;
      }
      if (showCartRef.current) {
        closeCart();
        return true;
      }
      // Page layers first, then the account section: a page opened from inside
      // the section (an order, a product from Favorites) is drawn over it, so
      // Back has to take the page off before it takes a step in the section.
      if (stepBack()) {
        return true;
      }
      if (stepBackAccount()) {
        return true;
      }
      if (canGoBackRef.current) {
        webRef.current?.goBack();
        // Consumed: keep the app open while the dashboard still has history.
        return true;
      }
      // No history left — let Android close the app.
      return false;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBack,
    );
    return () => subscription.remove();
  }, [
    closeCart,
    closeMenu,
    closeSearch,
    closeWishlist,
    stepBack,
    stepBackAccount,
  ]);

  // ------------------------------------------------------------- url policy
  const handleShouldStart = useCallback(
    (request: ShouldStartLoadRequest): boolean => {
      // Sub-frames (payment iframes, embedded video) are not ours to police.
      if (request.isTopFrame === false) {
        return true;
      }

      const {url} = request;

      // The account area is native now, so the site's own links into it are
      // taken over rather than followed. Without this, the drawer's
      // "Login/Register" and the theme's account links would still show
      // Shopify's account page inside the app -- the web experience the native
      // section exists to replace. The one exception is an order's own page,
      // which `isAccountUrl` deliberately leaves out; see urlUtils.
      if (isAccountUrl(url)) {
        log('account link taken over ->', url);
        openAccountSection();
        return false;
      }

      const action = classifyUrl(url, inCheckoutRef.current);

      switch (action.kind) {
        case 'allow':
          return true;

        case 'rewrite':
          log('rewriting navigation ->', action.url);
          // Cancel this one and issue the corrected navigation instead.
          setTimeout(() => {
            webRef.current?.injectJavaScript(
              `window.location.replace(${JSON.stringify(action.url)}); true;`,
            );
          }, 0);
          return false;

        case 'appIntent':
          Linking.openURL(action.url).catch(() => {
            warn('no handler installed for', action.url);
            Alert.alert(
              'App not found',
              'No installed app can open this link. Please choose another option.',
            );
          });
          return false;

        case 'external':
          Linking.openURL(action.url).catch(() =>
            warn('could not open externally:', action.url),
          );
          return false;

        case 'block':
          warn('blocked navigation:', action.reason, url);
          return false;

        default:
          return true;
      }
    },
    [openAccountSection],
  );

  /**
   * Navigation policy inside the login screen, which is deliberately looser
   * than everywhere else.
   *
   * Login is SimplyOTP's, and an OTP provider may take the page through its own
   * host to complete the sign-in -- auth.lucentcommerce.com, a reCAPTCHA check,
   * a magic-token hop back to the storefront. Under the ordinary policy an
   * unrecognised host is handed to the system browser, and that would produce
   * exactly the defect this whole feature exists to fix: the app opening Chrome
   * in the middle of logging in, with the session landing somewhere the app
   * cannot see.
   *
   * So inside this one WebView every https destination renders, which is the
   * same relaxation checkout already gets and for the same reason: a flow that
   * must complete cannot be policed by a list of hosts nobody controls. It is
   * narrow -- one screen, torn down the moment login finishes -- and it never
   * relaxes the two things that matter: cleartext is still upgraded, and
   * non-web schemes still go to the OS rather than being rendered.
   */
  const handleLoginShouldStart = useCallback(
    (request: ShouldStartLoadRequest): boolean => {
      if (request.isTopFrame === false) {
        return true;
      }
      const action = classifyUrl(request.url, true);
      switch (action.kind) {
        case 'appIntent':
          Linking.openURL(action.url).catch(() =>
            warn('no handler for', action.url),
          );
          return false;
        case 'rewrite':
          setTimeout(() => {
            loginRef.current?.injectJavaScript(
              `window.location.replace(${JSON.stringify(action.url)}); true;`,
            );
          }, 0);
          return false;
        case 'block':
          warn('blocked during login:', action.reason, request.url);
          return false;
        default:
          // Both 'allow' and 'external' render here.
          return true;
      }
    },
    [],
  );

  /**
   * Watch the login screen for the moment it succeeds.
   *
   * The signal is Shopify's own: /account redirects to /account/login without a
   * session, so arriving at any Zigly page that is *not* the login form means
   * the session now exists. That is a fact about the server's behaviour rather
   * than a guess at the widget's internals, which is why it is what this
   * watches -- SimplyOTP's success screen is a class name that could be
   * renamed in an app update, and a redirect is not.
   *
   * The auth state is flipped here rather than waiting for the probe to answer:
   * the login WebView is showing the website's own account page at this moment,
   * and that page must not be what the customer sees.
   */
  const handleLoginNav = useCallback(
    (nav: WebViewNavigation) => {
      const parsed = parseUrl(nav.url);
      if (!parsed || !isInternalHost(parsed.host)) {
        // Mid-flow, on the provider's host. Not an answer either way.
        return;
      }
      if (parsed.path.toLowerCase().indexOf('/account/login') === 0) {
        return;
      }
      log('login completed, landed on', nav.url);
      applyAuth('signedIn');
      probeAccount();
    },
    [applyAuth, probeAccount],
  );

  /**
   * The dashboard's handler. Anything that is not the dashboard is handed to a
   * page layer, so the dashboard is never navigated away from and stays instant
   * to return to.
   *
   * Only the dashboard diverts. A page layer navigates in place and keeps a
   * real back history, because on Android `navigationType` is always 'other' --
   * there is no way to tell a tapped link from a redirect or a form post, so
   * pushing a layer per navigation would fragment checkout and login flows.
   */
  const handleHomeShouldStart = useCallback(
    (request: ShouldStartLoadRequest): boolean => {
      if (
        request.isTopFrame !== false &&
        !isHomeUrl(request.url) &&
        !isAccountUrl(request.url) &&
        classifyUrl(request.url).kind === 'allow'
      ) {
        showPage(request.url);
        return false;
      }
      // Account urls fall through to the shared handler, which takes them over.
      return handleShouldStart(request);
    },
    [handleShouldStart, showPage],
  );

  // ------------------------------------------------------------- navigation
  const handleNavStateChange = useCallback((nav: WebViewNavigation) => {
    canGoBackRef.current = nav.canGoBack;

    // A new page starts at the top; do not carry the collapsed state across.
    setSearchCollapsed(false);

    const nowInCheckout = isCheckoutUrl(nav.url);
    if (nowInCheckout !== inCheckoutRef.current) {
      inCheckoutRef.current = nowInCheckout;
      // The bottom bar comes down over Shopify's checkout: it is not this app's
      // screen, and a tab bar across the foot of a payment page is one mistap
      // away from abandoning a paid-for basket.
      setInCheckout(nowInCheckout);
      log(nowInCheckout ? 'entered checkout flow' : 'left checkout flow');
    }
  }, []);

  const handleLoadEnd = useCallback(
    (event: {nativeEvent: {url: string}}) => {
      setLoadingTarget(prev => (prev === 'home' ? null : prev));
      applyStyles('home', event.nativeEvent.url);
      if (!firstLoadDone.current) {
        firstLoadDone.current = true;
        onFirstLoad();
      }
    },
    [applyStyles, onFirstLoad],
  );

  /**
   * Collapse the search band on scroll, restore it near the top.
   *
   * Hysteresis on purpose: collapsing at 48px but only restoring below 12px
   * stops the band flickering open and shut when a finger rests mid-scroll.
   */
  const handleScroll = useCallback((y: number) => {
    setSearchCollapsed(prev => {
      if (!prev && y > 48) {
        return true;
      }
      if (prev && y < 12) {
        return false;
      }
      return prev;
    });
  }, []);

  /** Every account reply. Returns true when the message was one of ours. */
  const handleAccountMessage = useCallback(
    (data: Record<string, unknown>): boolean => {
      switch (data.tag) {
        case 'account': {
          const state: AuthState =
            data.state === 'signedIn'
              ? 'signedIn'
              : data.state === 'signedOut'
              ? 'signedOut'
              : 'unknown';
          applyAuth(state);
          if (state === 'signedIn') {
            setCustomer(parseCustomer(data));
            setOrders(parseOrders(data, ZIGLY_ORIGIN));
            // What the theme actually gave us. Logged rather than shown, so a
            // single device run says which fields this store renders instead
            // of leaving the thin ones assumed.
            log('account read via', data.via, JSON.stringify(data.probe ?? {}));
          } else {
            log('account read:', state, 'via', data.via);
          }
          return true;
        }

        case 'addresses': {
          if (data.state === 'signedOut') {
            applyAuth('signedOut');
            return true;
          }
          setAddresses(parseAddresses(data));
          return true;
        }

        case 'countries': {
          const list = parseCountries(data);
          setCountries(list);
          if (list.length === 0) {
            // Asked again next time the form opens: without this list the
            // Country field cannot be filled at all.
            countriesAsked.current = false;
            warn('country list came back empty');
          }
          return true;
        }

        case 'address-saved': {
          clearWriteWatch();
          setSavingAddress(false);
          if (data.ok === true) {
            setAddressError(null);
            setEditing(null);
            // Back to the list, which re-reads: the address on screen is then
            // the one Shopify actually holds, not the one that was typed.
            setAccountScreens(prev => popScreen(prev));
            probeAddresses();
          } else if (data.reason === 'signedOut') {
            applyAuth('signedOut');
          } else {
            // Shopify answers a rejected address with the form again rather
            // than an error, so the only honest report is that it did not
            // arrive -- and the form keeps what was typed.
            warn('address not saved:', data.reason);
            setAddressError(
              'Zigly did not accept that address. Check the street, city and PIN code and try again.',
            );
          }
          return true;
        }

        case 'address-deleted': {
          clearWriteWatch();
          if (data.ok === true) {
            setAddressNotice(null);
          } else if (data.reason === 'signedOut') {
            applyAuth('signedOut');
            return true;
          } else {
            warn('address not deleted:', data.reason);
            setAddressNotice(
              'That address could not be removed. It is still on your account.',
            );
          }
          probeAddresses();
          return true;
        }

        case 'auth': {
          if (data.state === 'signedOut') {
            applyAuth('signedOut');
          } else if (data.from === 'logout') {
            // The request went through and the customer is still signed in.
            warn('logout did not clear the session');
            setAccountNotice(
              'Sign out did not go through. Check your connection and try again.',
            );
          }
          return true;
        }

        default:
          return false;
      }
    },
    [applyAuth, clearWriteWatch, probeAddresses],
  );

  const retry = useCallback(() => {
    setLoadError(null);
    const current = visibleLayer(stackRef.current);
    if (current) {
      layerRefs.current.get(current.key)?.reload();
      return;
    }
    webRef.current?.reload();
  }, []);

  // ------------------------------------------------------------------ render
  const showError = offline || loadError !== null;

  /** The page the header is describing: an inner page, or the dashboard. */
  const headerUrl = showing ? showing.url : null;
  const onShopPage = headerUrl !== null && isShopUrl(headerUrl);
  /** Keys are monotonic, so this is mount order: stable for the tree. */
  const mountOrder = [...stack.layers].sort((a, b) => a.key - b.key);

  const accountTop = topScreen(accountScreens);
  /**
   * Whether an account screen is the thing on screen.
   *
   * Two ways it can be open but not on top, and both matter:
   *
   *   - a page layer, which is drawn *over* the section. That is what lets an
   *     order, or a product opened from Favorites, come back to the screen it
   *     was opened from instead of to the dashboard.
   *   - an overlay. Favorites opens the same wishlist screen the tab opens, and
   *     while that is up the header and the bar have to describe the wishlist --
   *     otherwise the bag disappears from the one screen the reference app
   *     shows it counting on.
   */
  const overlayOpen = showCart || wishlistOpen || searchOpen;
  const onAccountScreen =
    accountTop !== null && showing === null && !overlayOpen;
  const onOrdersScreen = onAccountScreen && accountTop === 'orders';

  /**
   * The customer as the screens should show them.
   *
   * What the site rendered, with any local edit over the top. Composed once,
   * here, so the account screen, the profile form and the drawer cannot drift
   * from one another -- the drawer's account block reads the same object.
   */
  const shownCustomer =
    customer === null ? null : applyProfileEdits(customer, profileEdits);

  /** Progress is only ever drawn for whatever the user is actually looking at. */
  const busy =
    !showCart &&
    !showError &&
    loadingTarget !== null &&
    (onAccountScreen
      ? // The one account screen that loads anything is login.
        loadingTarget === 'login'
      : showing
      ? loadingTarget === showing.key
      : loadingTarget === 'home');

  /**
   * Which tab is lit.
   *
   * Null on screens no tab describes -- the cart, search, a product page -- so
   * nothing is highlighted that would not be returned to by tapping it.
   */
  const activeTab: TabKey | null = (() => {
    // Overlays first: the wishlist opened from the account screen is still the
    // wishlist tab, not the account tab.
    if (wishlistOpen) {
      return 'wishlist';
    }
    if (searchOpen || showCart) {
      return null;
    }
    if (accountTop !== null && showing === null) {
      return 'account';
    }
    if (headerUrl === null) {
      return 'home';
    }
    const path = (parseUrl(headerUrl)?.path ?? '').toLowerCase();
    if (path === '/collections' || path === '/collections/') {
      return 'collections';
    }
    if (path.indexOf('/pages/pet-breeds') === 0) {
      return 'breeds';
    }
    return null;
  })();

  /**
   * When the bar stands down.
   *
   * Search, because it is keyboard-first and the bar would sit on the keyboard.
   * Checkout, because that page is Shopify's and not somewhere to offer five
   * ways out. Listing pages, because the injected Sort / Filter bar already
   * pins itself there and the reference app shows that bar *instead of* the
   * tabs. And the login screen, which is a single-purpose screen in the
   * reference app too.
   */
  const showNav =
    !searchOpen &&
    // The drawer is a screen of its own while it is open, as it is in the
    // reference app: nothing under it should be offering a second way out.
    !menuOpen &&
    !inCheckout &&
    !(onAccountScreen && accountTop === 'login') &&
    !(headerUrl !== null && showsSortFilterBar(headerUrl));

  return (
    <View style={styles.root}>
      {/*
        On every page, as the reference app has it -- its collection list and
        its product grid both carry the offer strip above the header. An earlier
        version showed it on the dashboard only, to save 38px on inner pages;
        the reference says otherwise, and the reference is the brief.

        The search screen is the exception: it is a keyboard-first screen, and
        a scrolling promotion above the field is noise while typing.
      */}
      <AnnouncementBar
        items={
          searchOpen ||
          wishlistOpen ||
          // The reference app carries the strip on its Account screen but not
          // on the screens below it, nor on login.
          (onAccountScreen && accountTop !== 'account')
            ? []
            : announcements
        }
      />

      {/*
        Drawn once, above `body`, so it survives every page, the cart and the
        offline screen -- no inner page can cover it, and the back arrow is
        therefore always there.
      */}
      <NativeHeader
        cartCount={cartCount}
        // Dashboard and shopping pages carry the search band; breed and content
        // pages show only the back arrow and the logo.
        // The search screen brings its own field, so the band stands down.
        showSearch={
          (headerUrl === null || onShopPage) &&
          !showCart &&
          !searchOpen &&
          !wishlistOpen &&
          !onAccountScreen
        }
        // No wishlist on the dashboard -- that matches the reference too. The
        // cart screen is the other place it appears: the reference drops the
        // bag there (you are already in the bag) and shows the heart instead.
        // And never on the wishlist itself, for the same reason.
        //
        // Orders is the one account screen that carries both icons, as the
        // reference app's Orders screen does; the rest show only back and logo.
        showWishlist={
          (onShopPage || showCart || onOrdersScreen) &&
          !searchOpen &&
          !wishlistOpen
        }
        // The bag rides along on every page, so the cart is always one tap
        // away; only the cart and search screens drop it. On the wishlist it
        // carries the count, exactly as the reference shows.
        showCartIcon={
          !showCart && !searchOpen && (!onAccountScreen || onOrdersScreen)
        }
        searchCollapsed={searchCollapsed}
        searchPlaceholders={searchPlaceholders}
        searchTypeMs={searchTypeMs}
        showBack={
          headerUrl !== null ||
          showCart ||
          searchOpen ||
          wishlistOpen ||
          onAccountScreen
        }
        onWishlistPress={openWishlist}
        onBackPress={() => {
          // Same rule as the hardware back button.
          if (searchOpen) {
            closeSearch();
          } else if (wishlistOpen) {
            closeWishlist();
          } else if (showCart) {
            closeCart();
          } else if (!stepBack() && !stepBackAccount() && canGoBackRef.current) {
            webRef.current?.goBack();
          }
        }}
        onMenuPress={openMenu}
        onCartPress={openCart}
        onLogoPress={() => {
          // The logo means home, so the section comes down with the pages.
          closeAccountSection();
          dismissPages();
        }}
        onSearchPress={openSearch}
      />

      {/*
        Everything that can cover the page lives in here, so `top: 0` means
        "under the header" rather than "over it".
      */}
      <View style={styles.body}>
        <WebView<object>
          {...baseWebViewProps}
          ref={webRef}
          source={{uri: START_URL}}
          style={styles.web}
          injectedJavaScript={getInjectionForUrl(START_URL) ?? undefined}
          // Runs before the page's own scripts, so the site's header never
          // flashes alongside ours.
          injectedJavaScriptBeforeContentLoaded={EARLY_HEADER_CSS}
          onShouldStartLoadWithRequest={handleHomeShouldStart}
          onNavigationStateChange={handleNavStateChange}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
            handleScroll(e.nativeEvent.contentOffset.y)
          }
          onLoadStart={() => {
            setLoadingTarget('home');
            // Hide the site's header as early as Android will let us.
            //
            // injectedJavaScriptBeforeContentLoaded is unreliable on Android
            // WebView -- it frequently lands after first paint, which is why the
            // site's own header still flashed alongside our native one.
            // onLoadStart fires at the very beginning of the navigation, so
            // injecting here as well gives the rule a second, earlier chance to
            // land. It is idempotent, so running twice costs nothing.
            injectInto('home', EARLY_HEADER_CSS);
          }}
          onLoadEnd={handleLoadEnd}
          onError={({nativeEvent}) => {
            warn('load error:', nativeEvent.description);
            setLoadError(nativeEvent.description ?? 'Load failed');
            // Still release the splash, otherwise it hides the error screen.
            if (!firstLoadDone.current) {
              firstLoadDone.current = true;
              onFirstLoad();
            }
          }}
          onHttpError={({nativeEvent}) => {
            // Shopify serves a real 404 page; only surface server-side failures.
            if (nativeEvent.statusCode >= 500) {
              warn('http error:', nativeEvent.statusCode, nativeEvent.url);
              setLoadError(`Server error ${nativeEvent.statusCode}`);
            }
          }}
          onMessage={({nativeEvent}) => {
            try {
              const data = JSON.parse(nativeEvent.data);
              if (data && handleAccountMessage(data)) {
                return;
              }
              if (data && data.tag === 'search-diag') {
                log('SEARCHDIAG', JSON.stringify(data));
              } else if (data && data.tag === 'cart-count') {
                setCartCount(typeof data.n === 'number' ? data.n : 0);
              } else if (data && data.tag === 'menu') {
                setMenu(parseMenu(data, ZIGLY_ORIGIN));
              } else if (data && data.tag === 'dashboard-ready') {
                onFirstLoad();
                // Read the menu now so the first tap of the hamburger opens on
                // a filled drawer rather than a spinner.
                injectInto('home', READ_MENU_SCRIPT);
                // Who is signed in, asked once the dashboard is settled. The
                // answer decides what the Account tab opens, and asking now
                // means the tap does not have to wait for a round trip.
                probeAccount();
                // Warm the next pages, but only on an unmetered connection.
                if (unmeteredRef.current) {
                  injectInto('home', PREFETCH_SCRIPT);
                } else {
                  log('prefetch skipped: metered connection');
                }
              } else if (data && data.tag === 'cart-data') {
                setCart(
                  data.error
                    ? null
                    : {
                        itemCount: data.itemCount ?? 0,
                        totalPrice: data.totalPrice ?? 0,
                        originalTotalPrice: data.originalTotalPrice ?? 0,
                        totalDiscount: data.totalDiscount ?? 0,
                        items: Array.isArray(data.items) ? data.items : [],
                      },
                );
              } else if (data && data.tag === 'cart-added') {
                setCartToast(true);
              } else if (data && data.tag === 'wishlist') {
                // Read out of the site's own localStorage by the dashboard
                // itself; see ../webview/wishlistBridge.
                const read = parseWishlist(data, ZIGLY_ORIGIN);
                log('wishlist:', read.items.length, 'of', data.found, 'saved');
                pendingRemovals.current.clear();
                setWishlist(read.items);
              } else if (data && data.tag === 'wishlist-removed') {
                if (data.ok) {
                  // Already off screen; nothing left to do but forget it.
                  pendingRemovals.current.delete(data.handle);
                } else {
                  restoreWishlistItem(data.handle, data.reason || '');
                }
              } else if (data && data.tag === 'announcements') {
                setAnnouncements(Array.isArray(data.items) ? data.items : []);
              } else if (data && data.tag === 'search-placeholders') {
                // One message per phrase the site finishes typing, so this
                // folds in rather than replaces -- see mergePlaceholders.
                setSearchPlaceholders(current =>
                  mergePlaceholders(current, data.items),
                );
                setSearchTypeMs(current => acceptInterval(data.typeMs, current));
              } else if (data && data.tag === 'search-suggest') {
                // Anything but the newest request is an answer to a keystroke
                // the user has already typed past.
                if (data.token === searchToken.current) {
                  setSuggestions(parseSuggestions(data, ZIGLY_ORIGIN));
                  setSearchBusy(false);
                }
              }
            } catch {
              // Page scripts may postMessage for their own reasons. Not ours.
            }
          }}
          onRenderProcessGone={() => {
            // Android may kill the renderer under memory pressure. Recover in
            // place rather than letting the screen go permanently blank.
            warn('render process gone — reloading');
            webRef.current?.reload();
          }}
        />

        {/*
          The account section.

          Drawn *below* the page layers on purpose. A tap inside the section can
          open a real page -- an order, or a product from Favorites -- and that
          page has to come down over the section so that Back returns to the
          screen it was opened from rather than to the dashboard. It is above the
          dashboard, which is what makes the section a screen at all.

          One screen at a time: these are cheap native views, so the top of the
          stack is the only one mounted. The section as a whole is what survives
          a page opening over it, not each screen's scroll position.
        */}
        {accountTop === 'account' ? (
          <View style={styles.pageLayer}>
            <AccountScreen
              customer={shownCustomer}
              notice={accountNotice}
              onOpenRow={openAccountRow}
              onEditProfile={openEditProfile}
              onLogOut={logOut}
              onDeleteAccount={requestAccountDeletion}
            />
          </View>
        ) : null}

        {accountTop === 'editProfile' && shownCustomer !== null ? (
          <View style={styles.pageLayer}>
            <EditProfileScreen
              customer={shownCustomer}
              onSave={saveProfile}
            />
          </View>
        ) : null}

        {accountTop === 'orders' ? (
          <View style={styles.pageLayer}>
            <OrdersScreen
              orders={orders}
              onOpenOrder={order => showPage(order.url)}
            />
          </View>
        ) : null}

        {accountTop === 'address' ? (
          <View style={styles.pageLayer}>
            <AddressScreen
              addresses={addresses}
              notice={addressNotice}
              onAdd={() => openAddressForm(null)}
              onEdit={address => openAddressForm(address)}
              onDelete={deleteAddress}
            />
          </View>
        ) : null}

        {accountTop === 'addressForm' ? (
          <View style={styles.pageLayer}>
            <AddressFormScreen
              // Editing opens on the values Shopify holds, read out of the
              // theme's own edit form for that address.
              initial={editing ? editing.fields : EMPTY_ADDRESS_FIELDS}
              countries={countries}
              saving={savingAddress}
              error={addressError}
              onSave={saveAddress}
            />
          </View>
        ) : null}

        {/*
          The login screen: Zigly's own OTP widget, restyled into an app screen.
          Native chrome above and below it, the site's flow inside it -- see
          ../webview/loginRestyle.ts for why this is not a native form.

          Mounted only while it is the screen, so the widget starts clean on
          every visit; a half-finished OTP left over from last time would be a
          worse first impression than a fresh field.
        */}
        {accountTop === 'login' ? (
          <View style={styles.pageLayer}>
            <WebView<object>
              {...baseWebViewProps}
              ref={loginRef}
              source={{uri: LOGIN_URL}}
              style={styles.web}
              // The bespoke restyle only -- the mobile stylesheet is for shop
              // pages, and this screen is one modal widget on a blank ground.
              injectedJavaScript={LOGIN_RESTYLE}
              // Same reason it is used everywhere else: it hides the site's own
              // header as early as Android will allow, so it never flashes
              // above ours while the widget is still being built.
              injectedJavaScriptBeforeContentLoaded={EARLY_HEADER_CSS}
              onShouldStartLoadWithRequest={handleLoginShouldStart}
              onNavigationStateChange={handleLoginNav}
              onLoadStart={() => setLoadingTarget('login')}
              onLoadEnd={() => {
                setLoadingTarget(prev => (prev === 'login' ? null : prev));
                // Again after the load: the widget is built by a script that
                // runs later than this, and the restyle is idempotent.
                injectInto('login', LOGIN_RESTYLE);
              }}
              onError={({nativeEvent}) => {
                warn('login page error:', nativeEvent.description);
                setLoadingTarget(prev => (prev === 'login' ? null : prev));
              }}
              onMessage={({nativeEvent}) => {
                try {
                  const data = JSON.parse(nativeEvent.data);
                  if (data && data.tag === 'login') {
                    // 'missing' means the widget was not found and the page was
                    // left exactly as the site serves it. Worth knowing from a
                    // log rather than from a screenshot.
                    log('login screen:', data.state, data.detail);
                  }
                } catch {
                  // The page posts for its own reasons too.
                }
              }}
              onRenderProcessGone={() => {
                warn('login render process gone — reloading');
                loginRef.current?.reload();
              }}
            />
          </View>
        ) : null}

        {/*
          Every visited page, still mounted: the one on top on screen, the rest
          parked off it with their DOM, their scroll position and their session
          intact.

          Rendered in key order -- that is, mount order -- and never re-sorted.
          `stack.layers` is kept in least-recently-shown order for eviction, but
          following that order here would reorder the children on every
          navigation, and RN implements a reorder as detach-then-attach on the
          native view. Doing that to an Android WebView is asking for a blank
          one. Paint order does not matter anyway: only ever one layer is on
          screen, so nothing is stacked over anything.
        */}
        {mountOrder.map(layer => {
          const isVisible = showing !== null && showing.key === layer.key;
          return (
            <View
              key={layer.key}
              style={[styles.pageLayer, isVisible ? null : styles.parked]}
              pointerEvents={isVisible ? 'auto' : 'none'}>
              <WebView<object>
                {...baseWebViewProps}
                ref={view => {
                  if (view) {
                    layerRefs.current.set(layer.key, view);
                  } else {
                    layerRefs.current.delete(layer.key);
                  }
                }}
                // Never reassigned: `source` changing is what reloads a WebView.
                source={{uri: layer.source}}
                style={styles.web}
                injectedJavaScript={
                  getInjectionForUrl(layer.source) ?? undefined
                }
                injectedJavaScriptBeforeContentLoaded={EARLY_HEADER_CSS}
                onShouldStartLoadWithRequest={handleShouldStart}
                onNavigationStateChange={nav => {
                  setStack(prev =>
                    noteNavigation(prev, layer.key, nav.url, nav.canGoBack),
                  );
                  const nowInCheckout = isCheckoutUrl(nav.url);
                  if (nowInCheckout !== inCheckoutRef.current) {
                    inCheckoutRef.current = nowInCheckout;
                    setInCheckout(nowInCheckout);
                  }
                }}
                onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
                  handleScroll(e.nativeEvent.contentOffset.y)
                }
                onLoadStart={() => {
                  setLoadingTarget(layer.key);
                  injectInto(layer.key, EARLY_HEADER_CSS);
                }}
                onLoadEnd={e => {
                  setLoadingTarget(prev =>
                    prev === layer.key ? null : prev,
                  );
                  // The page has a document; the cover can come off.
                  markPainted(layer.key);
                  applyStyles(layer.key, e.nativeEvent.url);
                }}
                onError={({nativeEvent}) => {
                  // Not promoted to the offline screen: the header's back arrow
                  // is right there, so a failed inner page is escapable -- but
                  // only if the cover is not still over it.
                  warn('page load error:', nativeEvent.description);
                  markPainted(layer.key);
                  setLoadingTarget(prev =>
                    prev === layer.key ? null : prev,
                  );
                }}
                onMessage={({nativeEvent}) => {
                  try {
                    const data = JSON.parse(nativeEvent.data);
                    if (data && data.tag === 'cart-added') {
                      setCartToast(true);
                    } else if (data && data.tag === 'cart-count') {
                      setCartCount(typeof data.n === 'number' ? data.n : 0);
                    }
                  } catch {
                    // Page scripts may postMessage for their own reasons.
                  }
                }}
                onRenderProcessGone={() => {
                  warn('page render process gone — reloading');
                  layerRefs.current.get(layer.key)?.reload();
                }}
              />

              {/*
                Over the page until it has something to show.

                Without this, opening a category circle meant watching a Zigly
                page build itself out of a white rectangle -- they carry no
                cache-control and Cloudflare reports them DYNAMIC, so every one
                is a fresh download. The cover is the app's own screen instead,
                and it fades out rather than cutting, so the page arrives rather
                than appearing.

                Only over a layer that is actually on screen: a parked layer is
                already invisible, and covering it would keep its key out of the
                painted list for no reason.
              */}
              {isVisible && !paintedLayers.includes(layer.key) ? (
                <PageCover />
              ) : null}
            </View>
          );
        })}

        {showCart ? (
          <View style={styles.pageLayer}>
            <CartScreen
              cart={cart}
              onChangeQty={(key, quantity) =>
                injectInto('home', changeQtyScript(key, quantity))
              }
              onCheckout={() => {
                // Checkout stays entirely on the website.
                setShowCart(false);
                showPage(`${ZIGLY_ORIGIN}/checkout`);
              }}
              onOpenItem={url => {
                setShowCart(false);
                showPage(
                  url.indexOf('http') === 0 ? url : `${ZIGLY_ORIGIN}${url}`,
                );
              }}
              onContinueShopping={() => {
                // Straight back to the dashboard, which is still mounted --
                // there is nothing to come back to in an empty cart.
                setShowCart(false);
                dismissPages();
              }}
            />
          </View>
        ) : null}

        {wishlistOpen ? (
          <View style={styles.pageLayer}>
            <WishlistScreen
              items={wishlist}
              notice={wishlistNotice}
              onRemove={removeFromWishlist}
              onOpenItem={item => {
                closeWishlist();
                showPage(item.url);
              }}
              onAddToBag={item => {
                if (item.variantId === null) {
                  // More than one variant: the customer picks, not us.
                  closeWishlist();
                  showPage(item.url);
                  return;
                }
                // Into the same cart as everything else, via the dashboard
                // WebView. The toast and the badge follow from its reply.
                injectInto('home', addToCartScript(item.variantId));
              }}
            />
          </View>
        ) : null}

        {/*
          There is no hidden WebView here any more.

          One used to be mounted on /pages/swym-wishlist, off screen, purely so
          that Swym would run and render something for the bridge to scrape --
          an ~850 KB page load and up to twelve seconds of polling every time
          the screen was opened. Swym is not on this store, so it was polling for
          markup that was never coming. The wishlist is a list of handles in the
          page's own localStorage, and the dashboard WebView is already loaded
          and already has it; the read is injected there instead. That is the
          whole of "load the wishlist quickly".
        */}

        {searchOpen ? (
          <View style={styles.pageLayer}>
            <SearchScreen
              query={searchQuery}
              onQueryChange={changeSearchQuery}
              onSubmit={submitSearch}
              onOpenUrl={openFromSearch}
              suggestions={suggestions}
              busy={searchBusy}
              recents={recents}
              onClearRecents={() => setRecents([])}
            />
          </View>
        ) : null}

        {/*
          The menu, over every layer in `body` but still under the header --
          the hamburger that opened it stays where it was, which is what makes
          tapping it again, or the page beside it, the obvious way out.
        */}
        <MenuDrawer
          ref={menuRef}
          open={menuOpen}
          items={menu}
          auth={auth}
          customer={shownCustomer}
          onClose={closeMenu}
          onNavigate={openFromMenu}
          onAccountPress={openAccountFromMenu}
        />

        {busy ? <LoadingBar /> : null}

        {/*
          Inside `body` too, so the header stays reachable: the offline screen
          used to cover it, leaving Retry as the only way out.
        */}
        {showError ? (
          <NetworkErrorScreen
            onRetry={retry}
            detail={offline ? null : loadError}
          />
        ) : null}
      </View>

      {/*
        The bottom navigation, outside `body` exactly as the header is: it takes
        its own space rather than floating over the page, so nothing has to be
        padded out from under it, and no overlay inside `body` can cover it. That
        is the whole reason it is native -- the site's own bar is inside the
        page, so every native screen hid it.
      */}
      {showNav ? <BottomNav active={activeTab} onSelect={selectTab} /> : null}

      {/* Outside `body`: a toast is the one thing allowed over everything. */}
      <MessageToast
        message={toastMessage}
        onHidden={() => setToastMessage(null)}
      />

      <CartToast
        visible={cartToast}
        onHidden={() => setCartToast(false)}
        onViewCart={() => {
          setCartToast(false);
          openCart();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: COLORS.white},
  /** Owns every overlay, so none of them can reach the header above it. */
  body: {flex: 1, position: 'relative'},
  web: {flex: 1, backgroundColor: COLORS.white},
  /** Covers the dashboard, which stays mounted and ready underneath. */
  pageLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.white,
  },
  /**
   * How a kept-alive page is hidden: parked off screen, not display:none.
   *
   * Deliberate. Taking an Android WebView through GONE and back is the classic
   * way to get one that returns blank -- the very failure this whole
   * arrangement exists to avoid, and one that would only show up on a device.
   * A translated view keeps its native visibility, so nothing is torn down;
   * Android clips children to the parent, so it is not drawn either.
   */
  parked: {transform: [{translateX: 10000}]},
});

export default ZiglyWebViewScreen;
