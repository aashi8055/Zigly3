/**
 * Cache first, then the network, then a bounded retry.
 *
 * `useSectionData` is the load behaviour every native dashboard section will
 * share, so it is worth more than an eyeball: the interesting states are the
 * ones a device produces and a developer never sees -- a launch with the cache
 * warm and the network down, a fetch that resolves after the screen has gone
 * away, a section that fails twice and succeeds on the third try.
 *
 * Retry-then-give-up is the chosen failure mode ("skeleton then retry"), and
 * the two halves of it that matter are asserted here: that it retries at all,
 * and that it STOPS. An unbounded retry on a phone with no signal is a radio
 * that never sleeps.
 *
 * The hook is exercised through a host component rather than a hook-testing
 * library, because this suite has none -- ../__tests__/pageCover.test.tsx uses
 * `react-test-renderer` and `act` directly, and so does this.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text} from 'react-native';
import {RETRY_DELAYS, useSectionData} from '../src/native/useSectionData';

type Result = {data: string[]; loading: boolean; failed: boolean};

/**
 * The last state the hook reported.
 *
 * Captured out of a rendered component rather than returned, so the hook runs
 * under a real React lifecycle -- effects, cleanup and all -- which is the
 * whole point: the mount/unmount behaviour is what is being tested.
 */
let seen: Result;

const Host = ({
  load,
  fetcher,
  save,
}: {
  load: () => Promise<string[]>;
  fetcher: (signal: AbortSignal) => Promise<string[]>;
  save: (v: string[]) => Promise<string[]>;
}) => {
  const state = useSectionData<string[]>({
    load,
    fetcher,
    save,
    isEmpty: v => !v || v.length === 0,
    empty: EMPTY,
  });
  seen = {data: state.data, loading: state.loading, failed: state.failed};
  return <Text>{state.data.join(',')}</Text>;
};

const EMPTY: string[] = [];

/** Defaults: nothing cached, and a save that stores whatever it is given. */
const noCache = () => Promise.resolve<string[]>([]);
const echo = (v: string[]) => Promise.resolve(v);

/**
 * Let every pending promise settle.
 *
 * The hook awaits a disk read and then a fetch, so a single flush is not
 * enough to reach the state after both. Timers are faked in this suite, so a
 * real `setTimeout(0)` is unavailable -- the microtask queue is drained
 * instead, several times, which is what the awaits actually need.
 */
const settle = async (times = 6): Promise<void> => {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
};

const render = async (props: {
  load?: () => Promise<string[]>;
  fetcher: (signal: AbortSignal) => Promise<string[]>;
  save?: (v: string[]) => Promise<string[]>;
}) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <Host
        load={props.load || noCache}
        fetcher={props.fetcher}
        save={props.save || echo}
      />,
    );
    await settle();
  });
  return tree;
};

/**
 * The hook's own warnings, silenced.
 *
 * Most of this suite drives failures on purpose -- an unreadable cache, a fetch
 * that throws, three empty answers in a row -- and each one logs through
 * ../src/utils/logger by design. Left alone they bury a real failure in a wall
 * of expected noise, which is the opposite of what a test run is for. Silenced
 * rather than asserted on: that the hook logs is not the contract, and pinning
 * the wording would make every message a breaking change.
 */
let quietWarn: jest.SpyInstance;
let quietLog: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  seen = {data: [], loading: true, failed: false};
  quietWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  quietLog = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  quietWarn.mockRestore();
  quietLog.mockRestore();
});

describe('the cache is painted before the network is asked', () => {
  /**
   * The reason a section that has run before shows real content on its first
   * frame rather than a placeholder -- which is what makes caching the banner
   * worth doing at all.
   */
  it('shows the cached value without waiting for the fetch', async () => {
    // A fetch that never resolves: whatever is on screen came from disk.
    await render({
      load: () => Promise.resolve(['cached']),
      fetcher: () => new Promise<string[]>(() => {}),
    });
    expect(seen.data).toEqual(['cached']);
    expect(seen.loading).toBe(false);
  });

  /** The disk is a head start, never the truth. */
  it('replaces the cached value with what the site returns', async () => {
    await render({
      load: () => Promise.resolve(['cached']),
      fetcher: () => Promise.resolve(['fresh']),
    });
    expect(seen.data).toEqual(['fresh']);
  });

  /** Nothing cached and nothing fetched yet is the only loading state. */
  it('reports loading only while there is nothing at all to show', async () => {
    await render({fetcher: () => new Promise<string[]>(() => {})});
    expect(seen.loading).toBe(true);
    expect(seen.data).toEqual([]);
  });

  /**
   * A refresh behind drawn content is not a loading state. Reporting one would
   * swap a live section for a skeleton, which is the flicker this app exists to
   * avoid.
   */
  it('never reports loading once something is drawn', async () => {
    await render({
      load: () => Promise.resolve(['cached']),
      fetcher: () => new Promise<string[]>(() => {}),
    });
    expect(seen.loading).toBe(false);
  });
});

