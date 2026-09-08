/**
 * Cache first, then the network, with a bounded retry -- the load pattern every
 * native dashboard section shares.
 *
 * Three things have to happen in order for a section to appear without the page
 * visibly settling:
 *
 *   1. Show what the last launch learned, immediately. A section that has run
 *      before should paint real content on its first frame, not a placeholder.
 *   2. Ask the site anyway, every launch, and swap in the answer. What is on
 *      disk is a head start, never the truth -- the same rule
 *      ../webview/sectionIdStore states about seeded ids.
 *   3. If the ask fails, retry a few times and then stop. A dashboard section
 *      is not worth an unbounded retry loop on a phone that has no signal.
 *
 * Retry is the behaviour asked for over skip-on-failure, so the shape is
 * explicit: three attempts with a widening gap, then done. `RETRY_DELAYS` is
 * short enough that a flaky first request recovers inside the splash's own
 * grace period (SPLASH_READY_GRACE_MS, 6s) rather than after the customer is
 * already looking at a gap.
 *
 * WHAT THIS DOES NOT DO. It never clears content it has already shown. A failed
 * refresh leaves the cached section on screen, because a section that goes blank
 * on a bad connection is worse than one showing last launch's banner -- and for
 * the two sections using this, staleness is bounded to which campaign is running
 * (see ./bannerSlides on why that is safe, and why prices may never be cached
 * this way).
 */
import {useEffect, useRef, useState} from 'react';
import {log, warn} from '../utils/logger';

/**
 * Three attempts, then stop.
 *
 * The first retry is fast because the common failure is a request that raced
 * the device's network coming up on a cold start; the later ones are spaced so
 * that a genuinely offline launch is not spinning the radio. The whole sequence
 * finishes inside 4.5s, comfortably within the splash's grace window.
 */
export const RETRY_DELAYS = [600, 1800, 4000];

export type SectionState<T> = {
  /** What to draw. Cached content until the network answers, then the answer. */
  readonly data: T;
  /**
   * Draw the placeholder. True only while there is nothing at all to show --
   * a refresh behind existing content is not a loading state, because
   * replacing a drawn section with a skeleton is the flicker this app exists
   * to avoid.
   */
  readonly loading: boolean;
  /** Every attempt failed and there is nothing cached. The caller decides. */
  readonly failed: boolean;
};

/**
 * @param load    Read the last launch's copy off disk. Runs once.
 * @param fetcher Ask the site. Given an AbortSignal; must resolve empty on
 *                failure rather than throwing, or throw -- both are handled.
 * @param save    Persist what the site returned, and return what is now stored.
 * @param isEmpty Whether a result counts as nothing, so "fetched but empty"
 *                can be retried rather than mistaken for success. Sections
 *                differ here: an empty icon map is a miss, and so is an empty
 *                slide list.
 * @param empty   The value to show before anything has loaded.
 */
export const useSectionData = <T,>({
  load,
  fetcher,
  save,
  isEmpty,
  empty,
}: {
  load: () => Promise<T>;
  fetcher: (signal: AbortSignal) => Promise<T>;
  save: (value: T) => Promise<T>;
  isEmpty: (value: T) => boolean;
  empty: T;
}): SectionState<T> => {
  const [data, setData] = useState<T>(empty);
  const [settled, setSettled] = useState(false);
  const [failed, setFailed] = useState(false);

  /**
   * Whether this hook's owner is still mounted.
   *
   * Every await below is a chance for the screen to have gone away, and a
   * setState after that is a React warning at best. The abort controller covers
   * the fetch itself; this covers the disk reads and the retry timer, which
   * cannot be aborted.
   */
  const alive = useRef(true);

  /** Held so the retry timer can be cancelled on unmount. */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * The callbacks, held in a ref.
   *
   * Callers pass these as inline closures -- `fetcher: s => fetchBannerSlides(s)`
   * -- so they are a new identity on every render. In the effect's dependency
   * list that would re-run the whole load on every render, which for this hook
   * means re-fetching the section every time the parent re-renders. The effect
   * therefore depends on nothing and reads the current callbacks from here.
   */
  const fns = useRef({load, fetcher, save, isEmpty});
  fns.current = {load, fetcher, save, isEmpty};

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    let attempt = 0;

    /** Whether anything real is on screen yet, tracked outside state. */
    let shown = false;

    const attemptFetch = async (): Promise<void> => {
      if (!alive.current) {
        return;
      }
      let result: T | null = null;
      try {
        result = await fns.current.fetcher(controller.signal);
      } catch (e) {
        if (!controller.signal.aborted) {
          warn('section fetch threw:', e);
        }
        result = null;
      }
      if (!alive.current || controller.signal.aborted) {
        return;
      }

      if (result && !fns.current.isEmpty(result)) {
        // Persist before painting, so a save failure cannot leave the screen
        // showing something the next launch will not have.
        const stored = await fns.current.save(result);
        if (!alive.current) {
          return;
        }
        const next = stored && !fns.current.isEmpty(stored) ? stored : result;
        setData(next);
        setFailed(false);
        setSettled(true);
        shown = true;
        return;
      }

      attempt += 1;
      if (attempt < RETRY_DELAYS.length) {
        log('section empty, retry', attempt, 'in', RETRY_DELAYS[attempt - 1], 'ms');
        timer.current = setTimeout(attemptFetch, RETRY_DELAYS[attempt - 1]);
        return;
      }
      // Out of attempts. Anything already on screen stays there.
      warn('section gave up after', attempt, 'attempts');
      setSettled(true);
      if (!shown) {
        setFailed(true);
      }
    };

    const run = async (): Promise<void> => {
      // Disk first, and paint it before the network is asked.
      try {
        const cached = await fns.current.load();
        if (alive.current && cached && !fns.current.isEmpty(cached)) {
          setData(cached);
          shown = true;
        }
      } catch (e) {
        warn('section cache read failed:', e);
      }
      await attemptFetch();
    };

    run();

    return () => {
      alive.current = false;
      controller.abort();
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
    // Deliberately empty: the callbacks live in `fns` for the reason above, and
    // this must run exactly once per mount.
  }, []);

  return {
    data,
    // Nothing to show yet, and still trying.
    loading: isEmpty(data) && !settled,
    failed: failed && isEmpty(data),
  };
};
