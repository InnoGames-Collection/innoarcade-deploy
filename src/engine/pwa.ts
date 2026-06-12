// Progressive-web-app glue: registers the service worker for offline play.
// No-ops where service workers are unavailable. Safe to call from every page.
//
// The app is a multi-page build — the hub lives at the app root and each game at
// `<root>/games/<name>/`. We derive the root from the current path (stripping a
// trailing `games/<name>/`) so the SW is registered with root scope and a single
// worker covers the hub and all games, even under a deploy sub-path.

export function registerPwa(): void {
  if (!('serviceWorker' in navigator)) return;
  const rootPath = location.pathname.replace(/games\/[^/]+\/?$/, '');
  const swUrl = `${location.origin}${rootPath}sw.js`;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(swUrl, { scope: rootPath })
      .catch(() => {
        /* offline support is optional; ignore registration failures */
      });
  });
}
