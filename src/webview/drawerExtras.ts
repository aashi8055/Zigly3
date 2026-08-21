/**
 * Fill out the menu drawer to match the reference app.
 *
 * Zigly's mobile drawer ships Dogs, Cats, Brands, Lifestage, Vetcare, Pharmacy,
 * Grooming and Sale. Their app additionally shows Login/Register at the top and
 * Store Locator, Blogs and About Us below.
 *
 * None of that is invented here:
 *   Login/Register -> /account, the same real route the Account tab uses; it
 *                     shows the account page when signed in and Zigly's own
 *                     login when signed out.
 *   Blogs, Store   -> cloned from the site's own utility bar, where they exist
 *   Locator           in the DOM but carry `hide-mobile` so phones never see
 *                     them.
 *   About Us       -> cloned from the site's own footer link.
 *
 * Cloning rather than hardcoding means the destinations stay correct if Zigly
 * moves them, and anything they remove simply stops appearing.
 */
export const DRAWER_EXTRAS_SCRIPT = `
(function () {
  var MARK = 'zigly-drawer-extra';

  function warn(msg) {
    if (window.console && console.warn) { console.warn('[ZiglyWebView] ' + msg); }
  }

  function squash(str) {
    var out = '';
    var prevWs = true;
    for (var k = 0; k < str.length; k++) {
      var c = str.charCodeAt(k);
      var isWs = (c === 32 || c === 9 || c === 10 || c === 13);
      if (isWs) { if (!prevWs) { out += ' '; prevWs = true; } }
      else { out += str.charAt(k); prevWs = false; }
    }
    while (out.length && out.charAt(out.length - 1) === ' ') { out = out.slice(0, -1); }
    return out;
  }

  /** Build a drawer row styled like the ones already in the list. */
  function row(list, href, label) {
    var sampleLink = list.querySelector('a.menu-drawer__menu-item')
                  || list.querySelector('a');
    var li = document.createElement('li');
    li.className = MARK;
    var a = document.createElement('a');
    a.setAttribute('href', href);
    a.className = sampleLink
      ? sampleLink.className
      : 'menu-drawer__menu-item link link--text list-menu__item focus-inset';
    a.textContent = label;
    li.appendChild(a);
    return li;
  }

  /** Find a real link on the page by the text it shows. */
  function findLink(text) {
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      if (squash(links[i].textContent || '') === text) {
        var href = links[i].getAttribute('href') || '';
        if (href && href.indexOf('javascript:') !== 0) { return href; }
      }
    }
    return null;
  }

  function fill() {
    var list = document.querySelector('.menu-drawer__menu.list-menu')
            || document.querySelector('.menu-drawer__menu');
    if (!list) { return false; }
    if (list.querySelector('.' + MARK)) { return true; }

    // Login/Register sits above the categories, as in the reference app.
    // /account is Zigly's own route and handles both signed-in and signed-out.
    if (!findLinkInList(list, '/account')) {
      list.insertBefore(row(list, '/account', 'Login/Register'), list.firstChild);
    }

    // Everything else is taken from links the site already publishes.
    var extras = [
      {text: 'Store Locator'},
      {text: 'Blogs'},
      {text: 'About Us'}
    ];
    for (var i = 0; i < extras.length; i++) {
      var href = findLink(extras[i].text);
      if (!href) { continue; }
      if (findLinkInList(list, href)) { continue; }
      list.appendChild(row(list, href, extras[i].text));
    }
    return true;
  }

  function findLinkInList(list, hrefPart) {
    var links = list.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      if ((links[i].getAttribute('href') || '').indexOf(hrefPart) !== -1) {
        return true;
      }
    }
    return false;
  }

  try {
    if (!fill()) {
      var tries = 0;
      var timer = setInterval(function () {
        tries++;
        if (fill() || tries > 10) { clearInterval(timer); }
      }, 400);
    }
  } catch (e) {
    warn('drawer extras failed: ' + e);
  }
})();
true;
`;
