#!/usr/bin/env node
/**
 * Refetch the Instagram covers and rewrite src/webview/instagramCovers.ts.
 *
 * Run this after editing POSTS in src/webview/instagramSection.ts:
 *
 *   node tools/fetch-instagram-covers.js
 *
 * The shortcodes are READ FROM that file rather than repeated here, so the
 * post list has exactly one home and this cannot drift from it.
 *
 * Covers come from instagram.com/p/<shortcode>/media/?size=m -- unsigned,
 * permanent, and 320px on the long edge, which is the size the rail actually
 * shows. See the header of the generated file for why the bytes are inlined
 * as data: URIs rather than shipped as asset files.
 *
 * A shortcode that does not return image/jpeg is reported and the file is NOT
 * written: a partial rewrite would silently blank whichever cards failed, and
 * a fetch failing usually means the post list is stale rather than the network
 * being down. Fix the list, run it again.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const SECTION = path.join(ROOT, 'src', 'webview', 'instagramSection.ts');
const OUT = path.join(ROOT, 'src', 'webview', 'instagramCovers.ts');
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);

/** The shortcodes in POSTS, in the order the file lists them. */
function readShortcodes() {
  const src = fs.readFileSync(SECTION, 'utf8');
  const start = src.indexOf('const POSTS');
  if (start === -1) {
    throw new Error('no POSTS array in ' + SECTION);
  }
  const end = src.indexOf('\n];', start);
  const body = src.slice(start, end === -1 ? undefined : end);
  const ids = [];
  const pattern = /id:\s*"([^"]+)"/g;
  let match;
  while ((match = pattern.exec(body)) !== null) {
    ids.push(match[1]);
  }
  if (!ids.length) {
    throw new Error('POSTS parsed but no ids found');
  }
  return ids;
}

/** GET, following the redirect /media/ answers with. */
function fetch(url, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > 5) {
      reject(new Error('too many redirects'));
      return;
    }
    https
      .get(url, {headers: {'User-Agent': 'Mozilla/5.0'}}, res => {
        const {statusCode, headers} = res;
        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          res.resume();
          resolve(fetch(new URL(headers.location, url).toString(), hops + 1));
          return;
        }
        if (statusCode !== 200) {
          res.resume();
          reject(new Error('HTTP ' + statusCode));
          return;
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

const HEADER = `/**
 * The eight Instagram covers, as bytes.
 *
 * WHY THE IMAGES ARE IN THE REPO
 *
 * The rail used to point its <img> tags straight at
 * instagram.com/p/<shortcode>/media/, and that endpoint does work: it is
 * unsigned, permanent, and redirects to a freshly signed CDN image on every
 * request. What it is not is OURS. It is a third-party request, made from
 * inside the customer's shopping session, on a screen Zigly's name is on --
 * so it can be slow, can be rate-limited mid-scroll, and can be changed
 * without notice by someone who has never heard of this app. The section had
 * already gone missing from the dashboard once.
 *
 * These are those same covers, fetched once and written down. The rail now
 * draws from bytes that ship with the app: no network call, so there is no
 * request to be slow, to fail, or to leak which page the customer is on to
 * Instagram.
 *
 * WHY THEY ARE BASE64 AND NOT FILES
 *
 * The rail is not React Native markup -- it is a string of JavaScript injected
 * into a WebView showing https://zigly.com. A require()d asset resolves to a
 * Metro URL in dev and a local file path in release, and a remote https
 * document cannot load either. A data: URI is the one form that needs no
 * origin, no server and no permission, so the bytes travel inside the script
 * that builds the cards.
 *
 * WHY size=m
 *
 * ?size=l serves 720x1280 and ?size=m serves 320px on the long edge. The cards
 * are ~150px wide on a phone, so the large ones were four times the pixels the
 * rail can show and 1.7MB of base64 against 308KB. This bundle is re-injected
 * several times per page load (see RESTYLE_DELAYS), so that size is paid on
 * every pass -- the smaller set is the one that fits.
 *
 * REFRESHING
 *
 * Run tools/fetch-instagram-covers.js, which reads the shortcodes out of
 * instagramSection.ts and rewrites this file.
 *
 * GENERATED FILE -- do not hand-edit.
 */

/** Cover bytes for each shortcode, as a ready-to-use data: URI. */
export const INSTAGRAM_COVERS: {[shortcode: string]: string} = {`;

async function main() {
  const ids = readShortcodes();
  console.log('fetching ' + ids.length + ' covers');
  const entries = [];
  const failed = [];
  for (const id of ids) {
    const url = 'https://www.instagram.com/p/' + id + '/media/?size=m';
    try {
      const body = await fetch(url);
      if (!body.slice(0, 3).equals(JPEG)) {
        throw new Error('not a JPEG (' + body.length + ' bytes)');
      }
      entries.push([id, body.toString('base64')]);
      console.log('  ok   ' + id + '  ' + (body.length / 1024).toFixed(0) + 'KB');
    } catch (e) {
      failed.push(id);
      console.log('  FAIL ' + id + '  ' + e.message);
    }
  }

  if (failed.length) {
    console.error(
      '\n' + failed.length + ' cover(s) failed: ' + failed.join(', ') +
        '\nNothing written. A failure here usually means the post list in' +
        '\ninstagramSection.ts is stale -- check those shortcodes against the' +
        '\naccount, then run this again.',
    );
    process.exit(1);
  }

  const body = entries
    .map(([id, b64]) => '  ' + JSON.stringify(id) + ':\n    \'data:image/jpeg;base64,' + b64 + '\',')
    .join('\n');
  fs.writeFileSync(OUT, HEADER + '\n' + body + '\n};\n');
  console.log('\nwrote ' + path.relative(ROOT, OUT) + ' (' + (fs.statSync(OUT).size / 1024).toFixed(0) + 'KB)');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
