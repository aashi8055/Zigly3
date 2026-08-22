/**
 * Read the menu drawer out of the page, so the app can draw it natively.
 *
 * The site's own drawer is a Dawn `menu-drawer`: a `<ul class="menu-drawer__menu">`
 * whose branches are `<li><details><summary>Label</summary><div
 * class="menu-drawer__submenu"><ul>...</ul></div></details></li>` and whose
 * leaves are plain `<li><a href>`. Verified against the live header section on
 * 2026-08-22: the top level is Dogs, Cats, Brands, Lifestage, Vetcare,
 * Pharmacy, Grooming and Sale, three levels deep under Dogs and Cats, with a
 * `menu-drawer__utility-links` block of support contacts below it.
 *
 * Nothing about that tree is written here. This walks whatever the page has
 * and reports it, which is the rule the rest of the app follows: the site owns
 * the data, the app owns the view. A category Zigly adds tomorrow appears
 * without a release; one they remove stops appearing.
 *
 * The rows ./drawerExtras.ts appends -- Store Locator, Blogs, About Us -- are
 * in that same list by the time this runs, so they arrive here too rather than
 * having to be listed a second time.
 *
 * Why the DOM rather than the Section Rendering API: the drawer is already
 * parsed and in memory on every page, its `<img>` icons and the accent colour
 * on Sale are resolved, and the extra rows have been merged in. A second HTTP
 * fetch would have none of that.
 */

/** Depth guard. The real menu is three levels; this is a bound, not a target. */
export const MENU_MAX_DEPTH = 4;

/** Row guard, generous enough for the whole tree with room to spare. */
export const MENU_MAX_ROWS = 400;

/**
 * Defines `window.__ziglyReadMenu` once, then calls it.
 *
 * Deliberately re-runnable rather than one-shot: it is injected when the
 * dashboard settles *and* on every tap of the hamburger, so a drawer that was
 * still being filled in at the first read is right by the second.
 */
