/**
 * Navigation progress, drawn as a hairline directly under the header.
 *
 * This replaces a spinner that floated in the top-right corner of every page.
 * Two problems with that: it sat on top of whatever control the page puts in
 * that corner, and on an inner page it was the only app-drawn thing on screen,
 * so it read as the app's chrome while offering nothing to press -- there was
 * no way back. Progress belongs in a 2px line; going back belongs to the
 * header, which is now present on every page.
 */
import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import {COLORS} from '../constants/appConstants';

/** Fraction of the width the moving chip occupies. */
const CHIP = 0.35;

const LoadingBar = () => {
  const [width, setWidth] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (width <= 0) {
      return;
    }
    slide.setValue(0);
    const anim = Animated.loop(
      Animated.timing(slide, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [width, slide]);

  return (
    <View
      style={styles.root}
      pointerEvents="none"
      onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Animated.View
          style={[
            styles.chip,
            {
              width: width * CHIP,
              transform: [
                {
                  translateX: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-width * CHIP, width],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2.5,
    // Faint track, so the line reads as a bar rather than a stray artefact.
    backgroundColor: 'rgba(24,55,97,0.12)',
    overflow: 'hidden',
    // Above the WebView, below nothing else: it must not cover page content.
    zIndex: 5,
  },
  chip: {height: 2.5, borderRadius: 2, backgroundColor: COLORS.navy},
});

export default LoadingBar;
