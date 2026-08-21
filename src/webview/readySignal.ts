/**
 * Tell the app when the dashboard is actually ready to show.
 *
 * The reference app holds its splash for a few seconds and then reveals a
 * complete dashboard. Ours revealed the page as soon as it loaded, so the
 * transplanted sections visibly filled in afterwards.
 *
 * This watches for the above-the-fold content to be in place and reports once.
 * The app pairs it with a hard timeout, so a missing section delays the splash
 * briefly rather than trapping the user behind it.
 */
export const READY_SIGNAL_SCRIPT = `
(function () {
  if (window.__ziglyReadyWatch) { return; }
  window.__ziglyReadyWatch = true;

  function isHome() {
    var p = window.location.pathname;
    while (p.length > 1 && p.charAt(p.length - 1) === '/') { p = p.slice(0, -1); }
    return p === '' || p === '/' || p === '/index';
  }

  function send() {
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({tag: 'dashboard-ready'}));
      }
    } catch (e) {}
  }

  // Inner pages have nothing to assemble, so they are ready immediately.
  if (!isHome()) { send(); return; }

  /**
   * Above-the-fold only. Waiting on the whole page would hold the splash for
   * sections the user cannot see yet, which is slower than the site itself.
   */
  function ready() {
    var banner = document.querySelector('[id*="homepage_banner"]');
    var cats = document.querySelector('[id*="home_category_section"]');
    if (!banner || !cats) { return false; }

    // The category rail must actually have its tiles, not just its container.
    if (!cats.querySelector('img')) { return false; }

    // The first breed rail is the first transplant the user sees.
    var breeds = document.getElementById('zigly-breed-dogs');
    if (breeds && breeds.getAttribute('data-state') !== 'ready') { return false; }

    return true;
  }

  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    if (ready()) {
      clearInterval(timer);
      send();
    } else if (tries > 40) {
      // ~10s. Report anyway; the app's own cap will already have fired.
      clearInterval(timer);
      send();
    }
  }, 250);

  if (ready()) { clearInterval(timer); send(); }
})();
true;
`;
