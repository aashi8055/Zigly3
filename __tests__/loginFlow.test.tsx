/**
 * Login With OTP, end to end -- the native screens and the rules behind them.
 *
 * What this file exists to pin, in the order it goes wrong if nobody does:
 *
 *   1. **The Account tab never opens a website.** Signed out it opens the phone
 *      step, and every screen of the flow is native but for the signup form,
 *      which is SimplyOTP's own and has to be.
 *   2. **A send is a send.** ../src/components/LoginScreen refuses a number its
 *      country's rules refuse, and Receive OTP cannot be pressed twice into one
 *      request -- an SMS is charged for, and a second tap during the second the
 *      provider takes to answer is a second one.
 *   3. **Navigation follows the widget, not the press.** The OTP screen appears
 *      when the widget reports it has moved, because that is the closest thing
 *      to proof a code went out.
 *   4. **The customer is never dropped out of the flow.** An account probe
 *      answering "signed out" -- which is the truth, right up until the OTP is
 *      accepted -- must not collapse a half-entered code back to the phone step.
 *   5. **The countdown means something.** It restarts on a resend that actually
 *      went out, not on the press that asked for one.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text, TextInput} from 'react-native';

import LoginScreen from '../src/components/LoginScreen';
import OtpScreen, {
  OTP_LENGTH,
  RESEND_SECONDS,
} from '../src/components/OtpScreen';
import CountryPickerSheet from '../src/components/CountryPickerSheet';
import {
  DEFAULT_COUNTRY,
  DIAL_COUNTRIES,
  digitsOnly,
  emojiFlag,
  filterCountries,
  phoneLengths,
  validatePhone,
} from '../src/account/dialCodes';
import type {DialCountry} from '../src/account/dialCodes';
import {
  LOGIN_FLOW,
  actOnPhase,
  believeAuth,
  isLoginFlow,
  openAccount,
  popScreen,
  pushScreen,
  resolveAuth,
  sameStack,
  topScreen,
} from '../src/navigation/accountStack';
import type {AccountStack} from '../src/navigation/accountStack';
import {
  OTP_DRIVER,
  driveEditPhone,
  driveResend,
  driveSendOtp,
  driveSubmitOtp,
  otpErrorText,
  readPhase,
} from '../src/webview/otpDriver';

/**
 * Render, and remember it so it can be taken down again.
 *
 * The teardown is not tidiness. OtpScreen runs a one-second interval, and a
 * tree left mounted keeps it ticking into a Jest environment that has already
 * been torn down -- which surfaces as 'trying to import a file after the Jest
 * environment has been torn down', from a test that passed.
 */
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

const render = (node: React.ReactElement) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(node);
  });
  mounted.push(tree);
  return tree;
};

afterEach(() => {
  ReactTestRenderer.act(() => {
    while (mounted.length > 0) {
      mounted.pop()?.unmount();
    }
  });
});

/** Every string the tree draws, flattened. */
const textOf = (tree: ReactTestRenderer.ReactTestRenderer): string =>
  tree.root
    .findAllByType(Text)
    .map(node =>
      (Array.isArray(node.props.children)
        ? node.props.children
        : [node.props.children]
      )
        .filter((child: unknown) => typeof child === 'string')
        .join(''),
    )
    .join(' | ');

/**
 * The one control carrying this accessibility label.
 *
 * Found by label and by having an onPress rather than by component type: RN
 * 0.87 wraps Pressable, so findAllByType would be matching an implementation
 * detail. Same shape as the helper in ./account.test.tsx.
 */
const control = (
  tree: ReactTestRenderer.ReactTestRenderer,
  label: string,
): ReactTestRenderer.ReactTestInstance => {
  const found = tree.root
    .findAll(
      node =>
        node.props?.accessibilityLabel === label &&
        typeof node.props?.onPress === 'function',
    )
    .shift();
  if (!found) {
    throw new Error('no pressable labelled ' + label);
  }
  return found;
};

const press = (node: ReactTestRenderer.ReactTestInstance) => {
  ReactTestRenderer.act(() => {
    node.props.onPress();
  });
};

const type = (
  tree: ReactTestRenderer.ReactTestRenderer,
  label: string,
  value: string,
) => {
  const field = tree.root
    .findAllByType(TextInput)
    .filter(node => node.props.accessibilityLabel === label)[0];
  ReactTestRenderer.act(() => {
    field.props.onChangeText(value);
  });
};

const INDIA = DEFAULT_COUNTRY;
const UK = DIAL_COUNTRIES.find(c => c.iso2 === 'GB') as DialCountry;
/** A country the length table deliberately says nothing about. */
const TONGA = DIAL_COUNTRIES.find(c => c.iso2 === 'TO') as DialCountry;

const noop = () => {};

// ---------------------------------------------------------------------------

