/**
 * Chromium prerenders the auth screens on intent, so Try for Free, Sign In and
 * the composer's submit activate a page whose Clerk form is already mounted.
 * Other browsers do not prerender; for them the idle moment loads the
 * auth screens in a hidden frame instead, so the click is served from cache.
 *
 * Signed-in visitors are excluded: their auth screens redirect into the app,
 * and a prerender that is never activated would run the app unseen. Clerk's
 * `__client_uat` cookie (optionally suffixed per instance) is `0` or absent
 * while signed out and a timestamp while signed in.
 */
const CLIENT_UAT = /(?:^|;\s*)__client_uat(?:_[^=;]*)?=([^;]*)/g;

export function signedIn(cookie = document.cookie) {
  return [...cookie.matchAll(CLIENT_UAT)].some(([, value]) => value !== '' && value !== '0');
}

export function prerender(rule) {
  if (signedIn() || !HTMLScriptElement.supports?.('speculationrules')) return false;
  const rules = document.createElement('script');
  rules.type = 'speculationrules';
  rules.textContent = JSON.stringify({ prerender: [rule] });
  document.head.append(rules);
  return true;
}

/** A 200 ms hover or a pointerdown on desktop, a settled viewport on mobile. */
export function prerenderAuthLinksOnIntent() {
  return prerender({ where: { href_matches: ['/auth/sign-up', '/auth/sign-in'] }, eagerness: 'moderate' });
}

/**
 * The auth screens are where every call to action on the landing leads, and a
 * prerender is a hidden page whose timers Chromium throttles: Clerk needs about
 * 2.5 s there to mount its form, longer than a hover lasts. So both screens
 * start once the landing itself has loaded and the main thread is idle, sign-up
 * first, and a click activates a finished page. They share Clerk's UI and the
 * scene image, so the second is mostly cache. Chromium skips speculation under
 * Data Saver, Energy Saver and memory pressure.
 */
export function prerenderAuthScreensWhenIdle() {
  const run = () => {
    prefetchAuthScripts();
    prerender({ urls: ['/auth/sign-up', '/auth/sign-in'], eagerness: 'immediate' });
    if (!canPrerender()) warmAuthScreens();
  };
  const start = () => (window.requestIdleCallback ? requestIdleCallback(run, { timeout: 2000 }) : setTimeout(run, 0));
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
}

/**
 * Whether speculation rules can prerender here. Parsing them is not enough:
 * WebKit reports `HTMLScriptElement.supports('speculationrules')` yet never
 * prerenders, and only a browser that prerenders has `document.prerendering`
 * (checked in Chromium and Playwright's WebKit, 2026-10-06).
 */
export function canPrerender() {
  return Boolean(HTMLScriptElement.supports?.('speculationrules')) && 'prerendering' in document;
}

/**
 * The landing loads no Clerk, so without this a Chromium click whose prerender
 * was skipped (Data Saver, Energy Saver, memory pressure, or a DevTools-driven
 * browser) downloaded Clerk's core after the click: 5.2 s instead of 4.2 s on
 * slow 4G (deployed dev, 2026-10-06). The page lists the exact script URLs the
 * auth screens load (`#oxygen-auth-scripts`); they are prefetched into the HTTP
 * cache at the idle moment, after first paint and the landing's own load.
 */
export function prefetchAuthScripts() {
  if (navigator.connection?.saveData) return [];
  let urls = [];
  try {
    urls = JSON.parse(document.getElementById('oxygen-auth-scripts')?.textContent || '[]');
  } catch {
    return [];
  }
  const added = [];
  for (const href of Array.isArray(urls) ? urls : []) {
    if (typeof href !== 'string' || document.head.querySelector(`link[rel="prefetch"][href="${CSS.escape(href)}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'script';
    link.crossOrigin = 'anonymous';
    link.href = href;
    document.head.append(link);
    added.push(href);
  }
  return added;
}

/** How long a warm-up frame may live before it is removed even if the form never appears. */
export const WARM_FRAME_TIMEOUT_MS = 30_000;
const AUTH_FORM = 'input[name="emailAddress"], input[name="identifier"]';

/**
 * Safari and Firefox do not prerender, so a click there used to fetch
 * Clerk's whole sign-in UI (~330 KB) and the auth scene image after the click:
 * 4.3 s on slow 4G (measured on dev, closeout 18, 2026-10-06), against 1.5 s
 * with those files already cached. The same idle moment that starts the
 * prerender in Chromium loads the auth screens there in a hidden, inert frame,
 * one after the other, so the click finds them in the HTTP cache. Each frame is
 * removed once its Clerk form exists. A framed page never starts analytics
 * (AnalyticsConsentProvider), signed-in visitors are skipped for the same
 * reason as the prerender, and Save-Data is respected.
 */
export function warmAuthScreens(paths = ['/auth/sign-up', '/auth/sign-in']) {
  if (signedIn() || navigator.connection?.saveData || !paths.length) return false;
  const [path, ...rest] = paths;
  const frame = document.createElement('iframe');
  frame.src = path;
  frame.title = '';
  frame.tabIndex = -1;
  frame.inert = true;
  frame.setAttribute('aria-hidden', 'true');
  frame.dataset.oxygenAuthWarm = path;
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1280px;height:800px;border:0;opacity:0;pointer-events:none;';
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearInterval(poll);
    clearTimeout(limit);
    frame.remove();
    warmAuthScreens(rest);
  };
  const poll = setInterval(() => {
    try {
      if (frame.contentDocument?.querySelector(AUTH_FORM)) finish();
    } catch {
      finish();
    }
  }, 250);
  const limit = setTimeout(finish, WARM_FRAME_TIMEOUT_MS);
  document.body.append(frame);
  return true;
}
