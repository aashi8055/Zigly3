/**
 * Native announcement bar.
 *
 * zigly.com marks its own bar with data-hide-in-app="true" and hides it inside
 * a WebView, the same way it hides the header -- their app is expected to
 * supply both. The offer text here is read from that hidden element at runtime,
 * so the content is the site's, not ours: no offers are hardcoded, and when
 * Zigly changes a promotion the bar follows automatically.
 *
 * THE SCROLL NEVER STOPS. That is the contract of this file, and it used to be
 * broken in three separate ways -- all of which the customer reads as the same
 * bug, a strip that freezes or jumps back to the first offer:
 *
 *   1. Backgrounding the app. `Animated.loop` on the native driver is halted
 *      when the app leaves the foreground, and nothing restarted it: the effect
 *      that owns the loop only re-ran when the measured width changed, and the
 *      width does not change while the app is away. Coming back, the strip was
 *      simply still -- the most visible form of the bug, because every customer
 *      backgrounds the app. Fixed by the AppState effect below.
 *   2. Re-measuring. `onLayout` fires again on rotation, on a font-scale
 *      change, and whenever the offer strings change -- and the old effect
 *      answered every one of those with `shift.setValue(0)`, snapping the strip
 *      back to the start of the line mid-travel. It now resumes from wherever
 *      it had got to.
 *   3. Unmount. The screens that pass `items={[]}` -- search, wishlist, the
 *      account sub-screens -- made this component return `null`, destroying the
 *      animated value with it, so returning to a screen that shows the bar
 *      started the line over from its first character. The component now stays
 *      mounted and keeps running, merely unmeasured and hidden, so the strip a
 *      customer comes back to is the one that was there when they left. What
 *      those screens hide is the bar, not the marquee.
 *
 * The visibility rules themselves are unchanged and stay at the call site in
 * ../screens/ZiglyWebViewScreen: this file has no opinion on which screens show
 * the bar, only that the travel is continuous across all of them.
 */
import React, {useEffect, useRef, useState} from 'react';
import {Animated, AppState, Easing, StyleSheet, Text, View} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';

interface Props {
  /** Offer strings read from the site's own announcement bar. */
  items: string[];
}

const SEPARATOR = '     •     ';
/** Pixels per second. Slow enough to read, close to the reference app. */
const SPEED = 45;
/** The strip's height when it is showing. Hidden, it occupies nothing. */
const BAR_H = 38;