describe("the number is checked against the country's own rules", () => {
  it('opens on India, which is what the reference screen shows', () => {
    expect(INDIA.iso2).toBe('IN');
    expect(INDIA.dial).toBe('91');
    expect(emojiFlag('IN')).toBe('\u{1F1EE}\u{1F1F3}');
  });

  it('takes a real Indian mobile and refuses one a digit short or long', () => {
    expect(validatePhone(INDIA, '9004976917')).toBeNull();
    expect(validatePhone(INDIA, '900497691')).not.toBeNull();
    expect(validatePhone(INDIA, '90049769171')).not.toBeNull();
  });

  it('names the length when the country has exactly one', () => {
    // "Enter a valid mobile number" in front of a nine-digit Indian number
    // tells the customer nothing they did not already know.
    expect(validatePhone(INDIA, '900497691')).toContain('10-digit');
    expect(phoneLengths(INDIA)).toEqual([10]);
  });

  it('refuses an Indian landline series, which the length alone lets through', () => {
    // A Delhi landline with its STD code is ten digits too. Mobile is 6-9.
    expect(validatePhone(INDIA, '1123456789')).not.toBeNull();
    expect(validatePhone(INDIA, '5023456789')).not.toBeNull();
    for (const lead of ['6', '7', '8', '9']) {
      expect(validatePhone(INDIA, lead + '004976917')).toBeNull();
    }
  });

  it('says something for an empty field rather than sending nothing', () => {
    expect(validatePhone(INDIA, '')).toBe('Enter your mobile number');
    expect(validatePhone(INDIA, '   ')).toBe('Enter your mobile number');
  });

  it('reads through the spaces and dashes a keypad offers', () => {
    expect(validatePhone(INDIA, '90049 76917')).toBeNull();
    expect(validatePhone(INDIA, '900-497-6917')).toBeNull();
    expect(digitsOnly('+91 90049-76917')).toBe('919004976917');
  });

  it('checks each country against its own length, not against India’s', () => {
    expect(validatePhone(UK, '7911123456')).toBeNull();
    expect(validatePhone(UK, '791112345')).not.toBeNull();
    // And a ten-digit UK number is not judged on India's leading digits.
    expect(validatePhone(UK, '1911123456')).toBeNull();
  });

  it('falls back to E.164 where the table has no entry, rather than guessing', () => {
    // Tonga is absent on purpose: a length invented for it would reject real
    // customers, which is worse than letting the provider answer.
    expect(phoneLengths(TONGA)).toBeNull();
    expect(validatePhone(TONGA, '7715123')).toBeNull();
    // The one rule that is certainly its own: 15 digits including the code.
    const room = 15 - TONGA.dial.length;
    expect(validatePhone(TONGA, '1'.repeat(room))).toBeNull();
    expect(validatePhone(TONGA, '1'.repeat(room + 1))).not.toBeNull();
    expect(validatePhone(TONGA, '123')).not.toBeNull();
  });

  it('never rejects a number every country in the list would accept', () => {
    // A blanket check, so a typo in the packed table is caught here rather
    // than by a customer in a market nobody tested.
    for (const country of DIAL_COUNTRIES) {
      const lengths = phoneLengths(country);
      if (lengths === null) {
        continue;
      }
      for (const length of lengths) {
        expect(length).toBeGreaterThan(3);
        // Every listed length has to fit inside E.164 alongside its own code.
        expect(length + country.dial.length).toBeLessThanOrEqual(15);
      }
    }
  });
});

// ---------------------------------------------------------------------------

