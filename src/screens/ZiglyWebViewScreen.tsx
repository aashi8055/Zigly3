/**
 * The application.
 *
 * Two WebViews: the dashboard, which is never navigated away from, and an
 * inner-page view layered over it. Plus a native cart screen, because the
 * reference app's cart is native -- though its figures and every change still
 * come from Shopify, executed inside the WebView.
 *
 * Remounting would drop the Shopify session cookie and the user's scroll
 * position, so navigation is always performed by driving this instance rather
 * than by swapping screens.
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
import LoadingOverlay from '../components/LoadingOverlay';
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

interface Props {
  /** Fired once the first page has painted, so the splash can retire. */
  onFirstLoad: () => void;
}

/**
 * Whether a page is a shopping page.
 *
 * The reference app's collection, product and search screens carry the wishlist
 * heart, the cart and the search band; its breed and content pages show only a
 * back arrow and the logo.
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


const ZiglyWebViewScreen = ({onFirstLoad}: Props) => {
  /**
   * Two WebViews on purpose.
   *
   * The dashboard is expensive to assemble -- several section requests plus
   * transplants -- and Zigly's pages carry no cache-control, so navigating back
   * to '/' rebuilt it from scratch every time. Keeping it mounted and showing
   * inner pages in a second view makes Back instant, matching the reference app.
   *
   * The cost is a second WebView in memory, which is a real trade against
   * keeping one. Both share the app's cookie jar, so there is still a single
   * session and a single cart.
   */
  const webRef = useRef<Web>(null);
  const pageRef = useRef<Web>(null);

  /** Read inside native callbacks, so it must be a ref, not state. */
  const canGoBackRef = useRef(false);
  const inCheckoutRef = useRef(false);
  const firstLoadDone = useRef(false);

  const [loading, setLoading] = useState(false);
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
  /** Inner-page view: null while the dashboard is showing. */
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const pageCanGoBackRef = useRef(false);
  /** Mirrors pageUrl for the native back handler, which reads a ref. */
  const pageUrlRef = useRef<string | null>(null);
  /** Mirrors showCart for the native back handler, which reads a ref. */
  const showCartRef = useRef(false);
  /**
   * Whether the connection is unmetered. Prefetching trades data for speed,
   * which should not happen silently on mobile data.
   */
  const unmeteredRef = useRef(false);
  const [offline, setOffline] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
    pageUrlRef.current = pageUrl;
  }, [pageUrl]);

  useEffect(() => {
    showCartRef.current = showCart;
  }, [showCart]);

  /**
   * Return to the dashboard. It is still mounted, so this is instant; the
   * reference app also returns to the top rather than restoring scroll.
   */
  const dismissPage = useCallback(() => {
    setPageUrl(null);
    pageCanGoBackRef.current = false;
    webRef.current?.injectJavaScript(
      'window.scrollTo(0, 0); true;',
    );
    // The cart may have changed while away; re-read the site's own counter.
    webRef.current?.injectJavaScript(REPORT_CART_COUNT);
  }, []);

  // ------------------------------------------------------------ back button
  useEffect(() => {
    const onBack = (): boolean => {
      // Inner page first: stepping back through its history, then dismissing it
      // reveals the dashboard immediately because it was never torn down.
      if (showCartRef.current) {
        setShowCart(false);
        // The badge may have changed while the cart was open.
        webRef.current?.injectJavaScript(REPORT_CART_COUNT);
        return true;
      }
      if (pageUrlRef.current !== null) {
        if (pageCanGoBackRef.current) {
          pageRef.current?.goBack();
        } else {
          dismissPage();
        }
        return true;
      }
      if (canGoBackRef.current) {
        webRef.current?.goBack();
        // Consumed: keep the app open while the WebView still has history.
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
  }, [dismissPage]);

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
   * The dashboard's handler. Anything that is not the dashboard is handed to
   * the page view, so the dashboard is never navigated away from and stays
   * instant to return to.
   *
   * Only the dashboard diverts: the page view uses the shared policy directly,
   * so its own taps navigate in place and it keeps a real back history.
   */
  const handleHomeShouldStart = useCallback(
    (request: ShouldStartLoadRequest): boolean => {
      if (
        request.isTopFrame !== false &&
        !isHomeUrl(request.url) &&
        classifyUrl(request.url).kind === 'allow'
      ) {
        setPageUrl(request.url);
        return false;
      }
      return handleShouldStart(request);
    },
    [handleShouldStart],
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

  /**
   * Apply the mobile stylesheet. Runs on every completed navigation because a
   * full page load discards the previously injected <style> node.
   */
  const applyStyles = useCallback((url: string) => {
    const script = getInjectionForUrl(url);
    if (!script) {
      log('injection skipped for', url);
      return;
    }
    // Re-apply on a short schedule. The page keeps loading images and
    // third-party scripts well after onLoadEnd, and those late arrivals can
    // restyle the header after a single pass. The script is idempotent, so
    // repeating it is safe and cheap.
    webRef.current?.injectJavaScript(REPORT_CART_COUNT);
    webRef.current?.injectJavaScript(REPORT_ANNOUNCEMENTS);

    const delays = [0, 500, 1500, 3000, 6000, 10000];
    delays.forEach(ms => {
      setTimeout(() => {
        try {
          webRef.current?.injectJavaScript(script);
        } catch (e) {
          warn('inject failed', e);
        }
      }, ms);
    });
  }, []);

  const handleLoadEnd = useCallback(
    (event: {nativeEvent: {url: string}}) => {
      setLoading(false);
      applyStyles(event.nativeEvent.url);
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
    webRef.current?.reload();
  }, []);

  // ------------------------------------------------------------------ render
  const showError = offline || loadError !== null;

  return (
    <View style={styles.root}>
      <AnnouncementBar items={announcements} />

      <NativeHeader
        cartCount={cartCount}
        // Dashboard and shopping pages carry the search band; breed and content
        // pages show only the back arrow and the logo.
        showSearch={(pageUrl === null || isShopUrl(pageUrl)) && !showCart}
        // No wishlist on the dashboard -- that matches the reference too.
        showWishlist={pageUrl !== null && isShopUrl(pageUrl) && !showCart}
        showCartIcon={(pageUrl === null || isShopUrl(pageUrl)) && !showCart}
        searchCollapsed={searchCollapsed}
        showBack={pageUrl !== null || showCart}
        onWishlistPress={() => setPageUrl(`${ZIGLY_ORIGIN}/pages/swym-wishlist`)}
        onBackPress={() => {
          // Same rule as the hardware back button.
          if (showCart) {
            setShowCart(false);
            webRef.current?.injectJavaScript(REPORT_CART_COUNT);
          } else if (pageUrl !== null) {
            if (pageCanGoBackRef.current) {
              pageRef.current?.goBack();
            } else {
              dismissPage();
            }
          } else if (canGoBackRef.current) {
            webRef.current?.goBack();
          }
        }}
        onMenuPress={() => webRef.current?.injectJavaScript(OPEN_MENU)}
        onCartPress={() => {
          setCart(null);
          setShowCart(true);
          webRef.current?.injectJavaScript(READ_CART_SCRIPT);
        }}
        onLogoPress={() => dismissPage()}
        onSearchSubmit={q =>
          setPageUrl(`${ZIGLY_ORIGIN}/search?q=${encodeURIComponent(q)}`)
        }
      />

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
          setLoading(true);
          // Hide the site's header as early as Android will let us.
          //
          // injectedJavaScriptBeforeContentLoaded is unreliable on Android
          // WebView -- it frequently lands after first paint, which is why the
          // site's own header still flashed alongside our native one. onLoadStart
          // fires at the very beginning of the navigation, so injecting here as
          // well gives the rule a second, earlier chance to land. It is
          // idempotent, so running twice costs nothing.
          webRef.current?.injectJavaScript(EARLY_HEADER_CSS);
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
          // Only diagnostics post messages today; ignore anything else.
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
                webRef.current?.injectJavaScript(PREFETCH_SCRIPT);
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

      {pageUrl !== null ? (
        <View style={styles.pageLayer}>
          <WebView<object>
            {...baseWebViewProps}
            ref={pageRef}
            source={{uri: pageUrl}}
            style={styles.web}
            injectedJavaScript={getInjectionForUrl(pageUrl) ?? undefined}
            injectedJavaScriptBeforeContentLoaded={EARLY_HEADER_CSS}
            onShouldStartLoadWithRequest={handleShouldStart}
            onNavigationStateChange={nav => {
              pageCanGoBackRef.current = nav.canGoBack;
              const nowInCheckout = isCheckoutUrl(nav.url);
              if (nowInCheckout !== inCheckoutRef.current) {
                inCheckoutRef.current = nowInCheckout;
              }
            }}
            onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
              handleScroll(e.nativeEvent.contentOffset.y)
            }
            onLoadStart={() => {
              setLoading(true);
              pageRef.current?.injectJavaScript(EARLY_HEADER_CSS);
            }}
            onLoadEnd={e => {
              setLoading(false);
              applyStyles(e.nativeEvent.url);
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
          />
        </View>
      ) : null}

      {showCart ? (
        <View style={styles.pageLayer}>
          <CartScreen
            cart={cart}
            onChangeQty={(key, quantity) =>
              webRef.current?.injectJavaScript(changeQtyScript(key, quantity))
            }
            onCheckout={() => {
              // Checkout stays entirely on the website.
              setShowCart(false);
              setPageUrl(`${ZIGLY_ORIGIN}/checkout`);
            }}
            onOpenItem={url => {
              setShowCart(false);
              setPageUrl(url.indexOf('http') === 0 ? url : `${ZIGLY_ORIGIN}${url}`);
            }}
          />
        </View>
      ) : null}

      <CartToast
        visible={cartToast}
        onHidden={() => setCartToast(false)}
        onViewCart={() => {
          setCartToast(false);
          setCart(null);
          setShowCart(true);
          webRef.current?.injectJavaScript(READ_CART_SCRIPT);
        }}
      />

      {loading && !showError ? <LoadingOverlay /> : null}

      {showError ? (
        <NetworkErrorScreen
          onRetry={retry}
          detail={offline ? null : loadError}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: COLORS.white},
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
});

export default ZiglyWebViewScreen;
