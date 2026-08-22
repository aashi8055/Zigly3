/**
 * The app's own screen, held over a page layer until that page has something to
 * show.
 *
 * Zigly's pages carry no cache-control and Cloudflare reports them DYNAMIC, so
 * opening one is always a fresh download -- /pages/dog alone is around 2 MB.
 * Without this the customer watched a website assemble itself out of a white
 * rectangle: a blank layer, then a header, then text reflowing as images landed.
 * That is the thing this app exists to not do.
 *
 * So the layer is covered while it loads and the cover fades out when the page
 * is ready. It fades rather than cutting because a cut between two white screens
 * reads as a flicker, and there is nothing to tell the customer the flicker was
 * progress.
 *
 * WHAT THIS IS NOT. It is not a skeleton of the page underneath. A skeleton
 * would have to guess at a layout that varies by destination -- a collection
 * grid, a breed page, a service page -- and guessing wrong is worse than not
 * guessing: the shapes move as the real content replaces them, which is the
 * exact judder the cover is here to remove. A calm blank ground and one spinner
 * makes no claim about what is coming.
 *
 * Whoever renders this owns the deadline. `ZiglyWebViewScreen` reveals the layer
 * on the page's own load event, or after PAGE_COVER_CAP_MS, whichever comes
 * first -- a cover with no cap is a screen the customer is stuck behind.
 */
import React, {useEffect, useRef} from 'react';
import {ActivityIndicator, Animated, Easing, StyleSheet} from 'react-native';
import {COLORS} from '../constants/appConstants';

/**
 * How long the cover may stay up.
 *
 * Long enough to swallow a warmed page's load outright -- the prefetch has
 * already pulled the images for the category destinations -- and short enough
 * that a genuinely slow page is shown half-drawn, with the header's back arrow
 * right there, rather than hidden behind a spinner.
 *
 * It used to be 2200ms, when the cover came off on the page's load event and
 * this was only the fallback for a load that never finished. It is now the
 * fallback for a page that never reports itself *ready* -- styled, laid out,
 * top imagery decoded (see ../webview/readySignal) -- which is a later moment,
 * so the cap has to be a little later too or the thing it was raised to hide
 * shows through at the end of it anyway.
 */
export const PAGE_COVER_CAP_MS = 3000;

/**
 * The spinner waits before appearing.
 *
 * A warmed page is often ready inside a couple of hundred milliseconds, and a
 * spinner that flashes on and straight off again is noise -- it makes a fast
 * navigation look like a stutter. Below this the cover is just a quiet ground.
 */
const SPINNER_DELAY_MS = 260;

const FADE_MS = 160;

const PageCover = () => {
  const opacity = useRef(new Animated.Value(1)).current;
  const spinner = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    /*
     * Not a fade-out: this component is unmounted the moment the page is ready,
     * so it never gets to animate away. The fade is on the way IN, from fully
     * opaque, which is what covers the layer immediately -- and the spinner
     * fades in behind its own delay.
     */
    const timer = setTimeout(() => {
      Animated.timing(spinner, {
        toValue: 1,
        duration: FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }, SPINNER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [spinner]);

  return (
    <Animated.View
      style={[styles.cover, {opacity}]}
      // The page underneath is mid-load; a tap that lands on a control which is
      // about to move is worse than a tap that does nothing.
      pointerEvents="auto"
      accessibilityLabel="Loading"
      accessibilityRole="progressbar">
      <Animated.View style={{opacity: spinner}}>
        <ActivityIndicator color={COLORS.navy} />
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PageCover;