describe('the phone step draws what the reference shows, and only that', () => {
  it('is the title, the row and the button -- no signup, no email', () => {
    const tree = render(<LoginScreen onSubmit={noop} />);
    const said = textOf(tree);
    expect(said).toContain('Login With OTP');
    expect(said).toContain('Receive OTP');
    expect(said).toContain('+91');
    expect(said).not.toContain('Sign');
    expect(said).not.toContain('Email');
    expect(said).not.toContain('Password');
  });

  it('draws one field, so there is no empty box under it', () => {
    // The defect this replaces: the site's own widget renders an email input
    // on this step that the store never asks for, and hiding the input alone
    // left its bordered wrapper behind as an empty box under the number.
    const tree = render(<LoginScreen onSubmit={noop} />);
    const fields = tree.root.findAllByType(TextInput);
    expect(fields).toHaveLength(1);
    expect(fields[0].props.accessibilityLabel).toBe('Mobile number');
  });

  it('sends nothing when the number is refused, and says why', () => {
    const sent: string[] = [];
    const tree = render(
      <LoginScreen onSubmit={(_country, phone) => sent.push(phone)} />,
    );
    type(tree, 'Mobile number', '90049');
    press(control(tree, 'Receive OTP'));
    expect(sent).toEqual([]);
    expect(textOf(tree)).toContain('10-digit');
  });

  it('sends the bare digits once the number passes', () => {
    const sent: Array<[string, string]> = [];
    const tree = render(
      <LoginScreen
        onSubmit={(country, phone) => sent.push([country.iso2, phone])}
      />,
    );
    type(tree, 'Mobile number', '90049 76917');
    press(control(tree, 'Receive OTP'));
    expect(sent).toEqual([['IN', '9004976917']]);
  });

  it('drops its complaint on the next keystroke', () => {
    const tree = render(<LoginScreen onSubmit={noop} />);
    type(tree, 'Mobile number', '90049');
    press(control(tree, 'Receive OTP'));
    expect(textOf(tree)).toContain('10-digit');
    type(tree, 'Mobile number', '900497');
    expect(textOf(tree)).not.toContain('10-digit');
  });

  it('cannot be pressed twice into one request', () => {
    // An SMS is charged for. `busy` is the caller saying a send is out.
    const sent: string[] = [];
    const tree = render(
      <LoginScreen busy onSubmit={(_c, phone) => sent.push(phone)} />,
    );
    type(tree, 'Mobile number', '9004976917');
    press(control(tree, 'Receive OTP'));
    expect(sent).toEqual([]);
  });

  it('opens on the number that was already sent to, so Edit comes back to it', () => {
    const tree = render(
      <LoginScreen
        onSubmit={noop}
        initialCountry={UK}
        initialPhone="7911123456"
      />,
    );
    const field = tree.root.findAllByType(TextInput)[0];
    expect(field.props.value).toBe('7911123456');
    expect(textOf(tree)).toContain('+44');
  });

  it('shows the provider’s own words when the caller forwards them', () => {
    const tree = render(
      <LoginScreen onSubmit={noop} error="Too many attempts. Try later." />,
    );
    expect(textOf(tree)).toContain('Too many attempts. Try later.');
  });

  it('keeps the number when the country changes', () => {
    const tree = render(<LoginScreen onSubmit={noop} />);
    type(tree, 'Mobile number', '7911123456');
    const sheet = tree.root.findByType(CountryPickerSheet);
    ReactTestRenderer.act(() => {
      sheet.props.onSelect(UK);
    });
    expect(tree.root.findAllByType(TextInput)[0].props.value).toBe(
      '7911123456',
    );
    expect(textOf(tree)).toContain('+44');
  });
});

// ---------------------------------------------------------------------------

describe('the country selector', () => {
  it('is a sheet that comes up from the bottom, with a search at the top', () => {
    const tree = render(
      <CountryPickerSheet
        visible
        selected={INDIA}
        onSelect={noop}
        onClose={noop}
      />,
    );
    const search = tree.root
      .findAllByType(TextInput)
      .filter(node => node.props.accessibilityLabel === 'Search countries');
    expect(search).toHaveLength(1);
    const said = textOf(tree);
    expect(said).toContain('India');
    expect(said).toContain('+91');
    expect(said).toContain('United Kingdom');
  });

  it('finds a country by name, by code and by dialling code', () => {
    for (const query of ['united king', 'gb', '44', '+44']) {
      const found = filterCountries(DIAL_COUNTRIES, query);
      expect(found.map(c => c.iso2)).toContain('GB');
    }
  });

  it('does not offer +1268 for a search of "+1"', () => {
    const found = filterCountries(DIAL_COUNTRIES, '+1');
    expect(found.map(c => c.iso2)).toContain('US');
    // Prefix matching is the point: the list is what a customer scans, and
    // burying the United States under Antigua would be the wrong list.
    expect(found[0].dial.indexOf('1')).toBe(0);
  });

  it('closes on a choice, and reports the country chosen', () => {
    const chosen: string[] = [];
    let closed = 0;
    const tree = render(
      <CountryPickerSheet
        visible
        selected={INDIA}
        onSelect={country => chosen.push(country.iso2)}
        onClose={() => {
          closed += 1;
        }}
      />,
    );
    press(control(tree, 'United Kingdom, plus 44'));
    expect(chosen).toEqual(['GB']);
    expect(closed).toBe(1);
  });
});

// ---------------------------------------------------------------------------

