/**
 * "Added to cart" toast, matching the reference app.
 *
 * Shown when the page reports an add. It carries no cart state of its own --
 * View Cart just opens the site's own cart.
 */
import React, {useEffect, useRef} from 'react';
import {Animated, Easing, Pressable, StyleSheet, Text} from 'react-native';
import {FONT_FAMILY} from '../constants/appConstants';

interface Props {
  visible: boolean;
  onViewCart: () => void;
  onHidden: () => void;
}

/**
 * How long the toast holds before it leaves.
 *
 * Was 2600ms, which with the two 180ms animations kept a full-width bar over
 * the bottom of the screen for very nearly three seconds after every add. That
 * is long enough to read "Added to cart" several times over, and because the
 * bar sits at bottom: 0 it covers the bottom nav and the product page's own
 * Add to Bag / Buy Now bar while it is there -- so a customer adding a second
 * item had to wait the toast out. Shortened to the length of an acknowledgement
 * rather than a message: long enough to be seen and to reach VIEW CART, not
 * long enough to become an obstacle.
 */
const VISIBLE_MS = 1200;

/** In and out. Quick, but not a jump-cut. */
const FADE_MS = 140;

const CartToast = ({visible, onViewCart, onHidden}: Props) => {
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }
    slide.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(slide, {
        toValue: 1,
        duration: FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(VISIBLE_MS),
      Animated.timing(slide, {
        toValue: 0,
        duration: FADE_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    anim.start(({finished}) => {
      if (finished) {
        onHidden();
      }
    });
    return () => anim.stop();
  }, [visible, slide, onHidden]);

  if (!visible) {
    return null;
  }

  return (
    /*
     * box-none, not the default: the bar is opaque and spans the full width at
     * bottom: 0, so while it was on screen it swallowed every tap in that strip
     * -- the bottom nav under it, and a product page's Add to Bag / Buy Now bar.
     * Only VIEW CART inside it wants the touch; everything else in the bar is
     * text, and text has no reason to take a tap away from the control it is
     * covering.
     */
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.root,
        {
          opacity: slide,
          transform: [
            {translateY: slide.interpolate({inputRange: [0, 1], outputRange: [60, 0]})},
          ],
        },
      ]}>
      <Text style={styles.text}>Added to cart</Text>
      <Pressable onPress={onViewCart} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.action}>VIEW CART</Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#2B2B2B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  text: {fontFamily: FONT_FAMILY, color: '#FFFFFF', fontSize: 15},
  action: {
    fontFamily: FONT_FAMILY,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});

export default CartToast;
