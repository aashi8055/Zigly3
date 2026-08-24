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
 * WHAT CHANGED, AND WHY THE COMMENT HERE USED TO SAY THE OPPOSITE. This was a
 * bare ground and a spinner, on the reasoning that a skeleton has to guess at a
 * layout which varies by destination and that guessing wrong moves the shapes as
 * the real content replaces them. The guess is still a guess -- Zigly's product
 * grid is the theme's, not this app's -- but the *snap* is gone: the cover now
 * fades out over the arriving page instead of being unmounted the instant it is
 * ready, so a placeholder that does not line up dissolves rather than being
 * swapped out from under the eye. With the snap removed, a shape that says "a
 * grid is coming" beats a blank ground that says nothing at all.
 *
 * `variant` is deliberately narrow for the same reason the old comment was
 * written: only the two destinations this app actually sends people to have a
 * shape worth claiming, and everything else stays the old quiet ground.
 *
 * TWO WAYS IN, AND THEY ARE NOT THE SAME. A freshly mounted layer has nothing
 * behind it, so the cover must be opaque on its very first frame or the customer
 * sees the WebView's own blank through the gap. A layer that is *already showing
 * a page* -- a product opened from a collection navigates the layer it is in --
 * has something worth looking at underneath, and cutting to an opaque cover over
 * it is exactly the "blanking the whole WebView" this is supposed to prevent.
 * That case passes `crossfade`, and the cover dissolves in over the outgoing
 * page instead of replacing it.
 *
 * Whoever renders this owns the deadline. `ZiglyWebViewScreen` marks the layer
 * ready on the page's own `page-ready` signal, or after PAGE_COVER_CAP_MS,
 * whichever comes first -- a cover with no cap is a screen the customer is stuck
 * behind.
 */
import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import {COLORS} from '../constants/appConstants';
import {
  Block,
  CardSkeleton,
  HomeSkeleton,
  styles as shapes,
  usePulse,
} from './Skeleton';

/**
 * How long the cover may stay up.
 *
 * This is a FAILSAFE and nothing else: it is what uncovers a page whose script
 * never ran at all. It must therefore stay clear of the deadline the page
 * itself answers on -- 2.4s, INNER_TRIES in ../webview/readySignal -- and that
 * ordering is the fix for the complaint this number caused.
 *
 * It was 3000ms against a page deadline of 3600ms, which is the wrong way
 * round. The cap fired first, so on any page that took more than three seconds
 * to settle the cover came off before anything had said the page was ready:
 * the customer got the half-built mobile website, which is precisely what the
 * cover exists to hide. Every page now answers for itself and this only ever
 * fires when nothing answers.
 *
 * Not longer than this, though. A page that is genuinely slow is better shown
 * half-drawn, with the header's back arrow right there, than hidden behind a
 * spinner -- and the loading bar above the page is running the whole time.
 */
export const PAGE_COVER_CAP_MS = 4200;

/**
 * The spinner waits before appearing.
 *
 * A warmed page is often ready inside a couple of hundred milliseconds, and a
 * spinner that flashes on and straight off again is noise -- it makes a fast
 * navigation look like a stutter. Below this the cover is just a quiet ground.
 */
const SPINNER_DELAY_MS = 260;

/**
 * The placeholder shapes wait longer still.
 *
 * They are the larger claim of the two, so they get the longer benefit of the
 * doubt: a warmed page should be covered by a quiet ground and nothing else.
 */
const SKELETON_DELAY_MS = 320;

/** Dissolving in over a page that is still on screen. */
const FADE_IN_MS = 140;

/**
 * Dissolving out over the page that has arrived.
 *
 * Spent *after* the page is ready, so it is kept short -- this is time the
 * customer waits for nothing. Long enough only that the frame boundary is not
 * legible as a twitch.
 */
const FADE_OUT_MS = 200;

const FADE_MS = 160;

/**
 * Which shape the placeholder takes.
 *
 *   home    the dashboard -- a rail of category circles, the banner, the coupon
 *           strip, then the first product rail. The order is not a guess: it is
 *           what ../webview/homeLayout actually arranges the page into.
 *   grid    a listing -- collections and search, where the theme draws a card
 *           grid below the app's own Sort / Filter bar
 *   detail  a product -- one large gallery image, a title block, a buy control
 *   plain   everything else: a content page, checkout. The old bare ground,
 *           because these have no shape worth claiming.
 */
export type CoverVariant = 'home' | 'grid' | 'detail' | 'plain';

interface Props {
  /**
   * The page underneath has something to show.
   *
   * The cover fades out and then takes itself out of the tree. It is not
   * unmounted from outside -- that was the old arrangement, and a component
   * unmounted the instant it is no longer wanted never gets to animate away.
   */
  ready?: boolean;
  /**
   * There is already a page on screen in this layer, so dissolve in over it
   * rather than cutting to an opaque ground.
   */
  crossfade?: boolean;
  variant?: CoverVariant;
}