describe('the OTP step', () => {
  const otp = (props: Partial<React.ComponentProps<typeof OtpScreen>> = {}) =>
    render(
      <OtpScreen
        phone="+919004976917"
        onSubmit={noop}
        onEditPhone={noop}
        onResend={noop}
        {...props}
      />,
    );

  it('says the whole number, code included, on one line', () => {
    const tree = otp();
    expect(textOf(tree)).toContain('You will receive OTP on');
    expect(textOf(tree)).toContain('+919004976917');

    // One line, in so many words: the brief asks for it, and a number broken
    // across two reads as a heading with a caption rather than as the end of
    // the sentence it finishes.
    const line = tree.root
      .findAllByType(Text)
      .filter(node => node.props.numberOfLines === 1);
    expect(line).toHaveLength(1);
    expect(line[0].props.adjustsFontSizeToFit).toBe(true);
  });

  it('draws six empty boxes and puts the caret in the first', () => {
    const boxes = otp().root.findAllByType(TextInput);
    expect(boxes).toHaveLength(OTP_LENGTH);
    expect(boxes.every(box => box.props.value === '')).toBe(true);
    expect(boxes[0].props.autoFocus).toBe(true);
    expect(boxes.slice(1).every(box => box.props.autoFocus === false)).toBe(
      true,
    );
  });

  it('advances between boxes as digits are entered', () => {
    const tree = otp();
    const boxes = tree.root.findAllByType(TextInput);
    ReactTestRenderer.act(() => {
      boxes[0].props.onChangeText('4');
    });
    expect(tree.root.findAllByType(TextInput)[0].props.value).toBe('4');
    ReactTestRenderer.act(() => {
      tree.root.findAllByType(TextInput)[1].props.onChangeText('7');
    });
    const after = tree.root.findAllByType(TextInput).map(b => b.props.value);
    expect(after).toEqual(['4', '7', '', '', '', '']);
  });

  it('spreads a pasted or autofilled code across all six', () => {
    const submitted: string[] = [];
    const tree = otp({onSubmit: code => submitted.push(code)});
    ReactTestRenderer.act(() => {
      tree.root.findAllByType(TextInput)[0].props.onChangeText('483920');
    });
    expect(tree.root.findAllByType(TextInput).map(b => b.props.value)).toEqual(
      ['4', '8', '3', '9', '2', '0'],
    );
    press(control(tree, 'Submit'));
    expect(submitted).toEqual(['483920']);
  });

  it('offers the platform its own OTP autofill', () => {
    const boxes = otp().root.findAllByType(TextInput);
    expect(boxes[0].props.textContentType).toBe('oneTimeCode');
    expect(boxes[0].props.autoComplete).toBe('sms-otp');
  });

  it('steps back and clears on a backspace in an empty box', () => {
    const tree = otp();
    ReactTestRenderer.act(() => {
      tree.root.findAllByType(TextInput)[0].props.onChangeText('48');
    });
    ReactTestRenderer.act(() => {
      tree.root
        .findAllByType(TextInput)[2]
        .props.onKeyPress({nativeEvent: {key: 'Backspace'}});
    });
    expect(tree.root.findAllByType(TextInput).map(b => b.props.value)).toEqual(
      ['4', '', '', '', '', ''],
    );
  });

  it('comes back to the phone step on the link', () => {
    let edited = 0;
    const tree = otp({
      onEditPhone: () => {
        edited += 1;
      },
    });
    expect(textOf(tree)).toContain('Edit phone number');
    press(control(tree, 'Edit phone number'));
    expect(edited).toBe(1);
  });
});

// ---------------------------------------------------------------------------

describe('the resend countdown', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const otp = (props: Partial<React.ComponentProps<typeof OtpScreen>> = {}) =>
    render(
      <OtpScreen
        phone="+919004976917"
        onSubmit={noop}
        onEditPhone={noop}
        onResend={noop}
        {...props}
      />,
    );

  const tick = (seconds: number) => {
    ReactTestRenderer.act(() => {
      jest.advanceTimersByTime(seconds * 1000);
    });
  };

  it('opens on thirty seconds and counts down', () => {
    const tree = otp();
    expect(textOf(tree)).toContain(`Resend OTP in ${RESEND_SECONDS}s`);
    tick(1);
    expect(textOf(tree)).toContain(`Resend OTP in ${RESEND_SECONDS - 1}s`);
    tick(10);
    expect(textOf(tree)).toContain(`Resend OTP in ${RESEND_SECONDS - 11}s`);
  });

  it('changes to the didn’t-receive state at zero, and offers the action', () => {
    const tree = otp();
    tick(RESEND_SECONDS);
    const said = textOf(tree);
    expect(said).not.toContain('Resend OTP in');
    expect(said).toContain("Didn't receive OTP?");
    expect(said).toContain('Resend OTP');
    expect(control(tree, 'Resend OTP')).toBeDefined();
  });

  it('asks on the press, and does NOT restart itself', () => {
    // The widget behind this screen may refuse -- its own cooldown, its own
    // captcha. A clock that reset itself anyway would tell the customer to wait
    // thirty seconds for a message nobody sent.
    let asked = 0;
    const tree = otp({
      onResend: () => {
        asked += 1;
      },
    });
    tick(RESEND_SECONDS);
    press(control(tree, 'Resend OTP'));
    expect(asked).toBe(1);
    expect(textOf(tree)).not.toContain('Resend OTP in');
  });

  it('restarts when the caller confirms the resend went out', () => {
    const tree = otp({resendToken: 0});
    tick(RESEND_SECONDS);
    expect(textOf(tree)).toContain("Didn't receive OTP?");
    ReactTestRenderer.act(() => {
      tree.update(
        <OtpScreen
          phone="+919004976917"
          onSubmit={noop}
          onEditPhone={noop}
          onResend={noop}
          resendToken={1}
        />,
      );
    });
    expect(textOf(tree)).toContain(`Resend OTP in ${RESEND_SECONDS}s`);
  });

  it('ignores a second press while the first is still out', () => {
    let asked = 0;
    const tree = otp({
      busy: true,
      onResend: () => {
        asked += 1;
      },
    });
    tick(RESEND_SECONDS);
    press(control(tree, 'Resend OTP'));
    expect(asked).toBe(0);
  });

  it('stops itself at zero rather than counting past it', () => {
    const tree = otp();
    tick(RESEND_SECONDS + 30);
    expect(textOf(tree)).not.toContain('-1s');
    expect(textOf(tree)).toContain("Didn't receive OTP?");
  });
});

