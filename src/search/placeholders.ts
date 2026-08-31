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
 * The app types and erases at exactly those speeds. It does NOT keep the site's
 * final pause: an empty search bar sitting still for a second reads as a bar
 * that has lost its label, so the next phrase starts the moment the last
 * character comes off. That is the one deliberate difference from the website
 * here, and it is the reason there is no resting label either -- the bar is
 * never empty for long enough to need one.
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

/**
 * How much faster than the site the app types.
 *
 * The site's own cadence is the figure below at scale 1. The app runs the
 * typewriter a little quicker than that: a phrase the customer has to wait out
 * before the next one starts is the one part of the site's animation that reads
 * as slow on a phone, where the header is the first thing on screen. The hold
 * shrinks with it, so the whole cycle stays in proportion rather than the
 * letters racing to a pause of the old length.
 *
 * Applied to the measured cadence too (see `acceptInterval`), or the site's own
 * ~100ms would land as soon as the reader reports it and undo this.
 */
const SPEED_SCALE = 0.7;

/** SearchTap's own cadence, in milliseconds, scaled by SPEED_SCALE. */
export const TYPE_MS = Math.round(100 * SPEED_SCALE);
export const HOLD_MS = Math.round(1000 * SPEED_SCALE);
export const ERASE_MS = Math.round(50 * SPEED_SCALE);

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
 * The rotating list, which is now exactly SEED_PLACEHOLDERS -- nothing less,
 * nothing more.
 *
 * This used to fold the site's own phrases in as `webview/searchBridge.ts`
 * read them off the live search box, growing the list up to
 * MAX_PLACEHOLDERS. That was the right idea and the wrong result in practice:
 * the phrases arrive one per rotation tick over several seconds, so the bar
 * the customer saw changed length and content while they were looking at it,
 * and what it ended up cycling depended on how long they had stayed on the
 * page. The seeds are Zigly's own copy and they are the four the header is
 * designed around, so the list is now fixed at them.
 *
 * The function is KEPT, rather than deleted along with the reader, for two
 * reasons: `existing` is returned by identity so the caller's `useState`
 * setter does not re-render on every message the bridge still sends, and the
 * reader itself is what measures the site's typing cadence -- see
 * `acceptInterval`, which is still live. Growing the list again means changing
 * this one function, not rewiring the bridge.
 *
 * `incoming` is deliberately unused, which is why nothing here validates it any
 * more: `cleanPlaceholder` was the guard on text arriving from a page this app
 * does not control, and that guard is only needed by whatever puts such text on
 * screen. Nothing does. It stays exported, tested and ready for the day the
 * list grows again -- deleting it would mean rewriting it, unvetted, at exactly
 * the moment untrusted phrases start being shown.
 */
export const mergePlaceholders = (
  existing: string[],
  _incoming: unknown,
): string[] => existing;

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
  if (ms < MIN_PLACEHOLDER_MS || ms > MAX_PLACEHOLDER_MS) {
    return current;
  }
  // Range-checked against what the site actually does, then scaled: the bound
  // is a sanity check on the measurement, and SPEED_SCALE is the app's choice
  // about how fast to replay it. Never below MIN_PLACEHOLDER_MS, so a slow
  // measurement cannot be scaled into a blur.
  return Math.max(MIN_PLACEHOLDER_MS, Math.round(ms * SPEED_SCALE));
};

/* ------------------------------------------------------------------------- *
 * The typewriter
 *
 * Kept here, as data, rather than as timers inside the header component. The
 * component then owns one `setTimeout` and no logic worth testing, and the
 * cycle itself -- which is the part that can be wrong -- is a pure function of
 * the previous frame.
 * ------------------------------------------------------------------------- */

/**
 * Which part of the cycle a frame is in.
 *
 * There is no 'pausing': the site holds an empty field for a second before
 * starting the next phrase, and the app does not. Erasing the last character
 * hands straight to the next phrase's first one.
 */
export type TypePhase = 'typing' | 'holding' | 'erasing';

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
    default:
      return ERASE_MS;
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

    default:
      // Erasing. At nothing left, straight on to the next phrase -- no frame
      // spent holding an empty bar.
      return frame.chars <= 1
        ? {phrase: (frame.phrase + 1) % count, chars: 0, phase: 'typing'}
        : {...frame, chars: frame.chars - 1};
  }
};
