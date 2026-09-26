/**
 * The two calls the anonymous session makes to client-service DIRECTLY.
 *
 * Everything else the signed-out flow does goes through the gateway, which is
 * the right shape and stays that way. These two cannot:
 *
 *  - Creating the org must DECLARE that it is coming into being without an
 *    identity provider. client-service records that at creation and refuses to
 *    claim an org that carries no such record — deliberately, so that nothing
 *    is ever inferred from what an external id looks like. The gateway resolves
 *    identity with a body of its own and has no way to say it, so an org
 *    created through the gateway is unclaimable forever. That is a silent
 *    failure a whole signup later, which is why this is worth a direct call.
 *  - The claim addresses an org by INTERNAL uuid and is a `/internal` route.
 *
 * Reached on the compose network (`http://client-service:8080`), so nothing
 * here crosses the public edge — which also means Cloudflare's scripted-request
 * block is not in the path.
 *
 * The key cannot reach a browser: Next inlines only `NEXT_PUBLIC_*` into a
 * client bundle, so a bare `process.env` read resolves to `undefined` there and
 * this module throws rather than leaking anything. (`server-only` would make
 * that a BUILD error instead of a runtime one, but it is not a dependency of
 * this app and adding one for a guarantee the bundler already gives is not
 * worth a lockfile change.)
 */

import type { FirstTouch } from "./first-touch";

const CLIENT_SERVICE_URL = process.env.CLIENT_SERVICE_URL;
const CLIENT_SERVICE_API_KEY = process.env.CLIENT_SERVICE_API_KEY;

/** Long enough for a cold service, short enough not to hold a signup open. */
const TIMEOUT_MS = 12_000;

function endpoint(path: string): string {
  if (!CLIENT_SERVICE_URL || !CLIENT_SERVICE_API_KEY) {
    // FAIL LOUD. A missing key here means the anonymous flow cannot start, and
    // the caller turns that into today's pay-first flow rather than a broken
    // screen — but it is logged as the configuration error it is.
    throw new Error("[client-service] CLIENT_SERVICE_URL / CLIENT_SERVICE_API_KEY not set");
  }
  return `${CLIENT_SERVICE_URL}${path}`;
}

async function call<T>(path: string, body: unknown): Promise<{ status: number; body: T }> {
  const res = await fetch(endpoint(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": CLIENT_SERVICE_API_KEY as string },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { status: res.status, body: (await res.json()) as T };
}

/**
 * Bring an anonymous org into being, and get back the internal uuid.
 *
 * `anonymous: true` is the whole point of the call: it is what makes the org
 * claimable later, it is recorded at creation, and client-service will not
 * re-label an existing org — so this must run BEFORE the first gateway call,
 * which would otherwise create the same external id unmarked.
 */
export async function createAnonymousOrg(
  anonOrgId: string,
  principal: string,
): Promise<{ orgId: string }> {
  const { status, body } = await call<{ orgId?: string }>("/internal/resolve", {
    externalOrgId: anonOrgId,
    externalUserId: principal,
    anonymous: true,
  });
  if (status < 200 || status >= 300 || typeof body.orgId !== "string") {
    throw new Error(`[client-service] resolve failed: ${status}`);
  }
  return { orgId: body.orgId };
}

/** Why a claim did not happen. client-service's own vocabulary, read as a
 *  plain string: it owns this set and may widen it. */
export type ClaimRefusal = string;

export type ClaimOutcome =
  | { claimed: true; alreadyClaimed: boolean; refusal: null }
  | { claimed: false; alreadyClaimed: false; refusal: ClaimRefusal };

export interface ClaimInput {
  /** The anonymous org's INTERNAL uuid, off the signed session. */
  orgId: string;
  /** The identity provider's org, freshly created at signup. */
  externalOrgId: string;
  externalUserId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  orgSlug?: string;
}

/**
 * Say, once, that the anonymous org and the new one are the same organisation.
 *
 * REPLAYING IS SUCCESS. client-service answers 200 with `alreadyClaimed` when
 * the same claim arrives twice, so a retried signup or a replayed request is
 * not an error the customer ever sees — and the caller must not treat it as
 * one, because the org really is theirs.
 *
 * Every other refusal is returned rather than thrown: the caller shows a
 * different thing for each, and there is no fallback — a claim we could not
 * make is never reported as one we made.
 */
export async function claimAnonymousOrg(input: ClaimInput): Promise<ClaimOutcome> {
  const { orgId, ...body } = input;
  const { status, body: res } = await call<{ reason?: string; alreadyClaimed?: boolean }>(
    `/internal/orgs/${encodeURIComponent(orgId)}/claim`,
    body,
  );

  if (status >= 200 && status < 300) {
    return { claimed: true, alreadyClaimed: res.alreadyClaimed === true, refusal: null };
  }

  const refusal = typeof res.reason === "string" ? res.reason : `http_${status}`;
  console.error(`[client-service] claim refused for ${orgId}: ${refusal}`);
  return { claimed: false, alreadyClaimed: false, refusal };
}

/** Who the first touch belongs to: the anonymous org's internal uuid, or the
 *  identity-provider pair an ordinary signup knows. */
export type AcquisitionTarget =
  | { orgId: string }
  | { externalOrgId: string; externalUserId: string };

/**
 * Hand an org its FIRST TOUCH (`POST /internal/acquisitions`).
 *
 * client-service keeps the first one it receives and answers every later one
 * `recorded: false`, so calling this from several places (the anonymous start,
 * the signup, the end of onboarding) is safe and deliberate: whichever lands
 * first wins, and a claimed anonymous org keeps the touch it had before.
 *
 * NEVER FATAL TO THE CALLER, and never silent. Attribution failing must not cost
 * somebody their signup, so this returns `null` on failure instead of throwing —
 * after logging the status loudly, because a hand-over nobody hears about is how
 * the week's revenue came to be unattributable in the first place.
 */
export async function recordAcquisition(
  target: AcquisitionTarget,
  acquisition: FirstTouch,
): Promise<{ orgId: string; recorded: boolean } | null> {
  try {
    const { status, body } = await call<{ orgId?: string; recorded?: boolean; error?: string }>(
      "/internal/acquisitions",
      { ...target, acquisition },
    );
    if (status < 200 || status >= 300 || typeof body.orgId !== "string") {
      console.error(
        `[client-service] acquisition hand-over refused: ${status} ${body.error ?? ""} channel=${acquisition.channel}`,
      );
      return null;
    }
    console.log(
      `[client-service] acquisition org=${body.orgId} channel=${acquisition.channel} recorded=${body.recorded === true}`,
    );
    return { orgId: body.orgId, recorded: body.recorded === true };
  } catch (err) {
    console.error("[client-service] acquisition hand-over failed:", err);
    return null;
  }
}
