/**
 * The brief message at the foot of the screen, and the one thing it is used for.
 *
 * The delete notice is the reason this exists: by the time it shows, signing out
 * has replaced the account screen with the login screen, so a notice rendered
 * inside the account section would be unmounted before anybody read it.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text} from 'react-native';
import MessageToast from '../src/components/MessageToast';

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
    .map(node => String(node.props.children ?? ''))
    .join(' | ');

describe('the message toast', () => {
  it('draws nothing when there is nothing to say', () => {
    const tree = render(<MessageToast message={null} onHidden={noop} />);
    expect(tree.root.findAllByType(Text)).toHaveLength(0);
  });

  it('shows the message it is given', () => {
    const tree = render(
      <MessageToast message="Deleted user" onHidden={noop} />,
    );
    expect(textOf(tree)).toContain('Deleted user');
  });

  it('announces itself, being the only confirmation the action gives', () => {
    const tree = render(<MessageToast message="Deleted user" onHidden={noop} />);
    const announced = tree.root.findAll(
      node => node.props.accessibilityLiveRegion === 'polite',
    );
    expect(announced.length).toBeGreaterThan(0);
  });
});

describe('Delete Account', () => {
  const src = () =>
    require('fs').readFileSync('src/screens/ZiglyWebViewScreen.tsx', 'utf8');

  it('signs out and says so through the toast, not the account notice', () => {
    // signOut clears accountNotice, and the account section is about to close
    // on the site's reply -- so the notice has to be drawn outside the section
    // or it is never seen.
    // Anchored on the account handler: there is an address delete in this file
    // too, and it confirms with the same word.
    const s = src();
    const at = s.indexOf('const requestAccountDeletion');
    expect(at).toBeGreaterThan(-1);
    const handler = s.slice(at, at + 1400);
    expect(handler).toContain("signOut('delete')");
    expect(handler).not.toContain('setAccountNotice');
    // The words are in one table with both reasons, so the two endings cannot
    // drift apart: this one is the app saying data is gone that is not.
    expect(s).toContain("delete: 'Deleted user data'");
  });

  it('confirms first, and offers the way to have it really done', () => {
    const s = src();
    const at = s.indexOf('const requestAccountDeletion');
    const handler = s.slice(at, at + 1400);
    expect(handler).toContain("{text: 'Cancel', style: 'cancel'}");
    expect(handler).toContain("text: 'Open contact form'");
  });

  it('records that nothing is actually deleted', () => {
    // This is the one screen in the app that tells a customer something untrue
    // about their own data. It was asked for, with the consequence spelled out,
    // and it must not become folklore that it works.
    const s = src();
    const at = s.indexOf('READ THIS BEFORE THIS BUILD GOES TO ANY REAL CUSTOMER');
    expect(at).toBeGreaterThan(-1);
    expect(s.slice(at, at + 900)).toContain('Nothing');
  });
});
