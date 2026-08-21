/**
 * The application.
 *
 * Layout, from the outside in:
 *
 *   announcement bar   \  app chrome: drawn once, never covered
 *   native header      /  (the bar stands down only on the search screen)
 *   ------------------ <- everything below is inside `body`
 *   dashboard WebView     mounted for the life of the app
 *   page layers           inner pages: one on screen, the rest parked off it
 *   cart screen
 *
 * The header sits *outside* `body`, and every overlay is positioned inside it.
 * That is load-bearing: the layers used to be absolutely positioned against the
 * whole screen, so opening any inner page covered the header with it and left
 * the user on a page with no back arrow and no cart.
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

import {COLORS, START_URL, ZIGLY_ORIGIN} from '../constants/appConstants';
import {baseWebViewProps} from '../webview/webViewConfig';
import {classifyUrl, isCheckoutUrl} from '../utils/urlUtils';
import {getInjectionForUrl} from '../webview/injectedScripts';
import {PREFETCH_SCRIPT} from '../webview/prefetch';
import {log, warn} from '../utils/logger';
import LoadingBar from '../components/LoadingBar';
import NativeHeader from '../components/NativeHeader';
import AnnouncementBar from '../components/AnnouncementBar';
import CartToast from '../components/CartToast';
import CartScreen from '../components/CartScreen';
import type {CartData} from '../components/CartScreen';
import {READ_CART_SCRIPT, changeQtyScript} from '../webview/cartBridge';
import {
  OPEN_MENU,
  REPORT_CART_COUNT,
  EARLY_HEADER_CSS,
  REPORT_ANNOUNCEMENTS,
} from '../webview/headerBridge';
import NetworkErrorScreen from '../components/NetworkErrorScreen';
import SearchScreen from '../components/SearchScreen';
import {
  MIN_QUERY_LENGTH,
  SUGGEST_DEBOUNCE_MS,
  SUGGEST_TIMEOUT_MS,
  suggestScript,
} from '../webview/searchBridge';
import {parseSuggestions, rememberSearch} from '../search/suggestions';
import type {Suggestions} from '../search/suggestions';
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

interface Props {
  /** Fired once the first page has painted, so the splash can retire. */
  onFirstLoad: () => void;
}

/**
 * Which WebView an injection is aimed at. 'home' is the dashboard; a number is
 * a page layer's key. Resolved at the moment of injection, so a delayed pass
 * into a layer that has since been evicted is a no-op rather than a warning.
 */
type Target = 'home' | number;

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
    const view =
      target === 'home' ? webRef.current : layerRefs.current.get(target);
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

  // ------------------------------------------------------------ back button
  useEffect(() => {
    const onBack = (): boolean => {
      if (searchOpenRef.current) {
        closeSearch();
        return true;
      }
      if (showCartRef.current) {
        closeCart();
        return true;
      }
      if (stepBack()) {
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
  }, [closeCart, closeSearch, stepBack]);

  // ------------------------------------------------------------- url policy
  const handleShouldStart = useCallback(
    (request: ShouldStartLoadRequest): boolean => {
      // Sub-frames (payment iframes, embedded video) are not ours to police.
      if (request.isTopFrame === false) {
        return true;
      }

      const {url} = request;
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
    [],
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
        classifyUrl(request.url).kind === 'allow'
      ) {
        showPage(request.url);
        return false;
      }
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
  /** Progress is only ever drawn for whatever the user is actually looking at. */
  const busy =
    !showCart &&
    !showError &&
    loadingTarget !== null &&
    (showing ? loadingTarget === showing.key : loadingTarget === 'home');

  /** The page the header is describing: an inner page, or the dashboard. */
  const headerUrl = showing ? showing.url : null;
  const onShopPage = headerUrl !== null && isShopUrl(headerUrl);
  /** Keys are monotonic, so this is mount order: stable for the tree. */
  const mountOrder = [...stack.layers].sort((a, b) => a.key - b.key);

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
      <AnnouncementBar items={searchOpen ? [] : announcements} />

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
        showSearch={(headerUrl === null || onShopPage) && !showCart && !searchOpen}
        // No wishlist on the dashboard -- that matches the reference too.
        showWishlist={onShopPage && !showCart && !searchOpen}
        // The bag rides along on every page, so the cart is always one tap
        // away; only the cart and search screens drop it.
        showCartIcon={!showCart && !searchOpen}
        searchCollapsed={searchCollapsed}
        showBack={headerUrl !== null || showCart || searchOpen}
        onWishlistPress={() => showPage(`${ZIGLY_ORIGIN}/pages/swym-wishlist`)}
        onBackPress={() => {
          // Same rule as the hardware back button.
          if (searchOpen) {
            closeSearch();
          } else if (showCart) {
            closeCart();
          } else if (!stepBack() && canGoBackRef.current) {
            webRef.current?.goBack();
          }
        }}
        onMenuPress={() => injectInto('home', OPEN_MENU)}
        onCartPress={openCart}
        onLogoPress={dismissPages}
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
              if (data && data.tag === 'search-diag') {
                log('SEARCHDIAG', JSON.stringify(data));
              } else if (data && data.tag === 'cart-count') {
                setCartCount(typeof data.n === 'number' ? data.n : 0);
              } else if (data && data.tag === 'dashboard-ready') {
                onFirstLoad();
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
              } else if (data && data.tag === 'announcements') {
                setAnnouncements(Array.isArray(data.items) ? data.items : []);
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
                  applyStyles(layer.key, e.nativeEvent.url);
                }}
                onError={({nativeEvent}) => {
                  // Not promoted to the offline screen: the header's back arrow
                  // is right there, so a failed inner page is escapable.
                  warn('page load error:', nativeEvent.description);
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
            />
          </View>
        ) : null}

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

      {/* Outside `body`: a toast is the one thing allowed over everything. */}
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