const PageCover = ({
  ready = false,
  crossfade = false,
  variant = 'plain',
}: Props) => {
  /**
   * Opaque from the first frame unless there is a page underneath worth
   * dissolving over. Getting this wrong in the fresh-layer direction is the
   * expensive one: it shows the WebView's own blank through the gap.
   */
  const opacity = useRef(new Animated.Value(crossfade ? 0 : 1)).current;
  /**
   * The same answer, readable from an effect that must not re-run when it
   * changes.
   *
   * `crossfade` is a fact about the moment the cover goes up, and the caller
   * learns it from a page that is still loading -- so it can flip while the cover
   * is already up, when that page commits. Depending on the prop directly meant
   * the arming effect re-ran mid-cover, and its cleanup stopped the dissolve
   * half-finished: a cover left translucent over a page that is not there yet.
   */
  const crossfadeNow = useRef(crossfade);
  crossfadeNow.current = crossfade;
  const spinner = useRef(new Animated.Value(0)).current;
  const skeleton = useRef(new Animated.Value(0)).current;
  /** Shared with the splash, so the hand-off between them is not a stutter. */
  const pulse = usePulse(variant !== 'plain' && !ready);
  /** Set once the fade-out has finished; this component then draws nothing. */
  const [gone, setGone] = useState(false);

  /**
   * Go up, or go up again.
   *
   * This runs on mount and every time the layer starts loading something new,
   * which is the case that is easy to miss: a layer is not remounted when a link
   * inside it is tapped, so a cover that had faded away and left the tree has to
   * be able to come back. Everything the fade-out changed is put back here --
   * `gone`, the opacity, and the two delayed reveals, which would otherwise
   * still be at the end of their last run and appear with no delay at all.
   */
  useEffect(() => {
    if (ready) {
      return;
    }
    setGone(false);
    spinner.setValue(0);
    skeleton.setValue(0);

    if (!crossfadeNow.current) {
      // Nothing behind it: opaque, immediately, no animation to see.
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0);
    const fade = Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_IN_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    fade.start();
    return () => fade.stop();
  }, [ready, opacity, spinner, skeleton]);

  useEffect(() => {
    if (ready) {
      return;
    }
    /*
     * The spinner and the placeholder shapes each fade in behind their own
     * delay, so a page that is ready inside a couple of hundred milliseconds is
     * covered by a quiet ground and nothing else. A shape that appears and
     * vanishes again reads as a stutter, which is the opposite of the job.
     */
    const spinnerTimer = setTimeout(() => {
      Animated.timing(spinner, {
        toValue: 1,
        duration: FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }, SPINNER_DELAY_MS);

    const skeletonTimer = setTimeout(() => {
      Animated.timing(skeleton, {
        toValue: 1,
        duration: FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }, SKELETON_DELAY_MS);

    return () => {
      clearTimeout(spinnerTimer);
      clearTimeout(skeletonTimer);
    };
  }, [ready, spinner, skeleton]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const fade = Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_OUT_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    // Only on a finished run: `finished` is false when the animation was
    // stopped, which is what the cleanup does on unmount, and setting state
    // then would be a write into a dead tree.
    fade.start(({finished}) => {
      if (finished) {
        setGone(true);
      }
    });
    return () => fade.stop();
  }, [ready, opacity]);

  if (gone) {
    return null;
  }

  return (
    <Animated.View
      style={[styles.cover, {opacity}]}
      /*
       * Taps are swallowed while the page is mid-load -- one that lands on a
       * control which is about to move is worse than one that does nothing --
       * and released the moment the page is ready, rather than at the end of the
       * fade. Holding them for the fade would make a page that is visibly
       * finished feel dead for a fifth of a second.
       */
      pointerEvents={ready ? 'none' : 'auto'}
      accessibilityLabel="Loading"
      accessibilityRole="progressbar">
      {variant === 'plain' ? (
        <Animated.View style={[styles.centre, {opacity: spinner}]}>
          <ActivityIndicator color={COLORS.navy} />
        </Animated.View>
      ) : (
        <Animated.View style={[styles.sheet, {opacity: skeleton}]}>
          {variant === 'home' ? (
            <HomeSkeleton pulse={pulse} />
          ) : variant === 'grid' ? (
            <>
              {/*
                Cards only. There used to be a bar block above them, standing in
                for the Sort / Filter row this app drew inside the page. That row
                is native now and outside the cover, so it is already on screen,
                in place, while this is up -- a grey rectangle standing in for
                something the customer can see would be the one shape in here
                guaranteed not to line up.
              */}
              <View style={shapes.grid}>
                <CardSkeleton pulse={pulse} />
                <CardSkeleton pulse={pulse} />
                <CardSkeleton pulse={pulse} />
                <CardSkeleton pulse={pulse} />
              </View>
            </>
          ) : (
            <>
              <Block pulse={pulse} style={shapes.hero} />
              <Block pulse={pulse} style={shapes.lineNarrow} />
              <Block pulse={pulse} style={shapes.lineWide} />
              <Block pulse={pulse} style={shapes.lineWide} />
              <Block pulse={pulse} style={shapes.button} />
            </>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
};

/*
 * The shapes themselves live in ./Skeleton, shared with the splash. What is left
 * here is the cover: the ground it paints, and the spacing between the shapes on
 * this particular screen.
 */
const styles = StyleSheet.create({
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.ground,
  },
  /** The plain variant: one spinner in the middle of a quiet ground. */
  centre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** The placeholder sheet starts at the top, where the real page does. */
  sheet: {flex: 1, paddingHorizontal: 12, paddingTop: 12},
});

export default PageCover;
