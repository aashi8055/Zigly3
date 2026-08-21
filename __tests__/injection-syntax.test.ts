/**
 * Guards against the failure that cost several build cycles: the injected
 * script is assembled from template literals, and a mangled escape sequence
 * (a lost backslash in a regex, an unescaped newline) turns the whole payload
 * into invalid JavaScript. The WebView then silently executes nothing -- no
 * error, no styling, no diagnostics, just a page that looks untouched.
 *
 * `new Function` parses without executing, which is exactly the check we want.
 */
import {getInjectionForUrl} from '../src/webview/injectedScripts';

const parses = (src: string): boolean => {
  try {
    // eslint-disable-next-line no-new-func
    new Function(src);
    return true;
  } catch {
    return false;
  }
};

describe('injected script is syntactically valid', () => {
  it.each([
    'https://zigly.com/',
    'https://zigly.com/collections/sale',
    'https://zigly.com/products/a-dog-bed',
    'https://zigly.com/cart',
  ])('parses cleanly for %s', url => {
    const script = getInjectionForUrl(url);
    expect(script).not.toBeNull();
    expect(parses(script as string)).toBe(true);
  });

  it('contains no stray line comment created by a lost regex escape', () => {
    // `/\/+$/` collapsing to `//+$/` silently commented out the rest of the file.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).not.toContain('replace(//');
  });

  it('has no regex mangled by a lost backslash', () => {
    const script = getInjectionForUrl('https://zigly.com/') as string;
    // `/\s+/` collapsing to `/s+/` would replace the letter "s" in category
    // names. Neither this nor the comment-forming `//` variant may appear.
    expect(script).not.toContain('/s+/g');
    expect(script).not.toContain('replace(//');
  });

  it('contains no character class flattened by a lost backslash', () => {
    const script = getInjectionForUrl('https://zigly.com/') as string;
    // /[\s]/ compiling to /[s]/ has silently corrupted text twice. Any bare
    // [s] or /s+/ in the built script means an escape was eaten again.
    expect(script).not.toContain('[s]+');
    expect(script).not.toContain('/s+/g');
    expect(script).not.toContain('replace(//');
  });
});