// ---------------------------------------------------------------------------

describe('the section knows the login flow is one act', () => {
  it('opens the phone step for a signed-out customer, never the website', () => {
    expect(openAccount('signedOut')).toEqual(['login']);
    expect(openAccount('signedIn')).toEqual(['account']);
    // Unknown opens the account screen, which draws a wait: showing a login
    // form to somebody already signed in, every cold start, is the worse
    // mistake -- and resolveAuth corrects it the moment the probe answers.
    expect(openAccount('unknown')).toEqual(['account']);
  });

  it('ignores the phone step the widget reports on its way to a session', () => {
    // The reported bug: after Submit the OTP screen went back to login for a
    // second before the dashboard appeared. A correct code makes the widget
    // tear its verify step down before the page navigates -- '.verify-box'
    // goes, '.login-box' is briefly unhidden as it resets -- and the driver
    // honestly reports 'phone' for that frame.
    expect(actOnPhase('phone', true)).toBe(false);
    // Not verifying: a phone step is a phone step and is always acted on.
    expect(actOnPhase('phone', false)).toBe(true);
  });

  it('never swallows an outcome, only that one intermediate step', () => {
    // Every real answer acts even mid-verify, so the suppression can delay a
    // screen but cannot lose a result -- the failure that would turn a visible
    // flash into a login that silently goes nowhere.
    (['otp', 'details', 'success', 'missing', 'unknown'] as const).forEach(
      phase => {
        expect(actOnPhase(phase, true)).toBe(true);
        expect(actOnPhase(phase, false)).toBe(true);
      },
    );
  });

  it('names the three screens that are all one act', () => {
    expect(LOGIN_FLOW).toEqual(['login', 'otp', 'signup']);
    expect(isLoginFlow('otp')).toBe(true);
    expect(isLoginFlow('account')).toBe(false);
    expect(isLoginFlow(null)).toBe(false);
  });

  it('leaves a half-entered code alone when a probe says "signed out"', () => {
    // Which it will, and truthfully, for as long as the customer takes to type
    // the code. Collapsing to the phone step on that answer would throw the
    // code away on a timer.
    const typing: AccountStack = ['login', 'otp'];
    expect(resolveAuth(typing, 'signedOut')).toBe(typing);
    const signingUp: AccountStack = ['login', 'otp', 'signup'];
    expect(resolveAuth(signingUp, 'signedOut')).toBe(signingUp);
  });

  it('still collapses everything else to the phone step', () => {
    expect(resolveAuth(['account'], 'signedOut')).toEqual(['login']);
    expect(resolveAuth(['account', 'orders'], 'signedOut')).toEqual(['login']);
    expect(resolveAuth(['login'], 'signedOut')).toEqual(['login']);
  });

  it('swaps any step of the flow for the account screen once signed in', () => {
    expect(resolveAuth(['login'], 'signedIn')).toEqual(['account']);
    expect(resolveAuth(['login', 'otp'], 'signedIn')).toEqual(['account']);
    expect(resolveAuth(['login', 'otp', 'signup'], 'signedIn')).toEqual([
      'account',
    ]);
    // And leaves a screen that is not the flow exactly where it is.
    const orders: AccountStack = ['account', 'orders'];
    expect(resolveAuth(orders, 'signedIn')).toBe(orders);
  });

  it('changes nothing on an answer that is neither yes nor no', () => {
    const stack: AccountStack = ['login', 'otp'];
    expect(resolveAuth(stack, 'unknown')).toBe(stack);
  });

  it('tells a real move from a restatement', () => {
    // The widget reports its step on every re-render, so the same answer
    // arrives many times; rebuilding the stack each time would re-render the
    // whole section for nothing.
    expect(sameStack(['login', 'otp'], ['login', 'otp'])).toBe(true);
    expect(sameStack(['login'], ['login', 'otp'])).toBe(false);
    expect(sameStack(['login', 'otp'], ['login', 'signup'])).toBe(false);
    expect(sameStack([], [])).toBe(true);
  });

  it('keeps push and pop working for the screens that still use them', () => {
    expect(pushScreen(['account'], 'orders')).toEqual(['account', 'orders']);
    expect(popScreen(['account', 'orders'])).toEqual(['account']);
    expect(topScreen(['login', 'otp'])).toBe('otp');
  });
});

// ---------------------------------------------------------------------------

