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
 * The homepage's template prefix. See ./community for why this is
 * `template--` and not `sections--`.
 */
const HOME = 'template--26530973548860__';

/**
 * The poster frame's artwork store.
 *
 * `zigly-thumbnail.jpg` is the theme's `video_poster`. The mp4 itself
 * (`shopify://files/videos/zigly-videoplayback.mp4`) is a Files reference, not
 * an image, so ./tileIcons cannot resolve it -- which is the other half of the
 * dependency question above: the app would need the file's CDN URL as well as
 * a player.
 */
export const VIDEO_RAIL = {
  storeKey: 'zigly.videoPoster.v1',
  sectionId: HOME + 'custom_video_text_banner_HKdrme',
  fragment: 'custom_video_text_banner',
  tiles: [
    {
      label: VIDEO_TITLE,
      // No destination: the poster is a play control, not a link. The screen
      // decides what a tap does -- see ./VideoBlock.
      path: '',
      key: 'zigly-thumbnail.jpg',
    },
  ],
};
