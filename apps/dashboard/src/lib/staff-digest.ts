import { z } from "zod";

/**
 * The once-a-day staff digest: who signed up and who signed in over the last 24
 * hours, in ONE email, replacing the ~609 individual pings (`user_active`,
 * `signin_notification`) that used to fire for an audience of one.
 *
 * Why it exists at all: the Postmark account sits on the free plan — 100 emails
 * a month, hard stop, no overages — and Postmark bills per recipient. Those two
 * events alone billed roughly 1,800 emails a month. One digest a day costs 30.
 *
 * Why CLERK is the source and not the trackers it replaces: the trackers were
 * browser-side and therefore droppable by any ad-blocker, and they only knew
 * about a session they happened to observe. Clerk holds `created_at` and
 * `last_sign_in_at` for every user as a fact, needs no new storage, and needs no
 * new secret — `CLERK_SECRET_KEY` is already in this app's environment for the
 * god-mode org switcher and the outcome digest.
 *
 * This module is deliberately free of `@/` imports so its selection and
 * rendering logic carries REAL unit tests rather than source-substring guards
 * (vitest does not resolve the alias in this repo). Anything that needs the
 * staff allowlist takes it as an argument.
 */

/** Event type this digest is sent under. transactional-email-service routes it
 *  to the internal staff recipient list, never to a customer — the dashboard
 *  owns and registers the template of the same name (one-owner rule: a sibling
 *  app registering it too would clobber this copy on its next deploy). */
export const STAFF_DIGEST_TEMPLATE = "staff_daily_digest";

/**
 * The template itself, owned here because this module is what sends under it.
 * `instrumentation.ts` imports it into the boot-time registration, and the cron
 * re-registers it before every send.
 *
 * That second registration is not belt-and-braces, it is the fix for a real
 * failure: on Vercel the boot hook runs per lambda cold start, so "the deploy is
 * READY" says nothing about whether the write into transactional-email-service's
 * template store ever happened. It did not — this template was still absent from
 * the store hours after its deploy went live, while every other signal (build,
 * tests, alias, the route answering 401) was green. A send under an unregistered
 * name throws `No template for event`, silently, at 01:30 UTC.
 *
 * The upsert is idempotent by contract, so re-sending it costs one cheap call a
 * day and makes the send self-sufficient wherever it runs.
 *
 * A pure envelope on purpose: the body is composed here, so the template holds no
 * layout of its own.
 */
export const STAFF_DIGEST_TEMPLATE_DEF = {
  name: STAFF_DIGEST_TEMPLATE,
  subject: "{{subject}}",
  htmlBody: "{{htmlBody}}",
  textBody: "{{textBody}}",
} as const;

const CLERK_API_URL = "https://api.clerk.com/v1";
const CLERK_PAGE_LIMIT = 100;

export type StaffDigestFetch = typeof fetch;

export interface StaffDigestConfig {
  apiUrl: string;
  adminApiKey: string;
  clerkSecretKey: string;
  /** The single staff address. Supplied by the caller so this module stays
   *  alias-free; it is `ADMIN_ALLOWED_EMAILS[0]` in practice. */
  staffEmail: string;
}

export interface StaffDigestRuntimeConfig extends StaffDigestConfig {
  fetchFn?: StaffDigestFetch;
  /** Injectable so the day-boundary cases are testable. */
  now?: Date;
}