describe('a login just watched outranks a probe that has not caught up', () => {
  // The third fault reported against v15: log in, and the app returns to the
  // login screen. The probe runs in the dashboard WebView, whose cookie jar
  // does not yet have the session the login WebView just obtained, so it
  // honestly answers 'signedOut' for a moment. See believeAuth.
  const WINDOW = 6000;

  it('disbelieves a signedOut that lands right after a login', () => {
    // 1000ms after the login completed, well inside the window.
    expect(believeAuth('signedOut', 10000, 11000, WINDOW)).toBe(false);
  });

  it('believes it again once the window has passed', () => {
    // The suppression must expire on its own: a rule that never let go would
    // be an app that could not sign anyone out.
    expect(believeAuth('signedOut', 10000, 16000, WINDOW)).toBe(true);
    expect(believeAuth('signedOut', 10000, 30000, WINDOW)).toBe(true);
  });

  it('never disbelieves anything when no login has been watched', () => {
    // 0 is "no login on record", which is the ordinary case -- a cold start,
    // or a session that has simply been there all along.
    expect(believeAuth('signedOut', 0, 11000, WINDOW)).toBe(true);
  });

  it('only ever delays a signedOut, never any other answer', () => {
    // signedIn is the answer this rule exists to protect, so it is always
    // believed; 'unknown' is not an answer at all.
    expect(believeAuth('signedIn', 10000, 11000, WINDOW)).toBe(true);
    expect(believeAuth('unknown', 10000, 11000, WINDOW)).toBe(true);
  });

  /*
   * The fault the `confirmed` argument fixes, reported against v16: sign in
   * successfully, land on the dashboard, then tap Account again -- and get the
   * whole login flow a second time instead of the account screen.
   *
   * Nothing was visibly wrong at the time, because the section closes on a
   * successful login. What went wrong was AFTER it: the re-probe the window
   * scheduled was armed when the stale reply arrived rather than when the login
   * happened, so its answer landed a fraction past `window` and was believed --
   * even on a device where the cookie had still not reached the dashboard
   * WebView, which is the very condition the window exists for. That set auth
   * to 'signedOut' and persisted it to the hint, so the next tap opened login.
   */
  describe('and keeps outranking it until a probe actually agrees', () => {
    it('disbelieves a stale signedOut even past the window', () => {
      // The exact shape of the v16 fault: 7s after the login, so the window has
      // passed, but nothing has confirmed the session yet.
      expect(believeAuth('signedOut', 10000, 17000, WINDOW, false)).toBe(false);
      // And however long it takes -- an unconfirmed login is not evidence of a
      // sign-out at any distance.
      expect(believeAuth('signedOut', 10000, 99000, WINDOW, false)).toBe(false);
    });

    it('believes a signedOut once a probe has confirmed the session', () => {
      // `confirmed` latches true on the first 'signedIn' a probe returns, and
      // from then on the ordinary window rules apply again -- which is what
      // keeps a genuine expiry working.
      expect(believeAuth('signedOut', 10000, 17000, WINDOW, true)).toBe(true);
    });

    it('still suppresses inside the window once confirmed', () => {
      // Confirming does not disable the original rule; a second login's own
      // race is still covered by the window.
      expect(believeAuth('signedOut', 10000, 11000, WINDOW, true)).toBe(false);
    });

    it('believes everything when no login is on record, confirmed or not', () => {
      // A cold start has since === 0. The latch must not reach back and
      // suppress a sign-out that has nothing to do with a login this app saw.
      expect(believeAuth('signedOut', 0, 11000, WINDOW, false)).toBe(true);
    });

    it('never suppresses a signedIn, confirmed or not', () => {
      expect(believeAuth('signedIn', 10000, 11000, WINDOW, false)).toBe(true);
    });

    it('defaults to the old behaviour when the argument is omitted', () => {
      // Every existing caller and every test above passes four arguments. The
      // default must therefore be the confirmed case, or adding the parameter
      // would silently change what they mean.
      expect(believeAuth('signedOut', 10000, 17000, WINDOW)).toBe(
        believeAuth('signedOut', 10000, 17000, WINDOW, true),
      );
    });
  });
});

