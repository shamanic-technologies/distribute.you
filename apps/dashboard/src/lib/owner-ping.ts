/**
 * One short Telegram line to the owner at every step of a signup (owner 2026-10-07:
 * « il faut que je reçoive un message court à chaque étape »): the account made, the
 * site entered, each `/get-started` step reached, the payment wall, the payment, the
 * launch. Sent the moment it happens, unlike the visit recap (`visit-recap-job.ts`),
 * which waits for the visit to end and filters it.
 *
 * Only the owner's own actions are dropped (`isStaffEmail`). No headless filter: a
 * scanner that runs no JavaScript never calls this, and the visit recap's screen
 * heuristic dropped a real signup (a full-screen 1366px laptop, 2026-10-07).
 *
 * Alias-free on purpose (no runtime `@/` import) so it gets real unit tests.
 */

export const OWNER_PING_EVENTS = ["signed_up", "started", "step", "wall", "paid", "launched"] as const;
export type OwnerPingEvent = (typeof OWNER_PING_EVENTS)[number];

/** Set in a browser where a staff account signed in: its later anonymous visits are the owner's too. */
export const STAFF_BROWSER_KEY = "distribute_staff_browser";

export function isStaffEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  return (
    e === "kevin.lourd@gmail.com" ||
    e === "kevin@pressbeat.io" ||
    e.endsWith("@distribute.you") ||
    e.startsWith("kevin.lourd+")
  );
}

export interface OwnerPing {
  event: OwnerPingEvent;
  /** "Grace Kendrick · grace@x.com", or null for a visitor with no account yet. */
  who: string | null;
  domain?: string | null;
  /** For `step`: the step label and its 1-based position out of `total`. */
  step?: { label: string; index: number; total: number } | null;
  amountUsd?: number | null;
  country?: string | null;
  /** `who` has an account but walked this signed out: a returning person, not a new lead. */
  signedOut?: boolean;
}

/**
 * The Clerk user a signed-out browser still carries as its PostHog distinct id
 * (`posthog.identify(userId)` at sign-in survives sign-out), or nothing. A signed-out
 * walk by someone with an account read as "Visitor (no account yet)" and opened a
 * second org nobody tied to the first (savoir.ltd, 2026-10-08).
 */
export function clerkUserIdFromDistinctId(raw: unknown): string | null {
  return typeof raw === "string" && /^user_[A-Za-z0-9]{20,40}$/.test(raw) ? raw : null;
}

const ICON: Record<OwnerPingEvent, string> = {
  signed_up: "🆕",
  started: "🌐",
  step: "➡️",
  wall: "🧱",
  paid: "💳",
  launched: "🚀",
};

function what(p: OwnerPing): string {
  switch (p.event) {
    case "signed_up":
      return "signed up";
    case "started":
      return "entered their site";
    case "step":
      if (!p.step) throw new Error("[owner-ping] a step ping carries no step");
      return `${p.step.index}/${p.step.total} ${p.step.label}`;
    case "wall":
      return "reached the payment wall";
    case "paid":
      if (p.amountUsd == null || !Number.isFinite(p.amountUsd)) throw new Error("[owner-ping] a paid ping carries no amount");
      return `paid $${p.amountUsd}`;
    case "launched":
      return "launched";
  }
}

/** The one line the owner reads: icon, who, site, what happened, country. */
export function formatOwnerPing(p: OwnerPing): string {
  const parts = [p.who ? (p.signedOut ? `${p.who} (has an account, signed out)` : p.who) : "Visitor (no account yet)"];
  if (p.domain) parts.push(p.domain);
  parts.push(what(p));
  if (p.country) parts.push(p.country);
  return `${ICON[p.event]} ${parts.join(" · ")}`;
}
