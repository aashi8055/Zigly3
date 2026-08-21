/**
 * "Added to cart" toast, matching the reference app.
 *
 * Shown when the page reports an add. It carries no cart state of its own --
 * View Cart just opens the site's own cart.
 */
import React, {useEffect, useRef} from 'react';
import {Animated, Easing, Pressable, StyleSheet, Text} from 'react-native';

interface Props {
  visible: boolean;
  onViewCart: () => void;
  onHidden: () => void;
}

const VISIBLE_MS = 2600;

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
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(VISIBLE_MS),
      Animated.timing(slide, {
        toValue: 0,
        duration: 180,
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
    <Animated.View
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
  text: {color: '#FFFFFF', fontSize: 15},
  action: {color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.4},
});

export default CartToast;
