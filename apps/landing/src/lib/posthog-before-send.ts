/**
 * PostHog `before_send` for the landing: drops the one `$exception` that is not ours.
 *
 * Partnero's loader (`app.partnero.com/js/universal.js`, loaded by `partneroHead()` and
 * `app/layout.tsx`) injects `assets.partnero.com/program/<id>/settings/settings.js` and
 * calls `.finally()` on the load promise without a `.catch()`. When that request is
 * blocked, the promise rejects with the bare STRING "Error: loading script", unhandled,
 * and PostHog reports it as `UnhandledRejection: Non-Error promise rejection captured
 * with value: Error: loading script`. On 2026-10-01 every one of those (62 events, 54
 * sessions, 14 days) came from Microsoft link-scanner sandboxes (Boydton, Des Moines,
 * San Jose, Amsterdam, Dublin; identical 1920px Windows Chrome) that block third-party
 * requests while they detonate a link. Nothing on our side can make a blocked vendor
 * script load, and the page works without it, so the event is dropped here.
 *
 * The match is the exact vendor string, never a substring of our own errors.
 * `BEFORE_SEND_JS` is the same predicate for the static pages' inline snippet; the test
 * runs both against the same events.
 */
const PARTNERO_LOAD_REJECTION = "Non-Error promise rejection captured with value: Error: loading script";

type PostHogEvent = { event?: string; properties?: Record<string, unknown> } | null;

export function dropVendorNoise<T extends PostHogEvent>(event: T): T | null {
  if (!event || event.event !== "$exception") return event;
  const list = event.properties?.$exception_list;
  if (Array.isArray(list) && list.some((e) => e && (e as { value?: unknown }).value === PARTNERO_LOAD_REJECTION)) return null;
  return event;
}

export const BEFORE_SEND_JS = `function(e){if(!e||e.event!=="$exception")return e;var l=e.properties&&e.properties.$exception_list;if(Array.isArray(l)&&l.some(function(x){return x&&x.value===${JSON.stringify(PARTNERO_LOAD_REJECTION)}}))return null;return e}`;
