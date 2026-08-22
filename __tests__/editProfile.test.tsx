/**
 * Edit Profile.
 *
 * The screen is easy; what these tests defend is the part that is easy to get
 * wrong later. Save keeps a device-local overlay, because Shopify's classic
 * customer accounts expose no endpoint that changes a customer's name or email
 * -- so the tests pin that no request is made, that the screen says as much on
 * screen rather than only in a comment, and that the overlay behaves like an
 * overlay: it never erases what the site actually rendered.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text, TextInput} from 'react-native';
import EditProfileScreen from '../src/components/EditProfileScreen';
import {
  applyProfileEdits,
  editsFromCustomer,
  joinName,
  parseCustomer,
  splitName,
} from '../src/account/accountData';

const noop = () => {};

const render = (node: React.ReactElement) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(node);
  });
  return tree;
};

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

const LUX = parseCustomer({
  name: 'Lux Bhati',
  email: 'friendszone0071@gmail.com',
  phone: '+917668319718',
});

describe('splitting and rejoining a name', () => {
  it('splits on the first space, so a middle name is not lost', () => {
    expect(splitName('Lux Kumar Bhati')).toEqual({
      firstName: 'Lux',
      lastName: 'Kumar Bhati',
    });
  });

  it('rejoins to exactly what arrived', () => {
    for (const name of ['Lux Bhati', 'Lux', 'Lux Kumar Bhati']) {
      const {firstName, lastName} = splitName(name);
      expect(joinName(firstName, lastName)).toBe(name);
    }
  });

  it('handles one word, and nothing at all', () => {
    expect(splitName('Lux')).toEqual({firstName: 'Lux', lastName: ''});
    expect(splitName('')).toEqual({firstName: '', lastName: ''});
    expect(splitName('   ')).toEqual({firstName: '', lastName: ''});
  });

  it('leaves no stray space when the last name is empty', () => {
    expect(joinName('Lux', '')).toBe('Lux');
    expect(joinName('', '')).toBe('');
    expect(joinName('  Lux  ', '  Bhati ')).toBe('Lux Bhati');
  });
});

describe('the edit is an overlay, not a replacement', () => {
  it('shows the edited name and email', () => {
    const shown = applyProfileEdits(LUX, {
      firstName: 'Luxman',
      lastName: 'Bhati',
      email: 'lux@zigly.com',
    });
    expect(shown.name).toBe('Luxman Bhati');
    expect(shown.email).toBe('lux@zigly.com');
  });

  it('re-derives the initials, so the avatar follows the name', () => {
    const shown = applyProfileEdits(LUX, {
      firstName: 'Aarav',
      lastName: 'Singh',
      email: '',
    });
    expect(shown.initials).toBe('AS');
  });

  it('never overlays the phone', () => {
    // It comes from the OTP login and is the one authoritative field; the form
    // does not offer it, and a typed-over number is one nobody answers.
    const shown = applyProfileEdits(LUX, {
      firstName: 'Aarav',
      lastName: 'Singh',
      email: 'a@b.com',
    });
    expect(shown.phone).toBe(LUX.phone);
  });

  it('falls back to what the site rendered when a field is cleared', () => {
    // Clearing the box should not hide a real email; it should stop overriding.
    const shown = applyProfileEdits(LUX, {
      firstName: '',
      lastName: '',
      email: '   ',
    });
    expect(shown.name).toBe(LUX.name);
    expect(shown.email).toBe(LUX.email);
  });

  it('returns the same object when nothing actually changed', () => {
    // Identity matters: the account probe re-runs, and a fresh object each time
    // would re-render the account screen and the drawer for no reason.
    expect(applyProfileEdits(LUX, editsFromCustomer(LUX))).toBe(LUX);
    expect(applyProfileEdits(LUX, null)).toBe(LUX);
  });
});

describe('the form', () => {
  it('opens with the values the app already has', () => {
    const inputs = render(
      <EditProfileScreen customer={LUX} onSave={noop} />,
    ).root.findAllByType(TextInput);
    expect(inputs.map(input => input.props.value)).toEqual([
      'Lux',
      'Bhati',
      'friendszone0071@gmail.com',
    ]);
  });

  it('shows the phone, but not as a field', () => {
    const tree = render(<EditProfileScreen customer={LUX} onSave={noop} />);
    expect(tree.root.findAllByType(TextInput)).toHaveLength(3);
    expect(textOf(tree)).toContain('+917668319718');
  });

  it('hands the edits back on Save', () => {
    let saved: unknown = null;
    const tree = render(
      <EditProfileScreen customer={LUX} onSave={edits => (saved = edits)} />,
    );
    const [first] = tree.root.findAllByType(TextInput);
    ReactTestRenderer.act(() => first.props.onChangeText('Luxman'));

    // The outermost match is the Pressable itself; the inner ones are its host
    // views, whose onPress is React Native's own and expects an event.
    const [save] = tree.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Save profile' &&
        typeof node.props.onPress === 'function',
    );
    ReactTestRenderer.act(() => save.props.onPress());

    expect(saved).toEqual({
      firstName: 'Luxman',
      lastName: 'Bhati',
      email: 'friendszone0071@gmail.com',
    });
  });

  it('says on screen that the change does not reach Zigly', () => {
    // The customer is about to change something that will not follow them to
    // the website, their orders or their invoices. A comment is not enough.
    const text = textOf(render(<EditProfileScreen customer={LUX} onSave={noop} />));
    expect(text).toContain('device only');
    expect(text).toContain('will not update your account');
  });

  it('sends nothing anywhere', () => {
    // There is no endpoint to send it to; the day there is, this test is the
    // one that should be updated deliberately rather than quietly.
    const src = require('fs').readFileSync(
      'src/components/EditProfileScreen.tsx',
      'utf8',
    );
    expect(src).not.toContain('fetch(');
    expect(src).not.toContain('injectJavaScript');
  });
});
