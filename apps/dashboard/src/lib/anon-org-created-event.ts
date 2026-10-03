/**
 * One onboarding start = one anonymous org created, recorded in PostHog BY THE
 * SERVER that created it, keyed on the org.
 *
 * Why not the browser: posthog-js sends nothing at all when `navigator.webdriver`
 * is set or the user agent is headless, and an ad blocker stops it for a real
 * person. A browser-side event therefore misses exactly the rows the weekly brief
 * must tell apart (our own QA walks made ~45 of 51 anonymous orgs one week, G-C
 * 2026-10-03). The server sees every creation, so PostHog and client-service hold
 * the same population, joined on `org_id`.
 *
 * Who made the org rides on the event as POSITIVE fingerprints only: the
 * browser's own `navigator.webdriver` flag and the request's user agent. When the
 * browser runs PostHog, its distinct id is the event's, so the event lands on
 * that visitor's person (an internal email is then visible too).
 *
 * Alias-free on purpose: a unit test imports it directly.
 */

export const ANON_ORG_CREATED_EVENT = "anonymous_org_created";

export interface AnonOrgCreated {
  orgId: string;
  domain: string | null;
  userAgent: string;
  /** `navigator.webdriver` as the browser reported it; null when it did not say. */
  webdriver: boolean | null;
  /** The visitor's PostHog distinct id, when their browser runs PostHog. */
  posthogDistinctId: string | null;
}

export function anonOrgCreatedPayload(apiKey: string, e: AnonOrgCreated) {
  return {
    api_key: apiKey,
    event: ANON_ORG_CREATED_EVENT,
    distinct_id: e.posthogDistinctId ?? `anon-org:${e.orgId}`,
    properties: {
      org_id: e.orgId,
      domain: e.domain,
      webdriver: e.webdriver,
      $raw_user_agent: e.userAgent,
      source: "server",
      // No browser person to attach to: do not mint one per org.
      ...(e.posthogDistinctId ? {} : { $process_person_profile: false }),
    },
  };
}

/** A distinct id as posthog-js mints it, or nothing: never an arbitrary string
 *  from the request body used as a person key. */
export function readPosthogDistinctId(raw: unknown): string | null {
  return typeof raw === "string" && /^[A-Za-z0-9_.:-]{8,200}$/.test(raw) ? raw : null;
}

/** Sends the event. Never throws: the org exists whatever PostHog answers, and a
 *  lost event is logged with the org id so the brief can name the row. */
export async function recordAnonOrgCreated(e: AnonOrgCreated): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!apiKey || !host) {
    console.error(`[anon-session] PostHog not configured: ${ANON_ORG_CREATED_EVENT} lost for org ${e.orgId}`);
    return;
  }
  try {
    const res = await fetch(`${host.replace(/\/$/, "")}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(anonOrgCreatedPayload(apiKey, e)),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) console.error(`[anon-session] PostHog ${res.status}: ${ANON_ORG_CREATED_EVENT} lost for org ${e.orgId}`);
  } catch (err) {
    console.error(`[anon-session] PostHog unreachable: ${ANON_ORG_CREATED_EVENT} lost for org ${e.orgId}`, err);
  }
}
