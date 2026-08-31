/**
 * The OTP driver, RUN rather than read.
 *
 * ./otpDriver.test.ts pins what the payload targets and what it refuses to do,
 * by assertion on the payload text. That is the right shape for "never calls
 * the provider's API" -- a property of the source -- and the wrong shape for
 * the three faults reported against zigly-otpfix-v15.apk, every one of which is
 * a matter of WHEN the driver reads the widget rather than what it looks for:
 *
 *   1. no OTP unless the country is picked again, because the widget's country
 *      is unreadable until something has been clicked;
 *   2. "OTP is not correct" shown on a code that was accepted, because the
 *      widget leaves the previous attempt's error in the page;
 *   3. the account screen bouncing back to login, because the probe reads a
 *      cookie jar that has not caught up.
 *
 * A string assertion cannot tell those from their fixes: the selectors were
 * always right. So this file executes the real payloads against a widget built
 * to behave the way SimplyOTP's does at each of those moments, and asserts on
 * what the driver POSTS and CLICKS.
 *
 * The DOM is hand-built rather than jsdom's, following ./facetBridge.test.ts:
 * the React Native jest preset runs in node, and what these payloads need is
 * small -- querySelector over classes and attributes, a class list, and a click
 * that runs listeners.
 */
import {
  driveSendOtp,
  driveSubmitOtp,
} from '../src/webview/otpDriver';

/** One element. Enough of the DOM for the payloads, and no more. */
class El {
  tag: string;
  classes: string[];
  attrs: Record<string, string>;
  children: El[] = [];
  parentNode: El | null = null;
  text = '';
  value = '';
  clicks = 0;
  listeners: Record<string, Array<() => void>> = {};

  constructor(tag: string, classes = '', attrs: Record<string, string> = {}) {
    this.tag = tag.toUpperCase();
    this.classes = classes.split(' ').filter(Boolean);
    this.attrs = attrs;
  }

  get tagName() {
    return this.tag;
  }

  add(...kids: El[]) {
    kids.forEach(kid => {
      kid.parentNode = this;
      this.children.push(kid);
    });
    return this;
  }

  remove(kid: El) {
    const at = this.children.indexOf(kid);
    if (at !== -1) {
      this.children.splice(at, 1);
      kid.parentNode = null;
    }
  }

  removeChild(kid: El) {
    this.remove(kid);
  }

  get classList() {
    return {
      contains: (name: string) => this.classes.indexOf(name) !== -1,
      add: (name: string) => {
        if (this.classes.indexOf(name) === -1) {
          this.classes.push(name);
        }
      },
      remove: (name: string) => {
        const at = this.classes.indexOf(name);
        if (at !== -1) {
          this.classes.splice(at, 1);
        }
      },
    };
  }

  getAttribute(name: string) {
    return Object.prototype.hasOwnProperty.call(this.attrs, name)
      ? this.attrs[name]
      : null;
  }

  setAttribute(name: string, value: string) {
    this.attrs[name] = value;
  }

  get textContent(): string {
    return this.text + this.children.map(kid => kid.textContent).join('');
  }

  addEventListener(type: string, fn: () => void) {
    (this.listeners[type] = this.listeners[type] || []).push(fn);
  }

  dispatchEvent(ev: {type: string}) {
    // eslint-disable-next-line consistent-this
    let node: El | null = this;
    while (node) {
      (node.listeners[ev.type] || []).forEach(fn => fn.call(node));
      node = node.parentNode;
    }
    return true;
  }

  focus() {}

  click() {
    this.clicks++;
    this.dispatchEvent({type: 'click'});
  }