describe('retrying, and stopping', () => {
  it('retries a failed fetch and shows the eventual answer', async () => {
    let calls = 0;
    const fetcher = jest.fn(() => {
      calls += 1;
      return Promise.resolve(calls < 3 ? [] : ['third time']);
    });

    await render({fetcher});
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Each retry is a timer; advancing it must also let its promises settle.
    for (const delay of RETRY_DELAYS) {
      await ReactTestRenderer.act(async () => {
        jest.advanceTimersByTime(delay);
        await settle();
      });
    }

    expect(seen.data).toEqual(['third time']);
    expect(seen.failed).toBe(false);
  });

  /**
   * THE HALF THAT MATTERS MOST. A dashboard section is not worth an unbounded
   * retry loop; a phone in a lift must not be left spinning its radio.
   */
  it('stops after the last delay and reports failure', async () => {
    const fetcher = jest.fn(() => Promise.resolve<string[]>([]));
    await render({fetcher});

    for (const delay of RETRY_DELAYS) {
      await ReactTestRenderer.act(async () => {
        jest.advanceTimersByTime(delay);
        await settle();
      });
    }
    const afterGivingUp = fetcher.mock.calls.length;
    expect(afterGivingUp).toBe(RETRY_DELAYS.length);
    expect(seen.failed).toBe(true);

    // Well past every delay: no further attempt may be made.
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(60000);
      await settle();
    });
    expect(fetcher).toHaveBeenCalledTimes(afterGivingUp);
  });

  /** A throw and an empty answer are the same failure to a caller. */
  it('treats a thrown fetch as a failed attempt', async () => {
    const fetcher = jest.fn(() => Promise.reject(new Error('offline')));
    await render({fetcher});
    for (const delay of RETRY_DELAYS) {
      await ReactTestRenderer.act(async () => {
        jest.advanceTimersByTime(delay);
        await settle();
      });
    }
    expect(seen.failed).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(RETRY_DELAYS.length);
  });

  /**
   * A failed refresh must leave the cached section on screen. Going blank on a
   * bad connection is worse than showing last launch's banner.
   */
  it('keeps cached content when every refresh fails', async () => {
    await render({
      load: () => Promise.resolve(['cached']),
      fetcher: () => Promise.resolve<string[]>([]),
    });
    for (const delay of RETRY_DELAYS) {
      await ReactTestRenderer.act(async () => {
        jest.advanceTimersByTime(delay);
        await settle();
      });
    }
    expect(seen.data).toEqual(['cached']);
    // `failed` is for a caller deciding whether to draw nothing at all. There
    // is content, so this is not that case.
    expect(seen.failed).toBe(false);
  });
});

describe('the screen going away', () => {
  it('aborts the request in flight', async () => {
    let signal: AbortSignal | undefined;
    const tree = await render({
      fetcher: s => {
        signal = s;
        return new Promise<string[]>(() => {});
      },
    });
    expect(signal?.aborted).toBe(false);
    await ReactTestRenderer.act(async () => {
      tree.unmount();
    });
    expect(signal?.aborted).toBe(true);
  });

  /** A retry timer that outlives its component would fetch for a dead screen. */
  it('cancels a pending retry', async () => {
    const fetcher = jest.fn(() => Promise.resolve<string[]>([]));
    const tree = await render({fetcher});
    expect(fetcher).toHaveBeenCalledTimes(1);

    await ReactTestRenderer.act(async () => {
      tree.unmount();
    });
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(60000);
      await settle();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('what is stored is what is shown', () => {
  /**
   * The store is the arbiter, because it is what the next launch will read.
   * `saveBannerSlides` for instance drops a slide whose URL is not https -- so
   * the screen must show the cleaned list, not the raw fetch.
   */
  it('prefers the stored result over the raw fetch', async () => {
    await render({
      fetcher: () => Promise.resolve(['raw', 'dropped']),
      save: () => Promise.resolve(['raw']),
    });
    expect(seen.data).toEqual(['raw']);
  });

  /** A store that rejects everything must not blank a section it could draw. */
  it('falls back to the fetched value when the store returns nothing', async () => {
    await render({
      fetcher: () => Promise.resolve(['fetched']),
      save: () => Promise.resolve([]),
    });
    expect(seen.data).toEqual(['fetched']);
  });

  /** A disk read that throws is a cache miss, not a crash. */
  it('survives an unreadable cache', async () => {
    await render({
      load: () => Promise.reject(new Error('corrupt')),
      fetcher: () => Promise.resolve(['fresh']),
    });
    expect(seen.data).toEqual(['fresh']);
  });
});
