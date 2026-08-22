/**
 * The rotating search placeholder, typed out a letter at a time.
 *
 * zigly.com's own search field does not sit still, and the way it moves is not
 * a fade or a swap -- it is a typewriter. SearchTap, which owns the site's
 * search box, runs this (read out of the live `searchtap.js` on 2026-08-22, in
 * its `dynamicPlaceholder` method):
 *
 *   input.setAttribute('placeholder', '')
 *   phrases = ['Search For Dry Food',
 *              'Search For Oral & Dental Care',
 *              'Search For Grooming Tools']
 *   type   -> one character every 100ms until the phrase is whole
 *   hold   -> 1000ms
 *   erase  -> one character every 50ms until the field is empty
 *   pause  -> 1000ms, then the next phrase, wrapping at the end
 *
 * So the app's header does exactly that, with those timings, and that is what
 * the constants below are. Nothing is smoothed or rounded: a placeholder that
 * moves at a different speed from the website's is a placeholder that came from
 * somewhere else.
 *
 * WHERE THE PHRASES COME FROM. SearchTap keeps its list inside a minified
 * bundle, not in an attribute, so there is nothing to read out of the DOM
 * up front -- but the *animation* is in the DOM, one letter at a time, on an
 * input this app keeps rendered. `webview/searchBridge.ts` watches that
 * attribute, reassembles each phrase as the site finishes typing it, and sends
 * the list over. Those phrases replace the seeds below as they arrive, so when
 * Zigly edits their list the app follows without a release.
 *
 * The seeds are there because the reader cannot be instant: the site takes
 * about four seconds per phrase, so a cold header would sit blank through the
 * first thing the customer looks at. They are Zigly's own copy, not invented
 * here -- three verbatim from the bundle above, and the fourth observed in
 * Zigly's own app.
 */

/**
 * What the header starts from, before the reader has seen the site type.
 *
 * Order is the order they were observed in. Anything the reader brings back is
 * folded in after these rather than replacing them -- see `mergePlaceholders` --
 * so the list only ever grows towards what the site is actually showing.
 */
export const SEED_PLACEHOLDERS = [
  'Search For Applod Dog Biscuits',
  'Search For Dry Food',
  'Search For Oral & Dental Care',
  'Search For Grooming Tools',
];

/** How many phrases are kept. The site cycles a handful; this is headroom. */
export const MAX_PLACEHOLDERS = 12;

/** SearchTap's own cadence, in milliseconds. See the note above. */
export const TYPE_MS = 100;
export const HOLD_MS = 1000;
export const ERASE_MS = 50;
export const PAUSE_MS = 1000;

/**
 * Cadence used until the site's own has been measured.
 *
 * A placeholder that changes while you are reading it is worse than one that
 * never changes, so this errs slow.
 */
export const DEFAULT_PLACEHOLDER_MS = TYPE_MS;

/** Bounds on what we will accept as the site's measured per-letter cadence. */
export const MIN_PLACEHOLDER_MS = 40;
export const MAX_PLACEHOLDER_MS = 400;

/** Shorter than this is a label, not a prompt; longer will not fit the field. */
const MIN_LENGTH = 3;
const MAX_LENGTH = 60;

/**
 * Collapse whitespace and trim, the way the announcement bar does. Attribute
 * values arrive with whatever the theme's template left in them.
 */
const squash = (value: string): string => {
  const out: string[] = [];
  let prevWs = true;
  for (const char of value) {
    const isWs = char === ' ' || char === '\t' || char === '\n' || char === '\r';
    if (isWs) {
      if (!prevWs) {
        out.push(' ');
        prevWs = true;
      }
    } else {
      out.push(char);
      prevWs = false;
    }
  }
  const joined = out.join('');
  return joined.endsWith(' ') ? joined.slice(0, -1) : joined;
};

/**
 * A phrase we are willing to show, or null.
 *
 * The value comes off a page we do not control, over a string bridge, so it is
 * checked rather than trusted: a non-string, an empty attribute or a stray
 * paragraph of markup must be dropped, not drawn into the header.
 */
export const cleanPlaceholder = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const text = squash(value);
  return text.length >= MIN_LENGTH && text.length <= MAX_LENGTH ? text : null;
};