  closest(selector: string): El | null {
    // eslint-disable-next-line consistent-this
    let node: El | null = this;
    while (node) {
      if (node.matches(selector)) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  /** One simple selector: a tag, .class chain and one [attr=value] at most. */
  matches(selector: string): boolean {
    return selector
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .some(part => this.matchesOne(part));
  }

  private matchesOne(selector: string): boolean {
    // Only the last step of a descendant selector is matched here; the walk in
    // querySelectorAll handles the ancestry.
    const step = selector.trim().split(' ').filter(Boolean).pop() || '';
    let rest = step;

    // [attr='value'] or [attr]
    const open = rest.indexOf('[');
    if (open !== -1) {
      const close = rest.indexOf(']', open);
      const inner = rest.slice(open + 1, close);
      rest = rest.slice(0, open) + rest.slice(close + 1);
      const eq = inner.indexOf('=');
      if (eq === -1) {
        if (this.getAttribute(inner) === null) {
          return false;
        }
      } else {
        const name = inner.slice(0, eq);
        const want = inner.slice(eq + 1).replace(/^['"]|['"]$/g, '');
        const got = this.getAttribute(name);
        if (name.endsWith('*')) {
          if (got === null || got.indexOf(want) === -1) {
            return false;
          }
        } else if (got !== want) {
          return false;
        }
      }
    }

    // :not(.class)
    const not = rest.indexOf(':not(');
    if (not !== -1) {
      const close = rest.indexOf(')', not);
      const inner = rest.slice(not + 5, close).replace('.', '');
      rest = rest.slice(0, not) + rest.slice(close + 1);
      if (this.classes.indexOf(inner) !== -1) {
        return false;
      }
    }

    // class[*='...'] style wildcard on class, used by the error selectors.
    if (rest.indexOf("[class*=") !== -1) {
      return true;
    }

    const parts = rest.split('.');
    const tag = parts.shift() || '';
    if (tag && tag !== '*' && tag.toUpperCase() !== this.tag) {
      return false;
    }
    return parts.every(cls => !cls || this.classes.indexOf(cls) !== -1);
  }

  private descendants(): El[] {
    const out: El[] = [];
    this.children.forEach(kid => {
      out.push(kid, ...kid.descendants());
    });
    return out;
  }

  querySelectorAll(selector: string): El[] {
    const wants = selector
      .split(',')
      .map(part => part.trim())
      .filter(Boolean);
    return this.descendants().filter(node =>
      wants.some(want => {
        const steps = want.split(' ').filter(Boolean);
        if (!node.matchesOne(steps[steps.length - 1])) {
          return false;
        }
        // Walk the ancestry for each earlier step, right to left.
        let cursor: El | null = node.parentNode;
        for (let i = steps.length - 2; i >= 0; i--) {
          let found = false;
          while (cursor) {
            if (cursor.matchesOne(steps[i])) {
              found = true;
              cursor = cursor.parentNode;
              break;
            }
            cursor = cursor.parentNode;
          }
          if (!found) {
            return false;
          }
        }
        return true;
      }),
    );
  }

  querySelector(selector: string): El | null {
    return this.querySelectorAll(selector)[0] || null;
  }
}

type Posted = {tag: string; [key: string]: unknown};

/**
 * A widget on its phone step, built the way SimplyOTP builds one.
 *
 * `interacted` is the whole point of the first test: until a row is clicked the
 * widget has written no 'data-selected-country' and has not built its country
 * list at all, so every marker the driver could read is genuinely absent.
 */
const phoneWidget = (options: {interacted?: boolean; dialText?: string} = {}) => {
  const body = new El('body');
  const box = new El('div', 'login-box');
  const cell = new El('div', 'country-selector-main');
  if (options.dialText !== undefined) {
    cell.text = options.dialText;
  }
  const active = new El('div', 'input-box-content active');
  const input = new El('input', 'olInput user-name-input');
  active.add(input);
  const send = new El('button', 'send-btn');
  box.add(cell, active, send);
  body.add(box);

  /** The list the widget builds only when its cell is tapped. */
  const buildList = () => {
    if (body.querySelector('.country-selector-list')) {
      return;
    }
    const list = new El('ul', 'country-selector-list');
    ['af', 'in', 'gb'].forEach(code => {
      list.add(
        new El('li', '', {'data-country-code': code, 'data-dial-code': '91'}),
      );
    });
    body.add(list);
  };
  cell.addEventListener('click', buildList);

  if (options.interacted) {
    buildList();
    body.setAttribute('data-selected-country', 'in');
  }

  return {body, input, send, cell};
};

/** Run a payload against a fake window/document, collecting what it posts. */
const runner = (body: El) => {
  const posted: Posted[] = [];
  const timers: Array<{fn: () => void; at: number}> = [];
  let now = 0;

  const document = {
    body,
    querySelector: (s: string) => (body.matches(s) ? body : body.querySelector(s)),
    querySelectorAll: (s: string) => {
      const found = body.querySelectorAll(s);
      return body.matches(s) ? [body, ...found] : found;
    },
    addEventListener: () => {},
    createEvent: () => ({initEvent: () => {}}),
  };

  const window: Record<string, unknown> = {
    ReactNativeWebView: {
      postMessage: (raw: string) => posted.push(JSON.parse(raw) as Posted),
    },
    // Off: these tests drive the sweeps explicitly, so nothing fires twice for
    // reasons the assertions cannot see.
    MutationObserver: undefined,
  };

  const run = (script: string) => {
    // eslint-disable-next-line no-new-func
    new Function(
      'window',
      'document',
      'setTimeout',
      'Event',
      'KeyboardEvent',
      script,
    )(
      window,
      document,
      (fn: () => void, ms: number) => {
        timers.push({fn, at: now + (ms || 0)});
        return timers.length;
      },
      function Ev(this: {type: string}, type: string) {
        this.type = type;
      },
      undefined,
    );
  };

  /** Run every timer due within `ms`, in order, as the page would. */
  const advance = (ms: number) => {
    const until = now + ms;
    for (let guard = 0; guard < 500; guard++) {
      timers.sort((a, b) => a.at - b.at);
      const next = timers[0];
      if (!next || next.at > until) {
        break;
      }
      timers.shift();
      now = next.at;
      next.fn();
    }
    now = until;
  };

  return {posted, run, advance, core: () => window.__ziglyOtp as Record<string, Function>};
};

describe('issue 1: sending without the country being picked again', () => {
  it('sends on a widget nobody has touched, without re-picking the country', () => {
    // The reported fault. Before any interaction SimplyOTP has written no
    // 'data-selected-country' and has not built '.country-selector-list' at
    // all, so every marker the driver reads is absent -- and reading that as
    // "wrong country" is what sent it off to click a row that was already
    // selected, whose send the provider then refused.
    const {body, input, send, cell} = phoneWidget({dialText: '+91'});
    const {posted, run, advance} = runner(body);

    run(driveSendOtp('91', '9004976917', 'IN'));
    advance(2000);

    // The number reached the field the widget actually reads, and the widget's
    // own Send was pressed.
    expect(input.value).toBe('9004976917');
    expect(send.clicks).toBe(1);
    expect(posted.some(p => p.tag === 'otp-sent' && p.step === 'phone')).toBe(true);
    // And nothing re-opened the country list to do it.
    expect(cell.clicks).toBe(0);
    expect(posted.some(p => p.tag === 'otp-error')).toBe(false);
  });

  it('still sends once the country HAS been picked, which already worked', () => {
    // The path that worked in v15 -- the customer tapping the country first --
    // must keep working: this fix adds a fallback, it does not replace the read.
    const {body, send, cell} = phoneWidget({interacted: true});
    const {posted, run, advance} = runner(body);

    run(driveSendOtp('91', '9004976917', 'IN'));
    advance(2000);

    expect(send.clicks).toBe(1);
    expect(cell.clicks).toBe(0);
    expect(posted.some(p => p.tag === 'otp-error')).toBe(false);
  });

  it('refuses a country the widget is genuinely not set to', () => {
    // The rule at the top of otpDriver.ts, and the thing the fallback must not
    // cost: a cell showing +91 is not evidence for a send to +44, so this one
    // goes to the list -- and reports when the row is not there.
    const {body, send} = phoneWidget({dialText: '+91'});
    const {posted, run, advance} = runner(body);

    run(driveSendOtp('33', '612345678', 'FR'));
    advance(6000);

    expect(send.clicks).toBe(0);
    const failed = posted.find(p => p.tag === 'otp-error');
    expect(failed?.why).toBe('country not found in the list');
  });
});

describe('issue 2: the red line on a code that was accepted', () => {
  /** A widget on its verify step, with an error left over from last time. */
  const verifyWidget = (stale: string) => {
    const body = new El('body');
    const login = new El('div', 'login-box hideBox');
    // The phone step's own error span, left in the page by the widget after an
    // earlier bad attempt. Un-hidden, because SimplyOTP does not clear it.
    login.add(new El('span', 'errormessage', {}));
    const span = login.querySelector('.errormessage') as El;
    span.text = stale;

    const verify = new El('div', 'verify-box');
    for (let i = 0; i < 6; i++) {
      verify.add(new El('input', 'otp-input-box'));
    }
    verify.add(new El('button', 'verify-btn'));
    body.add(login, verify);
    return {body, login, verify, span};
  };

  it('does not report the previous attempt’s error as this one’s verdict', () => {
    // The reported fault, in the sequence that produced it. A CORRECT code
    // makes the widget tear its verify step down before the session lands:
    // '.verify-box' goes and '.login-box' is briefly unhidden as it resets --
    // which puts the stale phone-step error back on screen, and the sweep that
    // the re-render triggers posted it as the verdict on a code that had just
    // been accepted.
    const {body, login, verify} = verifyWidget('OTP is not correct');
    const {posted, run, advance, core} = runner(body);

    run(driveSubmitOtp('123456'));
    advance(2000);
    const afterSubmit = posted.filter(p => p.tag === 'otp-error').length;

    // The widget now unwinds towards a session, exactly as it does on success:
    // the verify step is torn down and the login box is unhidden as it resets,
    // which is the re-render that used to post the leftover span.
    body.remove(verify);
    login.classList.remove('hideBox');
    core().sweep();
    advance(2000);

    // No verdict was invented from the leftover span.
    const errors = posted.filter(p => p.tag === 'otp-error');
    expect(errors.length).toBe(afterSubmit);
    expect(errors.some(e => e.message === 'OTP is not correct')).toBe(false);
  });

  it('still reports a genuinely new error on the step that was asked', () => {
    // The guard can only ever delay, never swallow: a wrong code leaves the
    // widget on its verify step and its complaint there IS the answer.
    const {body, verify} = verifyWidget('');
    const {posted, run, advance, core} = runner(body);

    run(driveSubmitOtp('000000'));
    advance(2000);

    // The widget now says the code was wrong, on the step it was asked on.
    const said = new El('span', 'errormessage');
    said.text = 'OTP is not correct';
    verify.add(said);
    core().sweep();

    const errors = posted.filter(p => p.tag === 'otp-error');
    expect(errors[errors.length - 1]?.message).toBe('OTP is not correct');
    expect(errors[errors.length - 1]?.step).toBe('otp');
  });

  it('reports a refused send, which arrives on the step after the one asked', () => {
    // The toast is the only channel a refused send has, and the widget has
    // already moved to its code screen by the time it appears -- so the phase
    // guard must not discard it. This is the "no OTP and no error" case.
    const {body} = phoneWidget({dialText: '+91'});
    const {posted, run, advance, core} = runner(body);

    run(driveSendOtp('91', '9004976917', 'IN'));
    advance(2000);

    // The widget moves to its verify step and toasts the refusal.
    (body.querySelector('.login-box') as El).classList.add('hideBox');
    body.add(new El('div', 'verify-box'));
    const toast = new El('div', 'toast-card error');
    toast.text = 'Invalid request';
    body.add(toast);
    core().sweep();

    const errors = posted.filter(p => p.tag === 'otp-error');
    expect(errors[errors.length - 1]?.message).toBe('Invalid request');
  });
});

describe('issue 2b: a stale toast on a code that was accepted', () => {
  it('does not report a leftover toast as the verdict on a correct code', () => {
    // Same ending as the span case above, through the OTHER channel. A send
    // the provider refused earlier leaves '.toast-card.error' in the page, and
    // the widget takes its own toasts down on a timer rather than at submit.
    // So a customer who is toasted once -- a rate limit, a retried send --
    // and then enters the CORRECT code has that toast still in the document at
    // the moment the widget unwinds towards a session.
    const body = new El('body');
    const login = new El('div', 'login-box hideBox');
    const verify = new El('div', 'verify-box');
    for (let i = 0; i < 6; i++) {
      verify.add(new El('input', 'otp-input-box'));
    }
    verify.add(new El('button', 'verify-btn'));
    const toast = new El('div', 'toast-card error');
    toast.text = 'Please wait before requesting another code';
    body.add(login, verify, toast);

    const {posted, run, advance, core} = runner(body);

    run(driveSubmitOtp('123456'));
    advance(2000);
    const afterSubmit = posted.filter(p => p.tag === 'otp-error').length;

    // The correct code is accepted: the widget tears the verify step down and
    // unhides its login box as it resets, on its way to a session.
    body.remove(verify);
    login.classList.remove('hideBox');
    core().sweep();
    advance(2000);

    const errors = posted.filter(p => p.tag === 'otp-error');
    expect(errors.length).toBe(afterSubmit);
  });

  it('does not report a toast that appears while the widget unwinds', () => {
    // The gap the test above does not reach. ZO.mute records whatever the
    // widget is saying AT THE CLICK, so a toast already on screen is covered.
    // A toast that arrives AFTER the click is, by that measure, news -- and a
    // correct code is exactly when the widget is busiest: it tears the verify
    // step down, resets, and any toast it raises in that window (a resend the
    // customer pressed just before, a rate limit answering late) differs from
    // what mute recorded and posts as the verdict on an accepted code.
    const body = new El('body');
    const login = new El('div', 'login-box hideBox');
    const verify = new El('div', 'verify-box');
    for (let i = 0; i < 6; i++) {
      verify.add(new El('input', 'otp-input-box'));
    }
    verify.add(new El('button', 'verify-btn'));
    body.add(login, verify);

    const {posted, run, advance, core} = runner(body);

    run(driveSubmitOtp('123456'));
    advance(2000);
    const afterSubmit = posted.filter(p => p.tag === 'otp-error').length;

    // The code was correct. The widget unwinds, and a late toast lands.
    body.remove(verify);
    login.classList.remove('hideBox');
    const toast = new El('div', 'toast-card error');
    toast.text = 'Please wait before requesting another code';
    body.add(toast);
    core().sweep();
    advance(2000);

    const errors = posted.filter(p => p.tag === 'otp-error');
    expect(errors.length).toBe(afterSubmit);
  });
});