export const READ_MENU_SCRIPT = `
(function () {
  if (!window.__ziglyReadMenu) {
    window.__ziglyReadMenu = function () {
      var MAX_DEPTH = ${MENU_MAX_DEPTH};
      var MAX_ROWS = ${MENU_MAX_ROWS};
      var seq = 0;

      function squash(str) {
        var out = '';
        var prevWs = true;
        for (var k = 0; k < str.length; k++) {
          var c = str.charCodeAt(k);
          var isWs = (c === 32 || c === 9 || c === 10 || c === 13);
          if (isWs) { if (!prevWs) { out += ' '; prevWs = true; } }
          else { out += str.charAt(k); prevWs = false; }
        }
        while (out.length && out.charAt(out.length - 1) === ' ') {
          out = out.slice(0, -1);
        }
        return out;
      }

      function childTag(el, tag) {
        var kids = el.children;
        for (var i = 0; i < kids.length; i++) {
          if ((kids[i].tagName || '').toLowerCase() === tag) { return kids[i]; }
        }
        return null;
      }

      /**
       * The row's own label.
       *
       * Text nodes and inline spans only. The caret is an inline <svg> inside a
       * .svg-wrapper span, the category icon is an <img>, and a nested <ul> is
       * the submenu -- none of those is this row's text, and textContent on the
       * whole element would fold an entire branch into one label.
       */
      function labelOf(el) {
        var out = '';
        var kids = el.childNodes;
        for (var i = 0; i < kids.length; i++) {
          var n = kids[i];
          if (n.nodeType === 3) { out += n.nodeValue || ''; continue; }
          if (n.nodeType !== 1) { continue; }
          var tag = (n.tagName || '').toLowerCase();
          if (tag === 'svg' || tag === 'img' || tag === 'ul') { continue; }
          var cls = String(n.getAttribute('class') || '');
          if (cls.indexOf('svg-wrapper') !== -1) { continue; }
          out += n.textContent || '';
        }
        return squash(out);
      }

      /** The icon Zigly puts in the menu title, when it put one there. */
      function iconOf(el) {
        var img = el.querySelector('img[src]');
        return img ? img.getAttribute('src') : null;
      }

      /**
       * The colour the site paints this row.
       *
       * Sale carries <span class="menu-sale">, which the theme's own CSS turns
       * red. What is reported is the span's colour only when it differs from
       * the row's own -- which is the difference between "the site picked this
       * row out" and "this row is the same ink as every other one". Read that
       * way, any row Zigly decides to highlight arrives highlighted, in
       * whatever shade they chose, and no ordinary row is repainted.
       */
      function colorOf(el) {
        var span = null;
        var kids = el.children;
        for (var i = 0; i < kids.length; i++) {
          var cls = String(kids[i].getAttribute('class') || '');
          if (!cls || cls.indexOf('svg-wrapper') !== -1) { continue; }
          span = kids[i];
          break;
        }
        if (!span || !window.getComputedStyle) { return null; }
        try {
          var own = window.getComputedStyle(el).color;
          var mine = window.getComputedStyle(span).color;
          return mine && mine !== own ? mine : null;
        } catch (e) {
          return null;
        }
      }

      function make(el, href) {
        seq++;
        return {
          id: 'm' + seq,
          label: labelOf(el),
          href: href,
          icon: iconOf(el),
          color: colorOf(el),
          children: []
        };
      }

      function walk(list, depth, state) {
        var nodes = [];
        if (!list || depth > MAX_DEPTH) { return nodes; }
        var kids = list.children;
        for (var i = 0; i < kids.length; i++) {
          if (state.count >= MAX_ROWS) { break; }
          var li = kids[i];
          if ((li.tagName || '').toLowerCase() !== 'li') { continue; }
          var node = null;
          var det = childTag(li, 'details');
          if (det) {
            var sum = childTag(det, 'summary');
            if (!sum) { continue; }
            node = make(sum, null);
            var sub = det.querySelector('.menu-drawer__submenu');
            node.children = walk(
              sub ? sub.querySelector('ul') : null,
              depth + 1,
              state
            );
          } else {
            var a = childTag(li, 'a');
            if (!a) { a = li.querySelector('a[href]'); }
            if (!a) { continue; }
            node = make(a, a.getAttribute('href') || '');
          }
          if (!node.label) { continue; }
          state.count++;
          nodes.push(node);
        }
        return nodes;
      }

      /**
       * The support block under the list. Zigly publishes a phone number, an
       * email address and a WhatsApp link there; the reference app shows them
       * behind a Customer Support row, and a group of leaves is exactly that.
       */
      function support() {
        var box = document.querySelector('.menu-drawer__utility-links');
        if (!box) { return null; }
        var head = box.querySelector('h2, h3');
        var title = head ? squash(head.textContent || '') : 'Customer Support';
        while (title.length && title.charAt(title.length - 1) === ':') {
          title = title.slice(0, -1);
        }
        var links = box.querySelectorAll('a[href]');
        var kids = [];
        for (var i = 0; i < links.length && kids.length < 8; i++) {
          var label = squash(links[i].textContent || '');
          var href = links[i].getAttribute('href') || '';
          if (!label || !href) { continue; }
          kids.push({
            id: 'support' + i,
            label: label,
            href: href,
            icon: null,
            color: null,
            children: []
          });
        }
        if (!kids.length || !title) { return null; }
        return {
          id: 'support',
          label: title,
          href: null,
          icon: null,
          color: null,
          children: kids
        };
      }

      try {
        var list =
          document.querySelector('.menu-drawer__navigation ul.menu-drawer__menu')
          || document.querySelector('ul.menu-drawer__menu');
        var state = {count: 0};
        var items = walk(list, 0, state);
        var extra = support();
        if (extra) { items.push(extra); }
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            tag: 'menu',
            found: !!list,
            items: items
          }));
        }
      } catch (e) {
        if (window.console && console.warn) {
          console.warn('[ZiglyWebView] menu read failed: ' + e);
        }
      }
    };
  }
  window.__ziglyReadMenu();
})();
true;
`;
