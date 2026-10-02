/**
 * PostHog `before_send`: drops the `$exception` events nobody can act on, and only those.
 *
 * BYTE-EQUAL TWINS: `apps/landing/src/lib/posthog-before-send.ts` and
 * `apps/dashboard/src/lib/posthog-before-send.ts` (pinned by the dashboard's
 * `tests/posthog-before-send.test.ts`). Edit both.
 *
 * Every rule below matches a shape our own code cannot produce, so none of them can hide
 * one of our crashes:
 *
 * 1. Partnero's blocked loader. `app.partnero.com/js/universal.js` (landing only: loaded
 *    by `partneroHead()` and `app/layout.tsx`) injects `assets.partnero.com/.../settings.js`
 *    and calls `.finally()` on the load promise without a `.catch()`. When that request is
 *    blocked, the promise rejects with the bare STRING "Error: loading script", reported as
 *    `UnhandledRejection: Non-Error promise rejection captured with value: Error: loading
 *    script`. On 2026-10-01 every one of those (62 events, 54 sessions, 14 days) came from
 *    Microsoft link-scanner sandboxes. Matched on the exact vendor string.
 *
 * 2. "Script error." with no frame. That is the text a browser substitutes for ANY error
 *    thrown by a script loaded from another origin without CORS (`crossorigin` + an
 *    `Access-Control-Allow-Origin` header): message, file and line are hidden on purpose.
 *    All our code is served from our own origin, so our errors always carry file and line.
 *    The cross-origin scripts we load, and why each is opaque or legible:
 *    - PostHog (`e.distribute.you/static/*.js`), Clerk (`clerk.distribute.you`): loaded with
 *      `crossorigin="anonymous"` by their own loaders and served with CORS, so legible.
 *    - Ahrefs analytics: `crossorigin="anonymous"` added by us (served with `ACAO: *`).
 *    - Partnero `universal.js`: served WITHOUT CORS, so `crossorigin` would block it.
 *    - Google tag (`gtag/js`): it loads more Google scripts we cannot tag, so its error
 *      surface stays opaque whatever we do; left untouched (it carries the Ads gclid).
 *    - Stripe.js (`@stripe/stripe-js` injects it) and Cloudflare Turnstile (Clerk injects
 *      it): their loaders own the tag.
 *    - Scripts a browser extension or a link-scanner sandbox injects into the page.
 *    Observed 2026-10-01: two "Script error." events, both Edge 122 link-scanner sessions.
 *
 * 3. Script injected as a `blob:` URL. Frames that ALL point at `blob:https://<our host>/<uuid>`
 *    are code someone else compiled into the page: none of our bundles, and none of the
 *    vendors above, creates a `<script src="blob:...">` (the only blob our code makes is a
 *    CSV download; PostHog's blob is a Worker, whose errors never reach `window.onerror`).
 *    Observed 2026-09-30 and 2026-10-01: `SyntaxError: Unexpected token ?` at blob line 72
 *    col 54, three Edge 122 scanner sessions (Edge 122 parses `?.`/`??`, so the code that
 *    failed was not ours).
 *
 * 4. A SyntaxError that names no file. A parse error in code we serve always names it (the
 *    chunk URL, or the page URL for an inline script), and a runtime SyntaxError we throw
 *    (`JSON.parse`) carries our stack. Observed in the same scanner session as rule 3:
 *    `SyntaxError: Unexpected token .` with zero frames.
 *
 * Rules 2 to 4 drop an event only when EVERY exception in it matches, so an event that
 * also carries one of ours is kept. `BEFORE_SEND_JS` is the same predicate for the static
 * pages' inline snippet; the tests run both against the same events.
 */
const PARTNERO_LOAD_REJECTION = "Non-Error promise rejection captured with value: Error: loading script";

type PostHogEvent = { event?: string; properties?: Record<string, unknown> } | null;
type Frame = { filename?: unknown } | null | undefined;
type ExceptionEntry = { type?: unknown; value?: unknown; stacktrace?: { frames?: unknown } | null } | null | undefined;

function framesOf(entry: ExceptionEntry): Frame[] {
  const frames = entry?.stacktrace?.frames;
  return Array.isArray(frames) ? frames : [];
}

function fileOf(frame: Frame): string {
  return frame && typeof frame.filename === "string" ? frame.filename : "";
}

/** True when this exception carries nothing anyone can act on (rules 2 to 4 above). */
export function isUnactionableException(entry: ExceptionEntry): boolean {
  if (!entry) return false;
  const frames = framesOf(entry);
  if ((entry.value === "Script error." || entry.value === "Script error") && frames.length === 0) return true;
  if (frames.length > 0 && frames.every((f) => fileOf(f).startsWith("blob:"))) return true;
  if (entry.type === "SyntaxError" && !frames.some((f) => fileOf(f) !== "")) return true;
  return false;
}

export function dropVendorNoise<T extends PostHogEvent>(event: T): T | null {
  if (!event || event.event !== "$exception") return event;
  const list = event.properties?.$exception_list;
  if (!Array.isArray(list) || list.length === 0) return event;
  if (list.some((e) => e && (e as { value?: unknown }).value === PARTNERO_LOAD_REJECTION)) return null;
  if (list.every((e) => isUnactionableException(e as ExceptionEntry))) return null;
  return event;
}

export const BEFORE_SEND_JS = `function(e){if(!e||e.event!=="$exception")return e;var l=e.properties&&e.properties.$exception_list;if(!Array.isArray(l)||l.length===0)return e;if(l.some(function(x){return x&&x.value===${JSON.stringify(PARTNERO_LOAD_REJECTION)}}))return null;function fr(x){var f=x&&x.stacktrace&&x.stacktrace.frames;return Array.isArray(f)?f:[]}function fi(f){return f&&typeof f.filename==="string"?f.filename:""}function u(x){if(!x)return false;var f=fr(x);if((x.value==="Script error."||x.value==="Script error")&&f.length===0)return true;if(f.length>0&&f.every(function(y){return fi(y).indexOf("blob:")===0}))return true;if(x.type==="SyntaxError"&&!f.some(function(y){return fi(y)!==""}))return true;return false}if(l.every(u))return null;return e}`;
