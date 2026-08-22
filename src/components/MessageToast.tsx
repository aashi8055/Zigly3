/**
 * A brief message at the foot of the screen.
 *
 * The same shape and timing as `CartToast`, without its View Cart action --
 * this one only says a thing and goes. Kept as its own component rather than
 * bolted onto that one: the cart toast is a fixed string with a button, and
 * teaching it an optional message and an optional action would make two callers
 * share a component that neither of them wanted.
 *
 * It lives outside the account section on purpose. Its first use is the notice
 * after Delete Account, and by the time that shows, the account screen has been
 * replaced by the login screen -- a notice rendered inside the section would be
 * unmounted before anyone read it.
 */
import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, Text} from 'react-native';
import {FONT_FAMILY} from '../constants/appConstants';

interface Props {
  /** The message, or null when there is nothing to say. */
  message: string | null;
  /** Called once it has faded out, so the caller can clear the message. */
  onHidden: () => void;
}

const VISIBLE_MS = 2600;

const MessageToast = ({message, onHidden}: Props) => {
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (message === null) {
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
  }, [message, slide, onHidden]);

  if (message === null) {
    return null;
  }

  return (
    <Animated.View
      // Announced, because it is the only confirmation the action gives.
      accessibilityLiveRegion="polite"
      style={[
        styles.root,
        {
          opacity: slide,
          transform: [
            {
              translateY: slide.interpolate({
                inputRange: [0, 1],
                outputRange: [60, 0],
              }),
            },
          ],
        },
      ]}>
      <Text style={styles.text}>{message}</Text>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  text: {fontFamily: FONT_FAMILY, color: '#FFFFFF', fontSize: 15},
});

export default MessageToast;
