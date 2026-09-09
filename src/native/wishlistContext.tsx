/**
 * Which products are on the wishlist, and how a card toggles one.
 *
 * A CONTEXT RATHER THAN FOUR MORE PROPS, and that is the whole reason this file
 * exists. The heart belongs to ./ProductCard, but the card is drawn by
 * ./ProductRail, which is drawn by ./HotPicks and ./Bestsellers, which are drawn
 * by ./NativeDashboard, which is drawn by ../screens/ZiglyWebViewScreen -- and
 * the state lives at the top of that chain because it is read out of the WebView
 * (../webview/wishlistBridge). Threading a set and a callback down five levels
 * would put two props on three components that do not otherwise care about the
 * wishlist, and every future product surface would have to remember to pass them
 * or silently lose its hearts.
 *
 * The set is also genuinely app-wide state rather than one rail's: a product can
 * appear in Hot Picks and in Bestsellers at once, and saving it in one place has
 * to fill the heart in the other. A context is what makes that automatic instead
 * of a synchronisation problem.
 *
 * THE DEFAULT IS DELIBERATELY INERT. With no provider the set is empty and there
 * is no toggle, and ./ProductCard draws no heart at all when the toggle is
 * absent. So a rail rendered in a test, or on a surface that has not opted in,
 * gets the card exactly as it was before this existed rather than a heart that
 * does nothing.
 */
import React, {createContext, useContext, useMemo} from 'react';

export type WishlistState = {
  /**
   * The saved product handles.
   *
   * A `Set` rather than an array: a rail of twenty-two cards asks this once per
   * card per render, and a linear scan of up to forty handles each time is work
   * for nothing.
   */
  readonly handles: ReadonlySet<string>;
  /**
   * Toggle one handle, or undefined when toggling is not available here.
   *
   * Undefined is the signal that hides the heart -- see the note above. It is
   * undefined until the screen has a WebView to run the toggle in.
   */
  readonly toggle?: (handle: string) => void;
};

const EMPTY: ReadonlySet<string> = new Set<string>();

const WishlistContext = createContext<WishlistState>({handles: EMPTY});

/**
 * Provide the wishlist to every product card below.
 *
 * `handles` and `toggle` are given separately rather than as an object so a
 * caller does not have to memoise one, and the value is memoised here instead --
 * a fresh object each render would re-render every card on the dashboard on
 * every parent render.
 */
export const WishlistProvider = ({
  handles,
  toggle,
  children,
}: {
  handles: ReadonlySet<string>;
  toggle?: (handle: string) => void;
  children: React.ReactNode;
}) => {
  const value = useMemo<WishlistState>(
    () => ({handles, toggle}),
    [handles, toggle],
  );
  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
};

/** Read the wishlist. Safe with no provider: an empty set and no toggle. */
export const useWishlist = (): WishlistState => useContext(WishlistContext);

export default WishlistContext;
