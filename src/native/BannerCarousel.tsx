/**
 * The banner carousel, drawn natively.
 *
 * The second section to leave the WebView, and the one where native buys the
 * most behaviour for the least code. ../webview/bannerCarousel is 393 lines,
 * almost all of it repairing a Swiper configuration this app does not own:
 * `loop` nested inside `autoplay` where Swiper never reads it (so the last
 * slide was a dead end -- the "banner stuck" report), autoplay with no path
 * back to running after Android throttled its timers, and a watchdog to nudge a
 * carousel that had stalled for reasons a config read cannot see.
 *
 * None of those three exist here. Looping is an index modulo a length,
 * autoplay is an interval this component owns and can restart, and there is
 * nothing to watchdog because there is no third-party instance to lose control
 * of. That is the argument for this section being native, stated concretely.
 *
 * FOUR THINGS ARE KEPT FROM THE SITE'S OWN LOOK, deliberately, because they are
 * the banner's identity rather than the theme's implementation:
 *
 *   - Edge to edge. The site insets the strip by 20px and rounds it to 10/20px,
 *     which ../webview/injectedStyles already strips off because on a phone it
 *     reads as a bordered card floating in a gutter. Full-bleed here from the
 *     start, no radius, nothing drawn around it.
 *   - 5000ms between slides. The theme's own `autoplay.delay`.
 *   - Dots below the image, not over it -- the same correction the injected
 *     stylesheet makes by giving `.swiper-pagination` static positioning.
 *   - 2:1. The mobile crops are cut to 600x400, but the section is displayed at
 *     roughly 2:1 and, decisively, ../components/Skeleton reserves
 *     `aspectRatio: 2` for it. A different ratio here would make the dashboard
 *     jump at the moment the placeholder came off.
 *
 * WHY A ScrollView AND NOT A FlatList. Ten full-width images at most, and every
 * one of them wants to be decoded before the customer swipes to it rather than
 * at the moment they do. A FlatList's virtualisation is the wrong trade at this
 * count: it would save a little memory and cost a blank frame on each swipe,
 * which is the one thing a banner must not do.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
} from 'react-native';
import {COLORS} from '../constants/appConstants';
import {Block, usePulse} from '../components/Skeleton';
import {
  fetchBannerSlides,
  loadBannerSlides,
  saveBannerSlides,
  type BannerSlide,
} from './bannerSlides';
import {useSectionData} from './useSectionData';

/** The theme's own autoplay delay. */
const DELAY_MS = 5000;

/**
 * How long a touch suspends autoplay.
 *
 * A carousel that advances out from under a thumb is the complaint every
 * auto-rotating banner earns. Autoplay stops on touch and resumes only after
 * the customer has been still for this long -- long enough that reading a
 * banner and deciding is never interrupted.
 */
const RESUME_MS = 8000;

/** Matching `../components/Skeleton`'s reserved shape, for the reason above. */
const RATIO = 2;

type Props = {
  /** Where a tap goes; a storefront path or absolute zigly.com URL. */
  onOpen: (link: string) => void;
};

const EMPTY_SLIDES: BannerSlide[] = [];

