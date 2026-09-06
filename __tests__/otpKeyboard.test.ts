/**
 * The keypad the OTP boxes raise, and the two ways it has to go away.
 *
 * ../src/components/OtpScreen autofocuses its first box, so the keypad is up
 * from the moment the screen arrives. Nothing lowered it again: the screen the
 * app moves to on a good code unmounts the boxes rather than blurring them, and
 * an unmounted TextInput does not tell the OS that focus was surrendered -- so
 * the keypad sat over the account screen until the customer pressed Back.
 *
 * Source assertions rather than a mounted tree: the dismissal lives in
 * ZiglyWebViewScreen, which cannot be mounted in this suite without a WebView,
 * and what matters is that the two exits from the OTP step both carry it. The
 * same technique as the timing assertions in ./cartToast.test.tsx.
 */
import {readFileSync} from 'fs';

const SCREEN = 'src/screens/ZiglyWebViewScreen.tsx';

const source = (): string => readFileSync(SCREEN, 'utf8');

/**
 * The body of a named useCallback / function, from its opening line to the
 * dependency array that closes it.
 *
 * Deliberately blunt -- it only has to be good enough to tell "inside
 * submitOtp" from "somewhere else in a 4800-line file".
 */
const bodyOf = (src: string, marker: string): string => {
  const start = src.indexOf(marker);
  if (start === -1) {
    throw new Error(`could not find ${marker} in ${SCREEN}`);
  }
  const end = src.indexOf('  );', start);
  return src.slice(start, end === -1 ? src.length : end);
};

describe('the OTP keypad', () => {
  it('is lowered when the code is submitted', () => {
    /*
     * The reported fault, in one line: submitting left the keypad up over
     * whatever came next, and only Back would clear it. This is the way
     * forward out of the step.
     */
    const body = bodyOf(source(), 'const submitOtp = useCallback(');
    expect(body).toContain('Keyboard.dismiss()');
  });

  it('is lowered when the app goes back to the phone step', () => {
    /*
     * The way back. Three routes reach it -- Edit phone number, the header's
     * back arrow, and Android's hardware Back -- and the effect asserted here
     * is the one place all three converge, which is why it exists.
     */
    const src = source();
    const start = src.indexOf('Take the widget back when the app goes back');
    expect(start).toBeGreaterThan(-1);
    const effect = src.slice(start, src.indexOf('  }, [accountScreens', start));
    expect(effect).toContain('Keyboard.dismiss()');
  });

  it('imports Keyboard from react-native', () => {
    // Without the import the calls above are a crash, not a dismissal.
    expect(source()).toContain('  Keyboard,');
  });

  it('does not blur by unmounting and hoping', () => {
    /*
     * Guards the reasoning rather than the code: OtpScreen keeps autoFocus on
     * its first box, which is what makes an explicit dismissal necessary. If
     * that ever goes, this test should be revisited rather than deleted -- a
     * screen that never raises the keypad does not need to lower it.
     */
    const otp = readFileSync('src/components/OtpScreen.tsx', 'utf8');
    expect(otp).toContain('autoFocus={index === 0}');
  });
});
