/**
 * Native announcement bar.
 *
 * zigly.com marks its own bar with data-hide-in-app="true" and hides it inside
 * a WebView, the same way it hides the header -- their app is expected to
 * supply both. The offer text here is read from that hidden element at runtime,
 * so the content is the site's, not ours: no offers are hardcoded, and when
 * Zigly changes a promotion the bar follows automatically.
 */
import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing, StyleSheet, Text, View} from 'react-native';
import {COLORS} from '../constants/appConstants';

interface Props {
  /** Offer strings read from the site's own announcement bar. */
  items: string[];
}

const SEPARATOR = '     \u2022     ';
/** Pixels per second. Slow enough to read, close to the reference app. */
const SPEED = 45;

const AnnouncementBar = ({items}: Props) => {
  const [textWidth, setTextWidth] = useState(0);
  const shift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (textWidth <= 0) {
      return;
    }
    shift.setValue(0);
    const anim = Animated.loop(
      Animated.timing(shift, {
        toValue: -textWidth,
        duration: (textWidth / SPEED) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [textWidth, shift]);

  if (items.length === 0) {
    return null;
  }

  const line = items.join(SEPARATOR) + SEPARATOR;

  return (
    <View style={styles.root} accessibilityRole="text">
      <Animated.View
        style={[styles.track, {transform: [{translateX: shift}]}]}
        pointerEvents="none">
        {/* Two copies so the loop has no visible gap. */}
        <Text
          style={styles.text}
          numberOfLines={1}
          onLayout={e => setTextWidth(e.nativeEvent.layout.width)}>
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
    height: 38,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  track: {flexDirection: 'row'},
  text: {
    color: COLORS.white,
    fontSize: 13.5,
    fontWeight: '500',
    lineHeight: 38,
  },
});

export default AnnouncementBar;