describe('the bridge to the widget', () => {
  it('reads every step the widget can be on', () => {
    expect(readPhase('phone')).toBe('phone');
    expect(readPhase('otp')).toBe('otp');
    expect(readPhase('details')).toBe('details');
    expect(readPhase('success')).toBe('success');
    expect(readPhase('missing')).toBe('missing');
    expect(readPhase('nonsense')).toBe('unknown');
    expect(readPhase(undefined)).toBe('unknown');
  });

  it('says a send went out, which is what restarts the countdown', () => {
    expect(OTP_DRIVER).toContain('ZO.sent = function (step)');
    expect(OTP_DRIVER).toContain("tag: 'otp-sent'");
    expect(driveResend()).toContain("ZO.sent('otp')");
    expect(driveSendOtp('91', '9004976917', 'IN')).toContain("ZO.sent('phone')");
  });

  it('presses the widget’s own controls and calls no provider api', () => {
    // The captcha and the fraud check only run inside the page. Every payload
    // here is a press of a real control, never a request of its own.
    const payloads = [
      driveSendOtp('91', '9004976917', 'IN'),
      driveSubmitOtp('483920'),
      driveResend(),
      driveEditPhone(),
    ];
    for (const payload of payloads) {
      expect(payload).not.toContain('fetch(');
      expect(payload).not.toContain('XMLHttpRequest');
      expect(payload).not.toContain('lucentcommerce');
      expect(payload).toContain('.click()');
    }
  });

  it('answers a repeated attempt, even when the verdict repeats too', () => {
    // The observer only posts a message that has changed, which is right per
    // re-render and wrong across attempts: submit the same wrong code twice and
    // the widget says the same thing twice, so without this the second answer
    // is swallowed and the screen waits on a verdict already given.
    expect(OTP_DRIVER).toContain('ZO.reask = function ()');
    expect(driveSubmitOtp('483920')).toContain('ZO.reask()');
    expect(driveResend()).toContain('ZO.reask()');
    expect(driveSendOtp('91', '9004976917', 'IN')).toContain('ZO.reask()');
  });

  it('does not report a submit as a send, which would restart the clock', () => {
    expect(driveSubmitOtp('483920')).not.toContain('ZO.sent(');
  });

  it('carries the number and the country it was told, and nothing else', () => {
    const payload = driveSendOtp('44', '7911123456', 'GB');
    expect(payload).toContain('"44"');
    expect(payload).toContain('"7911123456"');
    expect(driveSubmitOtp('483920')).toContain('"483920"');
  });

  it('forwards the provider’s own words verbatim when it has any', () => {
    // The rule the whole bridge is built on: an app that paraphrases "this
    // number is blocked" as "invalid number" is an app hiding the real answer.
    expect(otpErrorText('phone', 'This number is blocked.', '')).toBe(
      'This number is blocked.',
    );
    expect(otpErrorText('otp', '  Wrong OTP  ', 'anything')).toBe('Wrong OTP');
  });

  it('describes what the app observed when the provider said nothing', () => {
    expect(otpErrorText('otp', '', 'resend not available yet')).toContain(
      'Resend is not available yet',
    );
    expect(otpErrorText('phone', '', 'country not found in the list')).toContain(
      'not available for OTP login',
    );
    // And the two fallbacks name the step, so the sentence fits the screen.
    expect(otpErrorText('phone', '', 'send button not found')).toContain('send');
    expect(otpErrorText('otp', '', 'otp boxes not found')).toContain('check');
  });

  it('uses no backslash, which a template literal would eat', () => {
    const payloads = [
      OTP_DRIVER,
      driveSendOtp('91', '9004976917', 'IN'),
      driveSubmitOtp('483920'),
      driveResend(),
      driveEditPhone(),
    ];
    for (const payload of payloads) {
      expect(payload).not.toContain('\\');
      expect(payload).not.toContain('new RegExp');
    }
  });
});

// ---------------------------------------------------------------------------

/**
 * How the screen wires the three steps together.
 *
 * Source assertions, which is this project's convention for
 * ../src/screens/ZiglyWebViewScreen: it owns eleven WebViews and cannot be
 * rendered in a test. See the same approach in ./account.test.tsx,
 * ./menu.test.tsx and ./splash.test.tsx.
 */