const AnnouncementBar = ({items}: Props) => {
  const [textWidth, setTextWidth] = useState(0);
  /**
   * Bumped to ask the loop effect to run again -- see the AppState effect.
   * State rather than a ref, because a ref read would not re-run the effect.
   */
  const [restarts, setRestarts] = useState(0);
  const shift = useRef(new Animated.Value(0)).current;

  /**
   * Where the travel had reached, tracked out of band.
   *
   * `Animated.Value` has no supported synchronous getter, and under the native
   * driver the JS-side value is not kept in step as the animation runs, so a
   * listener is the only honest way to know where the strip actually is. It is
   * what lets a restart resume rather than snap.
   */
  const at = useRef(0);
  useEffect(() => {
    const id = shift.addListener(({value}) => {
      at.current = value;
    });
    return () => shift.removeListener(id);
  }, [shift]);

  const showing = items.length > 0;

  /**
   * The line the strip is travelling -- which is the last non-empty one, not
   * the current props.
   *
   * The screens that hide the bar do it by passing `items={[]}`, and blanking
   * the text on those screens would measure the line at zero width, which stops
   * the loop and resets the position: failure 3 from the file header, arrived
   * at by a different route. So the offers are kept while hidden, still moving,
   * off-screen. They are only replaced when the site reports a real set --
   * an empty report never overwrites what is already there.
   */
  const held = useRef('');
  if (showing) {
    held.current = items.join(SEPARATOR) + SEPARATOR;
  }
  const line = held.current;

  /**
   * Start, or restart, the loop -- from wherever the strip currently is.
   *
   * The resume is a one-shot covering only the distance left in the current
   * pass, at the same pixels-per-second as an uninterrupted run; handing the
   * full-width duration to a partial journey is what would make the strip
   * visibly crawl every time the app came back. The loop proper takes over
   * once that remainder is spent.
   */
  useEffect(() => {
    if (textWidth <= 0) {
      return;
    }
    const full = Animated.loop(
      Animated.timing(shift, {
        toValue: -textWidth,
        duration: (textWidth / SPEED) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    // A shorter line can leave the strip past the end of the new one. Wrap it
    // back into range rather than animating a journey that is already over.
    let from = at.current;
    if (from > 0 || from <= -textWidth) {
      from = 0;
      shift.setValue(0);
    }

    const remaining = textWidth + from; // `from` is <= 0 here.
    let stopped = false;
    let resume: Animated.CompositeAnimation | null = null;

    if (remaining > 0 && remaining < textWidth) {
      resume = Animated.timing(shift, {
        toValue: -textWidth,
        duration: (remaining / SPEED) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      });
      resume.start(({finished}) => {
        if (finished && !stopped) {
          shift.setValue(0);
          full.start();
        }
      });
    } else {
      full.start();
    }

    return () => {
      stopped = true;
      resume?.stop();
      full.stop();
    };
  }, [textWidth, shift, restarts]);

  /**
   * Bring the loop back when the app returns to the foreground.
   *
   * The OS halts native-driver animations on the way out and does not resume
   * them on the way back in, so without this the strip is frozen for the whole
   * of the rest of the session -- and 'inactive' counts as leaving: on iOS the
   * app passes through it for the control centre and the app switcher, and
   * comes back to 'active' without ever having reached 'background'.
   */
  useEffect(() => {
    let away = false;
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'background' || next === 'inactive') {
        away = true;
        return;
      }
      if (next === 'active' && away) {
        away = false;
        setRestarts(n => n + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <View
      style={showing ? styles.root : styles.hidden}
      /*
       * Hidden means hidden to the screen reader too. The strip is still
       * mounted and still travelling, but on these screens it is not part of
       * the page, and announcing offers over a search field the customer is
       * typing into is exactly the noise the call site excludes it to avoid.
       */
      accessibilityElementsHidden={!showing}
      importantForAccessibility={showing ? 'auto' : 'no-hide-descendants'}
      accessibilityRole="text">
      <Animated.View
        style={[styles.track, {transform: [{translateX: shift}]}]}
        pointerEvents="none">
        {/* Two copies so the loop has no visible gap. */}
        <Text
          style={styles.text}
          numberOfLines={1}
          onLayout={e => {
            const w = e.nativeEvent.layout.width;
            // Only a real change. An identical re-measure would re-run the loop
            // effect, and a restart mid-travel is the jump this file exists to
            // prevent. Rounded, because layout arrives in sub-pixels.
            setTextWidth(prev =>
              Math.round(prev) === Math.round(w) ? prev : w,
            );
          }}>
          {line}
        </Text>
        <Text style={styles.text} numberOfLines={1}>
          {line}
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    backgroundColor: COLORS.navyDeep,
    height: BAR_H,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  /**
   * Mounted, measured and running -- but occupying no space and painting
   * nothing. `height: 0` with `overflow: 'hidden'` is what keeps the animation
   * alive on the screens that do not show the bar; unmounting it is what used
   * to reset the scroll. Opacity is belt and braces for a platform that would
   * otherwise let a sub-pixel row of text show through.
   */
  hidden: {height: 0, overflow: 'hidden', opacity: 0},
  track: {flexDirection: 'row'},
  text: {
    fontFamily: FONT_FAMILY,
    color: COLORS.white,
    fontSize: 13.5,
    fontWeight: '500',
    lineHeight: BAR_H,
  },
});

export default AnnouncementBar;