const ClerkUserSchema = z
  .object({
    id: z.string(),
    created_at: z.number(),
    last_sign_in_at: z.number().nullable().optional(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    email_addresses: z
      .array(z.object({ email_address: z.string() }).passthrough())
      .optional(),
  })
  .passthrough();

const ClerkUsersResponseSchema = z.array(ClerkUserSchema);

const ClerkMembershipsResponseSchema = z.object({
  data: z.array(
    z
      .object({ organization: z.object({ id: z.string() }).passthrough() })
      .passthrough(),
  ),
});

const EmailSendResponseSchema = z.object({
  sent: z.boolean(),
  deduplicated: z.boolean().optional(),
});

export type ClerkUser = z.infer<typeof ClerkUserSchema>;

export interface StaffDigestPerson {
  email: string;
  name: string | null;
  at: Date;
}

export interface StaffDigestSummary {
  signups: StaffDigestPerson[];
  signins: StaffDigestPerson[];
  windowStart: Date;
  windowEnd: Date;
}

export function staffDigestConfigFromEnv(staffEmail: string): StaffDigestConfig {
  return {
    apiUrl: requireEnv("NEXT_PUBLIC_DISTRIBUTE_API_URL").replace(/\/$/, ""),
    adminApiKey: requireEnv("ADMIN_DISTRIBUTE_API_KEY"),
    clerkSecretKey: requireEnv("CLERK_SECRET_KEY"),
    staffEmail,
  };
}

export function verifyStaffDigestCronRequest(req: Request): boolean {
  const cronSecret = requireEnv("CRON_SECRET");
  return req.headers.get("authorization") === `Bearer ${cronSecret}`;
}

function primaryEmail(user: ClerkUser): string | null {
  return user.email_addresses?.[0]?.email_address ?? null;
}

function displayName(user: ClerkUser): string | null {
  const parts = [user.first_name, user.last_name].filter(
    (p): p is string => !!p && p.trim().length > 0,
  );
  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Split a Clerk user list into the two things the digest reports.
 *
 * A user is a SIGNUP when they were created inside the window, and a SIGNIN
 * when they signed in inside it. A brand-new user satisfies both, and is
 * reported only as a signup — listing the same person twice under two headings
 * would read as two events when it was one.
 *
 * `last_sign_in_at` is absent for a user who has never completed a session; an
 * absent value is not a sign-in, never a zero-date one.
 */
export function summarizeStaffDigest(
  users: ClerkUser[],
  windowStart: Date,
  windowEnd: Date,
  excludeEmails: string[] = [],
): StaffDigestSummary {
  const from = windowStart.getTime();
  const to = windowEnd.getTime();
  const inWindow = (ms: number) => ms >= from && ms < to;
  // Staff never appear in their own digest: they were the person doing the thing,
  // so reporting it back tells them something they already know and costs a line
  // of a report whose whole point is what happened while they were not looking.
  const excluded = new Set(excludeEmails.map((e) => e.toLowerCase()));

  const signups: StaffDigestPerson[] = [];
  const signins: StaffDigestPerson[] = [];

  for (const user of users) {
    const email = primaryEmail(user);
    if (!email) continue;
    if (excluded.has(email.toLowerCase())) continue;
    const person = { email, name: displayName(user) };

    if (inWindow(user.created_at)) {
      signups.push({ ...person, at: new Date(user.created_at) });
      continue;
    }
    const lastSignIn = user.last_sign_in_at;
    if (typeof lastSignIn === "number" && inWindow(lastSignIn)) {
      signins.push({ ...person, at: new Date(lastSignIn) });
    }
  }

  const byMostRecent = (a: StaffDigestPerson, b: StaffDigestPerson) =>
    b.at.getTime() - a.at.getTime();
  signups.sort(byMostRecent);
  signins.sort(byMostRecent);

  return { signups, signins, windowStart, windowEnd };
}

/** True when the digest has something to report. A day with no signup and no
 *  sign-in sends NOTHING: on a 100-a-month budget, an email that says "nothing
 *  happened" is a real cost for no information. */
export function staffDigestHasContent(summary: StaffDigestSummary): boolean {
  return summary.signups.length > 0 || summary.signins.length > 0;
}

export function renderStaffDigestSubject(summary: StaffDigestSummary): string {
  const bits: string[] = [];
  if (summary.signups.length > 0) {
    bits.push(`${summary.signups.length} signup${summary.signups.length === 1 ? "" : "s"}`);
  }
  if (summary.signins.length > 0) {
    bits.push(`${summary.signins.length} sign-in${summary.signins.length === 1 ? "" : "s"}`);
  }
  return `Yesterday: ${bits.join(", ")}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTime(at: Date): string {
  return at.toISOString().slice(11, 16) + " UTC";
}

function renderSection(title: string, people: StaffDigestPerson[]): string {
  if (people.length === 0) return "";
  const rows = people
    .map((p) => {
      const who = p.name ? `${escapeHtml(p.name)} &lt;${escapeHtml(p.email)}&gt;` : escapeHtml(p.email);
      return `<tr><td style="padding:6px 12px 6px 0;color:#111827;">${who}</td><td style="padding:6px 0;color:#6b7280;white-space:nowrap;">${formatTime(p.at)}</td></tr>`;
    })
    .join("");
  return `<h2 style="font-size:15px;margin:24px 0 8px;color:#111827;">${escapeHtml(title)} (${people.length})</h2><table style="border-collapse:collapse;font-size:14px;">${rows}</table>`;
}

export function renderStaffDigestHtml(summary: StaffDigestSummary): string {
  const window = `${summary.windowStart.toISOString().slice(0, 16).replace("T", " ")} to ${summary.windowEnd.toISOString().slice(0, 16).replace("T", " ")} UTC`;
  return [
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;">`,
    `<p style="font-size:13px;color:#6b7280;margin:0 0 4px;">${escapeHtml(window)}</p>`,
    renderSection("Signups", summary.signups),
    renderSection("Sign-ins", summary.signins),
    `</div>`,
  ]
    .filter((part) => part.length > 0)
    .join("");
}

export function renderStaffDigestText(summary: StaffDigestSummary): string {
  const line = (p: StaffDigestPerson) =>
    `  ${p.name ? `${p.name} <${p.email}>` : p.email} — ${formatTime(p.at)}`;
  const parts: string[] = [];
  if (summary.signups.length > 0) {
    parts.push(`Signups (${summary.signups.length}):`, ...summary.signups.map(line));
  }
  if (summary.signins.length > 0) {
    parts.push(`Sign-ins (${summary.signins.length}):`, ...summary.signins.map(line));
  }
  return parts.join("\n");
}

interface StaffDigestResult {
  signups: number;
  signins: number;
  sent: boolean;
  skippedEmpty: boolean;
}

/**
 * Read Clerk, build the summary, and send at most one email.
 *
 * Fail-loud: every fetch throws on a non-2xx or a shape mismatch. A digest that
 * silently reported an empty day because Clerk rate-limited us is worse than a
 * cron that goes red.
 */
export async function sendStaffDigest(
  input: StaffDigestRuntimeConfig,
): Promise<StaffDigestResult> {
  const fetchFn = input.fetchFn ?? fetch;
  const windowEnd = input.now ?? new Date();
  const windowStart = new Date(windowEnd.getTime() - 24 * 60 * 60 * 1000);

  const users = await listRecentClerkUsers(input, fetchFn);
  const summary = summarizeStaffDigest(users, windowStart, windowEnd, [input.staffEmail]);

  if (!staffDigestHasContent(summary)) {
    return { signups: 0, signins: 0, sent: false, skippedEmpty: true };
  }

  // Register before sending — see STAFF_DIGEST_TEMPLATE_DEF for why this cannot
  // be left to the boot hook alone.
  await ensureTemplateRegistered(input, fetchFn);

  const identity = await resolveStaffIdentity(input, fetchFn);
  await sendDigestEmail(input, fetchFn, identity, summary);

  return {
    signups: summary.signups.length,
    signins: summary.signins.length,
    sent: true,
    skippedEmpty: false,
  };
}

/**
 * Clerk users ordered by most-recent sign-in. One page is enough by
 * construction: the window is 24h and the page holds 100 users, so the digest
 * can only under-report once more than 100 distinct people sign in within a
 * single day — far past the point where this account has left the free plan.
 */
async function listRecentClerkUsers(
  config: StaffDigestConfig,
  fetchFn: StaffDigestFetch,
): Promise<ClerkUser[]> {
  const url = `${CLERK_API_URL}/users?limit=${CLERK_PAGE_LIMIT}&order_by=-last_sign_in_at`;
  return fetchJson(url, clerkInit(config), fetchFn, ClerkUsersResponseSchema, "listRecentClerkUsers");
}

/**
 * The (org, user) pair the send is attributed to.
 *
 * The gateway's transactional-email route requires an identity, and a cron has
 * no session — so the digest is attributed to the staff user it is addressed
 * to, resolved from Clerk by the staff email rather than hardcoded as ids. Fail
 * loud on either miss: an unattributable staff digest must not fall back to
 * some other org.
 */
async function resolveStaffIdentity(
  config: StaffDigestConfig,
  fetchFn: StaffDigestFetch,
): Promise<{ orgId: string; userId: string }> {
  const users = await fetchJson(
    `${CLERK_API_URL}/users?email_address=${encodeURIComponent(config.staffEmail)}`,
    clerkInit(config),
    fetchFn,
    ClerkUsersResponseSchema,
    "resolveStaffUser",
  );
  const user = users[0];
  if (!user) {
    throw new Error(`[dashboard-staff-digest] no Clerk user for ${config.staffEmail}`);
  }

  const memberships = await fetchJson(
    `${CLERK_API_URL}/users/${user.id}/organization_memberships?limit=1`,
    clerkInit(config),
    fetchFn,
    ClerkMembershipsResponseSchema,
    "resolveStaffOrg",
  );
  const orgId = memberships.data[0]?.organization.id;
  if (!orgId) {
    throw new Error(`[dashboard-staff-digest] no Clerk org for ${config.staffEmail}`);
  }

  return { orgId, userId: user.id };
}

/** Idempotent upsert of this one template. Fail-loud: a digest sent under an
 *  unregistered name throws downstream and reaches nobody, so there is nothing to
 *  gain by continuing past a failure here. */
async function ensureTemplateRegistered(
  config: StaffDigestConfig,
  fetchFn: StaffDigestFetch,
): Promise<void> {
  const res = await fetchFn(`${config.apiUrl}/v1/emails/templates`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-API-Key": config.adminApiKey },
    body: JSON.stringify({ templates: [STAFF_DIGEST_TEMPLATE_DEF] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `[dashboard-staff-digest] template registration failed: ${res.status} ${body.slice(0, 200)}`,
    );
  }
}

async function sendDigestEmail(
  config: StaffDigestConfig,
  fetchFn: StaffDigestFetch,
  identity: { orgId: string; userId: string },
  summary: StaffDigestSummary,
): Promise<z.infer<typeof EmailSendResponseSchema>> {
  // No bccEmails: the staff audience is one person and they are the recipient.
  // A blind copy here would bill a second email to the same inbox.
  return fetchJson(
    `${config.apiUrl}/v1/emails/send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": config.adminApiKey,
        "x-external-org-id": identity.orgId,
        "x-external-user-id": identity.userId,
      },
      body: JSON.stringify({
        eventType: STAFF_DIGEST_TEMPLATE,
        // One digest per day, whatever the cron does — a retry after a partial
        // failure must not bill a second email.
        productId: `${STAFF_DIGEST_TEMPLATE}:${summary.windowEnd.toISOString().slice(0, 10)}`,
        metadata: {
          subject: renderStaffDigestSubject(summary),
          htmlBody: renderStaffDigestHtml(summary),
          textBody: renderStaffDigestText(summary),
          signupCount: summary.signups.length,
          signinCount: summary.signins.length,
        },
      }),
    },
    fetchFn,
    EmailSendResponseSchema,
    "sendStaffDigestEmail",
  );
}

function clerkInit(config: StaffDigestConfig): RequestInit {
  return {
    headers: {
      Authorization: `Bearer ${config.clerkSecretKey}`,
      "Content-Type": "application/json",
    },
  };
}

async function fetchJson<T>(
  url: string,
  init: RequestInit,
  fetchFn: StaffDigestFetch,
  schema: z.ZodSchema<T>,
  label: string,
): Promise<T> {
  const res = await fetchFn(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `[dashboard-staff-digest] ${label} failed: ${res.status} ${body.slice(0, 200)}`,
    );
  }
  const raw = await res.json();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[dashboard-staff-digest] ${label} response shape mismatch`, parsed.error.issues);
    throw new Error(`[dashboard-staff-digest] ${label} response shape mismatch`);
  }
  return parsed.data;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[dashboard-staff-digest] ${name} is required`);
  return value;
}
