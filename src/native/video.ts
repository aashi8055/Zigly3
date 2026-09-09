/**
 * "Zigly: India's Complete Pet Care Ecosystem" — the video block.
 *
 * Section twenty. A poster image, a heading, a paragraph and an mp4, on a navy
 * ground. Read from `templates/index.json` -- the HOMEPAGE, because
 * ../webview/extraSections places it with `{move: 'custom_video_text_banner'}`
 * rather than a fetch.
 *
 * THE VIDEO IS NOT AUTOPLAYED, AND NOT MUTED. The theme's element is
 *
 *   <video width="100%" controls playsinline poster="...">
 *
 * -- controls, no `autoplay`, no `muted`, no `loop`. So on the site the customer
 * sees a poster frame and taps to play, with the browser's own controls. That is
 * the behaviour to match, and it is worth stating because a native rebuild's
 * instinct is a muted autoplaying loop, which this section is not.
 *
 * WHICH LEAVES A DEPENDENCY QUESTION THIS MODULE DOES NOT ANSWER. React Native
 * has no `<Video>`: playing an mp4 needs `react-native-video` or
 * `expo-video`, and neither is installed (`package.json` carries
 * react-native-webview, netinfo, safe-area-context and svg -- no media
 * package). Adding a native module is not a change to make silently, so this
 * module carries the DATA and ./VideoBlock draws the poster, the heading and
 * the copy, with the tap handed up to the screen. See the note there for the
 * two ways the play can be wired and why neither is chosen here.
 */

/** The section heading, from `banner_heading`. */
export const VIDEO_TITLE = 'Zigly: India’s Complete Pet Care Ecosystem';

/**
 * The paragraph, verbatim from `banner_description`.
 *
 * Zigly's own copy about their parent company and their offering. Kept whole:
 * trimming it would be this app editing a statement about the business.
 */
export const VIDEO_DESCRIPTION =
  'Powered by Cosmo First Limited, Zigly is redefining pet parenting with an ' +
  'integrated ecosystem that puts your pet’s happiness and health first. From ' +
  '24x7 veterinary care, expert grooming, authentic pet products, and engaging ' +
  'pet events to digital-first services and an omnichannel experience, Zigly ' +
  'brings every aspect of pet care under one trusted roof. Whether online or ' +
  'in-store, Zigly is your ultimate partner in pet parenting.';

/** The theme's own `background_color` and `text_color` for this block. */
export const VIDEO_BACKGROUND = '#183761';
export const VIDEO_TEXT = '#ffffff';

/**
 * The YouTube video this section plays, and where its poster frame comes from.
 *
 * THIS SECTION HAS NO POSTER IMAGE, AND THE APP SPENT ITS WHOLE LIFE LOOKING
 * FOR ONE. Corrected 2026-09-09 by reading the section as the dashboard
 * actually renders it, which is the dog page's copy:
 *
 *   "video_link": "https://www.youtube.com/watch?v=1vIjfkud5MQ"
 *
 * and no `video_poster` setting at all. `custom-video-text-banner.liquid` has
 * four branches -- `video_file`, `video_url`, `video_link`, then nothing -- and
 * only the first two emit a `<video poster="...">`. `video_link` emits a bare
 * YouTube `<iframe>`. Verified against the live rendered section: one iframe,
 * no `<img>`, no `poster` attribute anywhere in the markup.
 *
 * WHICH MADE THE SECTION DRAW NOTHING. ./tileIcons only reads `<img src>` and
 * `<video poster>`, so it found no candidate, `VIDEO_RAIL` resolved empty, and
 * ./VideoBlock's `poster ? ... : null` fell through to `null` -- the whole
 * block, heading and copy included, rendered as nothing. That was invisible
 * rather than broken-looking, which is why it went unnoticed.
 *
 * The previous note here claimed `video_poster` was
 * `shopify://shop_images/zigly-thumbnail.jpg` with the mp4 at
 * `shopify://files/videos/zigly-videoplayback.mp4`. Neither is in this
 * section's settings. That reading came from `templates/index.json` -- the
 * HOMEPAGE's copy of the section, which the docblock at the top of this file
 * says outright is where it was read from -- and the homepage's copy is
 * configured differently from the dog page's. The dashboard is the dog page
 * (see ../native/dashboardSections), so the dog page's settings are the ones
 * that count. A `zigly-thumbnail.jpg` does exist in Files and is the same
 * still frame, which is exactly why the mistake survived: the key looked
 * plausible and its absence looked like a network failure.
 *
 * SO THE POSTER IS DERIVED, NOT FETCHED. YouTube serves a still for every
 * video at a fixed URL from the id, so the frame needs no Shopify lookup and
 * no section fetch at all -- it is the one piece of artwork on the dashboard
 * that is complete on the first frame with no request. `maxresdefault` is the
 * 1280x720 master; it exists for this video (checked), and `hqdefault` is the
 * fallback every video has if a future one is swapped in without an HD still.
 */
export const VIDEO_ID = '1vIjfkud5MQ';

/**
 * The poster frame's URL, from the video id.
 *
 * i.ytimg.com, which is YouTube's own image host and needs no API key. Not
 * routed through ./tileIcons: there is no section markup to parse and nothing
 * to learn, so a store and a fetch would be machinery around a string.
 */
export const VIDEO_POSTER = `https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`;

/** The fallback still, for a video with no HD frame. See `VIDEO_POSTER`. */
export const VIDEO_POSTER_FALLBACK = `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`;

/** Where a tap goes, until the app can play an embed itself. */
export const VIDEO_WATCH_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
