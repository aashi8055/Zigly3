/**
 * Temporary on-screen runtime diagnostic. __DEV__ builds only.
 *
 * The mobile search bar is created by SearchTap after first paint, so it cannot
 * be inspected in the served HTML, and USB debugging is unavailable on the test
 * device -- so there is no way to read logs from it. This paints the findings
 * directly onto the page instead, to be screenshotted.
 *
 * It samples at load, +3s, +8s and +15s and reports, for each candidate host of
 * the search bar: whether the node exists, and its computed display /
 * visibility / opacity / transform / height. That distinguishes "removed from
 * the DOM" from "hidden by CSS" from "translated off-screen" from "collapsed",
 * each of which needs a different fix.
 *
 * Delete this file once the behaviour is understood.
 */
export const SEARCH_DIAGNOSTIC = `
(function () {
  var PANEL_ID = 'zigly-diag-panel';
  if (document.getElementById(PANEL_ID)) { return; }

  var panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.setAttribute('style', [
    'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:2147483647',
    'max-height:46vh', 'overflow:auto', 'background:rgba(10,16,26,0.95)',
    'color:#9BE7C4', 'font:11px/1.45 monospace', 'padding:8px 10px',
    'white-space:pre-wrap', 'border-top:2px solid #ED2427'
  ].join(';'));
  document.documentElement.appendChild(panel);

  var NL = String.fromCharCode(10);

  function line(s) {
    panel.textContent += s + NL;
    panel.scrollTop = panel.scrollHeight;
  }

  function fmt(name, el) {
    if (!el) { return name + ': ABSENT'; }
    var cs = window.getComputedStyle(el);
    var r = el.getBoundingClientRect();
    return name + ': d=' + cs.display +
      ' v=' + cs.visibility +
      ' o=' + cs.opacity +
      ' h=' + Math.round(r.height) +
      ' top=' + Math.round(r.top) +
      (cs.transform && cs.transform !== 'none' ? ' tf=' + cs.transform.slice(0, 28) : '');
  }

  function snap(label) {
    line('--- ' + label + ' ---');
    line(fmt('icon   ', document.querySelector('.st-search-icon-mobile')));
    line(fmt('mobBox ', document.querySelector('.st-mobile-searchbox')));
    line(fmt('barCont', document.querySelector('.st-search-bar-container')));
    var input = document.querySelector('input[type="search"], input[placeholder*="Search" i]');
    line(fmt('input  ', input));
    if (input && input.parentElement) {
      line('  parent=' + (input.parentElement.className || '(none)').toString().slice(0, 70));
    }
    line('headerHiddenClass=' + !!document.querySelector('.shopify-section-header-hidden'));
    line(fmt('sticky ', document.querySelector('sticky-header')));

    // The header reports height 0 while claiming to be visible, so look at what
    // is inside it and whether the theme's height variable was ever set.
    var sh = document.querySelector('sticky-header');
    if (sh) {
      line('  kids=' + sh.children.length + ' htmlLen=' + sh.innerHTML.length);
      line('  inlineStyle=' + (sh.getAttribute('style') || '(none)').slice(0, 60));
      line('  stickyType=' + (sh.getAttribute('data-sticky-type') || '(none)'));
    }
    line(fmt('hdr.inner', document.querySelector('.header')));
    line(fmt('logo   ', document.querySelector('.header__heading-logo')));
    line(fmt('icons  ', document.querySelector('.header__icons')));
    line(fmt('annBar ', document.querySelector('[id*="announcement"]')));
    var hv = getComputedStyle(document.documentElement).getPropertyValue('--header-height');
    line('  --header-height=' + (hv || '(unset)').trim());
  }

  line('ZIGLY SEARCH DIAGNOSTIC  ' + window.location.pathname);
  snap('t0');
  setTimeout(function () { snap('t+3s'); }, 3000);
  setTimeout(function () { snap('t+8s'); }, 8000);
  setTimeout(function () { snap('t+15s'); }, 15000);
})();
true;
`;