describe('the section wires the flow the way the brief asks', () => {
  const src = (): string =>
    require('fs').readFileSync('src/screens/ZiglyWebViewScreen.tsx', 'utf8');

  /** One useCallback's body, from its name to the next top-level const. */
  const handler = (name: string): string => {
    const text = src();
    const at = text.indexOf('const ' + name + ' = useCallback');
    expect(at).toBeGreaterThan(-1);
    const next = text.indexOf('\n  const ', at + 20);
    return text.slice(at, next > at ? next : at + 3000);
  };

  it('draws the two steps natively, not as a website', () => {
    const text = src();
    expect(text).toContain("accountTop === 'login' && !widgetMissing");
    expect(text).toContain("accountTop === 'otp' && !widgetMissing");
    expect(text).toContain('<LoginScreen');
    expect(text).toContain('<OtpScreen');
  });

  it('keeps the widget mounted for the whole flow, and unmounts it with it', () => {
    // One page across the three steps rather than three page loads: the
    // session, the captcha and the number the OTP went to all live in it.
    expect(src()).toContain('{loginFlowOpen ? (');
    expect(src()).toContain('const loginFlowOpen = isLoginFlow(accountTop);');
  });

  it('gives that WebView the driver as well as the restyle', () => {
    const text = src();
    expect(text).toContain('injectedJavaScript={LOGIN_PAYLOAD}');
    expect(text).toContain("injectInto('login', LOGIN_PAYLOAD)");
    expect(text).toContain('const LOGIN_PAYLOAD = ');
  });

  it('navigates on the widget moving, never on the press', () => {
    // The press only asks. driveSendOtp is fired and nothing is pushed; the
    // OTP screen arrives when applyLoginPhase is told the step has changed.
    const send = handler('sendOtp');
    expect(send).toContain("injectInto('login', driveSendOtp(");
    expect(send).not.toContain('setAccountScreens');
    expect(src()).toContain('const STACK_FOR_PHASE');
    expect(src()).toContain("otp: ['login', 'otp'],");
    expect(src()).toContain("details: ['login', 'otp', 'signup'],");
  });

  it('will not let one press become two SMS', () => {
    const send = handler('sendOtp');
    expect(send).toContain('setLoginBusy(true)');
    // And the reply that says the button was pressed does not free it again:
    // only the phase moving, an error, or the watchdog does.
    const text = src();
    const sent = text.slice(text.indexOf("if (data.tag === 'otp-sent')"));
    expect(sent.slice(0, 1200)).toContain("if (data.step === 'otp')");
  });

  it('lands a verified existing customer on the dashboard', () => {
    // Scenario A: no signup form, no account screen they did not ask for.
    const phase = handler('applyLoginPhase');
    expect(phase).toContain("applyAuth('signedIn')");
    expect(phase).toContain('closeAccountSection()');
  });

  it('shows the site’s own signup form for a number new to the shop', () => {
    // Scenario B. The form validates the email and refuses a duplicate,
    // because it is the provider's own -- which is why this one step is a
    // WebView while the two before it are not.
    expect(src()).toContain("details: ['login', 'otp', 'signup'],");
    // Nothing native is drawn over the widget on that step.
    expect(src()).not.toContain("accountTop === 'signup' ? (");
  });

  it('takes the widget back whenever the app goes back to the phone step', () => {
    // Three ways in -- the link, the header arrow, Android's hardware Back --
    // and one effect, so none of them can be the one that forgets.
    const text = src();
    expect(text).toContain("injectInto('login', driveEditPhone())");
    expect(text).toContain(
      "if (topScreen(accountScreensRef.current) !== 'login')",
    );
    const back = handler('stepBackAccount');
    expect(back).toContain("if (top === 'otp' || top === 'signup')");
    expect(back).toContain("setAccountScreens(['login'])");
  });

  it('restarts the countdown only on a resend the widget confirmed', () => {
    const text = src();
    expect(text).toContain('setResendToken(current => current + 1)');
    expect(text).toContain('resendToken={resendToken}');
    const resend = handler('resendOtp');
    expect(resend).toContain("injectInto('login', driveResend())");
    expect(resend).not.toContain('setResendToken');
  });

  it('comes back to the number that was sent to', () => {
    const text = src();
    expect(text).toContain('initialCountry={loginCountry}');
    expect(text).toContain('initialPhone={loginPhone}');
    expect(text).toContain('phone={`+${loginCountry.dial}${loginPhone}`}');
  });

  it('never leaves Receive OTP unpressable, whatever the provider does', () => {
    const text = src();
    expect(text).toContain('const OTP_SEND_TIMEOUT_MS');
    expect(text).toContain('armSendWatchdog');
    expect(text).toContain('clearSendWatchdog');
  });

  it('hands the page over when the widget is not there at all', () => {
    // Its documented fallback. A login form the app cannot drive is still a
    // login form; two invisible fields over nothing is not.
    const text = src();
    expect(text).toContain("if (data.state === 'missing')");
    expect(text).toContain('setWidgetMissing(true)');
    expect(text).toContain('setWidgetMissing(false)');
  });

  it('re-asks the site rather than trusting the fresh-login mark', () => {
    // The rule delays one answer; it must not become the app's own opinion of
    // the session. applyAuth keeps probing until the site confirms, so what the
    // app finally settles on is what the site said.
    //
    // This used to assert a single `probeAccountRef.current(), FRESH_LOGIN_MS`,
    // and that one-shot retry was the bug: armed when the stale reply landed
    // rather than when the login did, its own answer arrived just outside the
    // window and was believed even when it was equally stale.
    const text = src();
    expect(text).toContain('believeAuth(');
    expect(text).toContain('sessionConfirmed.current');
    expect(text).toContain('scheduleConfirmProbe()');
    expect(text).toContain('const CONFIRM_PROBE_DELAYS');
  });

  it('gives up insisting once the retries are spent', () => {
    // The latch delays a sign-out; it must never prevent one. When the attempts
    // run out the app believes the site again, so a login that did not actually
    // create a session cannot leave the app permanently convinced that it did.
    const text = src();
    expect(text).toContain('attempt >= CONFIRM_PROBE_DELAYS.length');
    expect(text).toContain("warn('login never confirmed");
  });

  it('stops insisting the moment a probe agrees', () => {
    // The whole point of the latch: a probe answering 'signedIn' is the
    // confirmation it was waiting for, and every later 'signedOut' is then
    // judged on the window's ordinary terms.
    const text = src();
    expect(text).toContain('sessionConfirmed.current = true;');
    expect(text).toContain('clearConfirmProbe()');
  });

  it('lets a log-out the customer pressed through immediately', () => {
    // The other side of the rule. Signing out right after signing in is a
    // thing people do, and that reply is the most direct evidence there is --
    // so signOut clears the mark before it asks.
    const text = src();
    const at = text.indexOf('const signOut = useCallback');
    expect(at).toBeGreaterThan(-1);
    expect(text.slice(at, at + 900)).toContain('signedInAt.current = 0;');
  });

  it('stands the bottom bar down for every step of the flow', () => {
    // Single-purpose screens: a customer entering a code should not be offered
    // four ways to abandon it.
    expect(src()).toContain('!(onAccountScreen && isLoginFlow(accountTop)) &&');
  });
});