/**
 * Fold new phrases into the ones already on screen.
 *
 * Additive on purpose. The reader sees one phrase per rotation tick, so the
 * list arrives a piece at a time; replacing it on every message would leave the
 * header showing whichever single phrase came last. Order is first-seen, which
 * is the order the site rotates them in, and duplicates fold case-insensitively
 * so "Search For Cat Food" does not join "Search for cat food".
 */
export const mergePlaceholders = (
  existing: string[],
  incoming: unknown,
): string[] => {
  if (!Array.isArray(incoming)) {
    return existing;
  }
  const merged = [...existing];
  const seen = new Set(existing.map(phrase => phrase.toLowerCase()));
  for (const raw of incoming) {
    if (merged.length >= MAX_PLACEHOLDERS) {
      break;
    }
    const phrase = cleanPlaceholder(raw);
    if (phrase === null) {
      continue;
    }
    const fold = phrase.toLowerCase();
    if (seen.has(fold)) {
      continue;
    }
    seen.add(fold);
    merged.push(phrase);
  }
  return merged.length === existing.length ? existing : merged;
};

/**
 * Accept a cadence measured on the page, or keep the current one.
 *
 * The measurement is a median of observed gaps, so it can still be nonsense if
 * the page was backgrounded mid-cycle -- an out-of-range figure is ignored
 * rather than clamped into a rotation speed the site does not actually use.
 */
export const acceptInterval = (raw: unknown, current: number): number => {
  if (typeof raw !== 'number' || !isFinite(raw)) {
    return current;
  }
  const ms = Math.round(raw);
  return ms >= MIN_PLACEHOLDER_MS && ms <= MAX_PLACEHOLDER_MS ? ms : current;
};

/* ------------------------------------------------------------------------- *
 * The typewriter
 *
 * Kept here, as data, rather than as timers inside the header component. The
 * component then owns one `setTimeout` and no logic worth testing, and the
 * cycle itself -- which is the part that can be wrong -- is a pure function of
 * the previous frame.
 * ------------------------------------------------------------------------- */

/** Which part of the cycle a frame is in. */
export type TypePhase = 'typing' | 'holding' | 'erasing' | 'pausing';

export interface TypeFrame {
  /** Index into the phrase list. */
  readonly phrase: number;
  /** How many characters of it are shown. */
  readonly chars: number;
  readonly phase: TypePhase;
}

/** Start of the cycle: nothing shown, about to type the first phrase. */
export const FIRST_FRAME: TypeFrame = {phrase: 0, chars: 0, phase: 'typing'};

/**
 * How long this frame stays on screen before the next one.
 *
 * `typeMs` is the one figure the reader can measure on the live page, so it is
 * a parameter; the holds are SearchTap's and are not worth measuring, since a
 * pause is not something a customer can time against the website.
 */
export const frameDelay = (frame: TypeFrame, typeMs: number): number => {
  switch (frame.phase) {
    case 'typing':
      return typeMs;
    case 'holding':
      return HOLD_MS;
    case 'erasing':
      return ERASE_MS;
    default:
      return PAUSE_MS;
  }
};

/** What the field reads on this frame. */
export const frameText = (frame: TypeFrame, phrases: string[]): string => {
  if (phrases.length === 0) {
    return '';
  }
  const phrase = phrases[frame.phrase % phrases.length] ?? '';
  return phrase.slice(0, frame.chars);
};

/**
 * The next frame.
 *
 * `phrases` is passed in rather than closed over because the list grows while
 * the animation is running -- the reader is still bringing phrases back from
 * the page -- and the wrap at the end has to be against the list as it is now.
 * A shrinking or emptied list cannot strand the cycle: the phrase index is
 * taken modulo the length everywhere it is used.
 */
export const nextFrame = (frame: TypeFrame, phrases: string[]): TypeFrame => {
  const count = phrases.length;
  if (count === 0) {
    return FIRST_FRAME;
  }
  const current = phrases[frame.phrase % count] ?? '';

  switch (frame.phase) {
    case 'typing':
      return frame.chars >= current.length
        ? {...frame, chars: current.length, phase: 'holding'}
        : {...frame, chars: frame.chars + 1};

    case 'holding':
      return {...frame, phase: 'erasing'};

    case 'erasing':
      return frame.chars <= 0
        ? {...frame, chars: 0, phase: 'pausing'}
        : {...frame, chars: frame.chars - 1};

    default:
      return {
        phrase: (frame.phrase + 1) % count,
        chars: 0,
        phase: 'typing',
      };
  }
};