const BannerCarousel = ({onOpen}: Props) => {
  const {width} = useWindowDimensions();
  const height = Math.round(width / RATIO);

  const {data: slides, loading} = useSectionData<BannerSlide[]>({
    load: loadBannerSlides,
    fetcher: signal => fetchBannerSlides(signal),
    save: learned => saveBannerSlides(learned),
    isEmpty: list => !list || list.length === 0,
    empty: EMPTY_SLIDES,
  });

  const scroller = useRef<ScrollViewInstance>(null);
  const [index, setIndex] = useState(0);

  /**
   * The live index, held outside state as well.
   *
   * The autoplay interval is installed once per slide-count change; if it read
   * `index` from state it would close over the value at install time and
   * advance from 0 forever. A ref is read at fire time.
   */
  const cursor = useRef(0);

  /** When the customer last touched it. `0` means never. */
  const touchedAt = useRef(0);

  const pulse = usePulse(loading);

  /** Move to a slide, wrapping. The whole of "looping", for comparison. */
  const goTo = useCallback(
    (next: number, animated = true) => {
      const count = slides.length;
      if (count < 1) {
        return;
      }
      const wrapped = ((next % count) + count) % count;
      cursor.current = wrapped;
      setIndex(wrapped);
      scroller.current?.scrollTo({x: wrapped * width, y: 0, animated});
    },
    [slides.length, width],
  );

  /**
   * Autoplay.
   *
   * One interval, owned here, restarted whenever the slide count or the width
   * changes. It skips a tick while the customer is interacting, rather than
   * being torn down and rebuilt on every touch -- so there is no state in which
   * the timer has been stopped and nothing starts it again, which is defect (2)
   * in the web version.
   *
   * A single slide gets no timer at all: nothing to advance to.
   */
  useEffect(() => {
    if (slides.length < 2) {
      return;
    }
    const id = setInterval(() => {
      if (touchedAt.current && Date.now() - touchedAt.current < RESUME_MS) {
        return;
      }
      goTo(cursor.current + 1);
    }, DELAY_MS);
    return () => clearInterval(id);
  }, [slides.length, goTo]);

  /**
   * Keep the offset honest when the width changes.
   *
   * A rotation or a fold changes the page width, and the ScrollView keeps its
   * pixel offset -- which is now the wrong slide, or between two of them.
   * Re-seated without animation so it reads as a layout, not a slide.
   */
  useEffect(() => {
    if (slides.length) {
      scroller.current?.scrollTo({x: cursor.current * width, y: 0, animated: false});
    }
  }, [width, slides.length]);

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const at = Math.round(e.nativeEvent.contentOffset.x / width);
      cursor.current = at;
      setIndex(at);
    },
    [width],
  );

  const onTouchStart = useCallback(() => {
    touchedAt.current = Date.now();
  }, []);

  /**
   * Nothing learned yet, and nothing cached: hold the shape.
   *
   * The same 2:1 block `HomeSkeleton` draws, pulsing on the shared rhythm, so a
   * dashboard whose banner has not arrived looks like one still loading rather
   * than one missing a section. On every launch after the first there is a
   * cached slide list and this is never seen.
   */
  if (loading) {
    return (
      <View style={[styles.root, {height}]}>
        <Block pulse={pulse} style={styles.placeholder} />
      </View>
    );
  }

  // Out of retries with nothing cached. The dashboard is one block shorter --
  // an empty 2:1 grey rectangle that will never fill is worse than no section,
  // and every other section keeps its position because this one occupied none.
  if (!slides.length) {
    return null;
  }

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        onTouchStart={onTouchStart}
        // Android needs the drag end too: a slow drag that never gains momentum
        // fires no momentum event, and the index would stay on the old slide
        // while the image showed the new one.
        onScrollEndDrag={onMomentumEnd}
        scrollEventThrottle={16}
        directionalLockEnabled
      >
        {slides.map((slide, i) => (
          <Pressable
            key={`${slide.image}:${i}`}
            onPress={() => (slide.link ? onOpen(slide.link) : undefined)}
            // A slide with no link is not a control; it must not announce
            // itself as one or take a press state.
            accessibilityRole={slide.link ? 'link' : 'image'}
            accessibilityLabel={`Offer ${i + 1} of ${slides.length}`}
            disabled={!slide.link}
            style={{width, height}}
          >
            <Image
              source={{uri: slide.image}}
              style={{width, height}}
              // `cover`: the crop is 600x400 (3:2) shown in a 2:1 box, so a
              // little is trimmed top and bottom. `contain` would letterbox the
              // banner against the page and read as a picture of a banner.
              resizeMode="cover"
              accessible={false}
            />
          </Pressable>
        ))}
      </ScrollView>

      {/* The dots, below the image rather than over its last few pixels --
          the same placement the injected stylesheet corrects the site to. A
          single slide gets none: a one-dot pager states nothing. */}
      {slides.length > 1 ? (
        <View style={styles.dots}>
          {slides.map((slide, i) => (
            <View
              key={`dot:${slide.image}:${i}`}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    // Edge to edge: no horizontal padding anywhere in this section, and none
    // may be added by a parent. See the note at the top on why.
    marginBottom: 16,
  },
  placeholder: {
    width: '100%',
    // The skeleton's own banner radius, so the placeholder here and the one
    // `PageCover` draws are the same shape.
    aspectRatio: RATIO,
    borderRadius: 14,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // 8px above the image, matching the `margin: 8px 0 0` the injected
    // stylesheet gives the site's pagination.
    marginTop: 8,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.hairline,
  },
  /**
   * The current slide's dot: the brand navy, and wider rather than merely
   * darker. Two states that differ only in tint are hard to tell apart at 6dp
   * on a bright screen.
   */
  dotActive: {
    width: 16,
    backgroundColor: COLORS.navy,
  },
});

export default BannerCarousel;
