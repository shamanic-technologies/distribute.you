/**
 * The public fleet indexes (owner 2026-10-18, FLEET-INDEXES-1018): one number per
 * index, recorded every day by features-service and read here through the gateway
 * (`/v1/public/indexes`, `/v1/public/indexes/{slug}`).
 *
 * The list is READ, never typed here: a new index the service starts serving gets its
 * page, its row on `/indexes` and its footer link with no edit in this repo. Values
 * arrive unrounded; this module only formats them. A null value is a day the service
 * could not state the number, and it is said in words, never shown as `$0`.
 *
 * Alias-free so the unit tests render it directly.
 */

import { formatReturnMultiple } from "./landing-format";

export type IndexStatus = "robust" | "signal" | "noise";

/** `multiple` = a return (3.6 = $3.6 back per dollar spent), written like the hero ROI. */
export type IndexUnit = "usd" | "percent" | "multiple";
const UNITS: readonly IndexUnit[] = ["usd", "percent", "multiple"];

export type StatusRule = { signalMinOutcomes: number; robustMinOutcomes: number };

export type IndexSummary = {
  slug: string;
  name: string;
  channelSlug: string;
  channelName: string;
  outcome: string;
  metric: string;
  unit: IndexUnit;
  valuePer: string;
  method: string;
  day: string | null;
  value: number | null;
  status: IndexStatus;
  outcomes: number;
  contacted: number | null;
  workflowDynastySlug: string | null;
  workflowDynastyName: string | null;
  unavailableReason: string | null;
  recordedAt: string | null;
  /** Absent on payloads older than the field: read as measured. */
  valueKind?: ValueKind;
};

/**
 * `measured` = read off what was spent and booked; `expected` = the price the producer
 * expects while the measured one cannot be stated (owner 2026-10-25: the cost ledger is
 * being rebuilt, the meeting index serves the Research expected price meanwhile). An
 * expected value always carries its label wherever it prints.
 */
export type ValueKind = "measured" | "expected";
const VALUE_KINDS: readonly ValueKind[] = ["measured", "expected"];

/** True only for a value the producer served as expected; absent = measured. */
export function isExpected(x: { valueKind?: ValueKind } | null | undefined): boolean {
  return x?.valueKind === "expected";
}

/** The one word every surface puts beside an expected value. */
export const EXPECTED_LABEL = "Expected";

export type IndexPoint = {
  day: string;
  value: number | null;
  status: IndexStatus;
  outcomes: number;
  contacted: number | null;
  workflowDynastyName: string | null;
  unavailableReason: string | null;
  /** `recorded` = written live that day; `recomputed` = rebuilt later as of that day (the 2026-10-19 backfill). */
  basis?: IndexBasis;
  valueKind?: ValueKind;
};

export type IndexBasis = "recorded" | "recomputed";
/** One served sentence per basis, for the label beside the curve. */
export type BasisRule = Record<IndexBasis, string>;

export type IndexList = { statusRule: StatusRule; indexes: IndexSummary[] };
export type IndexDetail = { statusRule: StatusRule; index: IndexSummary; points: IndexPoint[]; basisRule?: BasisRule };

const STATUSES: readonly IndexStatus[] = ["robust", "signal", "noise"];

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function parseRule(body: unknown): StatusRule {
  const r = (body as { statusRule?: StatusRule })?.statusRule;
  if (!r || !isNum(r.signalMinOutcomes) || !isNum(r.robustMinOutcomes)) {
    throw new Error(`statusRule is ${JSON.stringify(r)}`);
  }
  return r;
}

function parseSummary(s: IndexSummary): IndexSummary {
  if (typeof s?.slug !== "string" || !/^[a-z0-9-]+$/.test(s.slug)) throw new Error(`index slug ${JSON.stringify(s?.slug)}`);
  if (typeof s.name !== "string") throw new Error(`index ${s.slug} has name ${JSON.stringify(s.name)}`);
  if (!UNITS.includes(s.unit)) throw new Error(`index ${s.slug} has unit ${JSON.stringify(s.unit)}`);
  if (!STATUSES.includes(s.status)) throw new Error(`index ${s.slug} has status ${JSON.stringify(s.status)}`);
  if (s.value !== null && !isNum(s.value)) throw new Error(`index ${s.slug} has value ${JSON.stringify(s.value)}`);
  if (s.valueKind !== undefined && !VALUE_KINDS.includes(s.valueKind)) {
    throw new Error(`index ${s.slug} has valueKind ${JSON.stringify(s.valueKind)}`);
  }
  return s;
}

/** `GET /v1/public/indexes`, read strictly: a shape we do not know fails the read. */
export function parseIndexList(body: unknown): IndexList {
  const indexes = (body as { indexes?: unknown })?.indexes;
  if (!Array.isArray(indexes)) throw new Error("indexes is not an array");
  return { statusRule: parseRule(body), indexes: (indexes as IndexSummary[]).map(parseSummary) };
}

/** `GET /v1/public/indexes/{slug}`, points oldest day first. */
export function parseIndexDetail(body: unknown): IndexDetail {
  const b = body as { index?: IndexSummary; points?: IndexPoint[] };
  if (!Array.isArray(b?.points)) throw new Error("points is not an array");
  for (const p of b.points) {
    if (typeof p?.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(p.day)) throw new Error(`point day ${JSON.stringify(p?.day)}`);
    if (p.value !== null && !isNum(p.value)) throw new Error(`point ${p.day} has value ${JSON.stringify(p.value)}`);
    if (!STATUSES.includes(p.status)) throw new Error(`point ${p.day} has status ${JSON.stringify(p.status)}`);
    if (p.basis !== undefined && p.basis !== "recorded" && p.basis !== "recomputed") {
      throw new Error(`point ${p.day} has basis ${JSON.stringify(p.basis)}`);
    }
    if (p.valueKind !== undefined && !VALUE_KINDS.includes(p.valueKind)) {
      throw new Error(`point ${p.day} has valueKind ${JSON.stringify(p.valueKind)}`);
    }
  }
  const rule = (body as { basisRule?: BasisRule }).basisRule;
  if (rule !== undefined && (typeof rule?.recorded !== "string" || typeof rule?.recomputed !== "string")) {
    throw new Error(`basisRule is ${JSON.stringify(rule)}`);
  }
  return { statusRule: parseRule(body), index: parseSummary(b.index as IndexSummary), points: b.points, ...(rule ? { basisRule: rule } : {}) };
}

/**
 * Slugs the indexes were first published under (2026-10-18), renamed for search on
 * 2026-10-19 (owner: "SCEO" read as noise in the URL). An old URL answers a permanent
 * redirect to its new page once the service no longer knows the old slug, so a link or
 * a search result already pointing at it keeps its reader and its ranking.
 */
export const RENAMED_INDEX_SLUGS: Readonly<Record<string, string>> = {
  "sceo-cost-per-click": "cold-email-cost-per-click",
  "sceo-click-rate": "cold-email-click-rate",
  "sceo-cost-per-interest": "cold-email-cost-per-positive-reply",
  "sceo-interest-rate": "cold-email-positive-reply-rate",
  "sceo-cost-per-meeting": "cold-email-cost-per-meeting",
  "sceo-meeting-rate": "cold-email-meeting-rate",
};

// ---------------------------------------------------------------------------
// Reading through the gateway
// ---------------------------------------------------------------------------

/** A new day is recorded hourly upstream; half an hour here keeps it within the hour. */
export const INDEX_REVALIDATE_SECONDS = 1800;

function apiBase(): string {
  return (process.env.API_SERVICE_URL || "https://api.distribute.you").replace(/\/$/, "");
}

async function readJson(path: string, timeoutMs: number): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${apiBase()}/v1${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: INDEX_REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(timeoutMs),
  } as RequestInit);
  return { status: res.status, body: res.status === 200 ? await res.json() : null };
}

/** Every index with today's value; null when the read failed (logged loud). */
export async function fetchIndexList(timeoutMs = 8_000): Promise<IndexList | null> {
  try {
    const { status, body } = await readJson("/public/indexes", timeoutMs);
    if (status !== 200) throw new Error(`status ${status}`);
    return parseIndexList(body);
  } catch (err) {
    console.error("[landing] /v1/public/indexes read failed", err);
    return null;
  }
}

/** One index and its daily series; "not_found" on an unknown slug, null on a failed read. */
export async function fetchIndexDetail(slug: string): Promise<IndexDetail | "not_found" | null> {
  try {
    const { status, body } = await readJson(`/public/indexes/${encodeURIComponent(slug)}`, 8_000);
    if (status === 404) return "not_found";
    if (status !== 200) throw new Error(`status ${status}`);
    return parseIndexDetail(body);
  } catch (err) {
    console.error(`[landing] /v1/public/indexes/${slug} read failed`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Words and numbers
// ---------------------------------------------------------------------------

/** The JSON-LD `unitText` of a unit. */
export const UNIT_TEXT: Record<IndexUnit, string> = { usd: "USD", percent: "percent", multiple: "multiple of spend" };

/** $4.35, $1,240, 2.08%, 3.6x. Two decimals while they carry meaning. */
export function formatIndexValue(value: number, unit: IndexUnit): string {
  if (unit === "multiple") return `${formatReturnMultiple(value).text}x`;
  if (unit === "percent") {
    return `${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  }
  const digits = value >= 1000 ? 0 : 2;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/** Shorter tick labels for the chart scale ($4.4, 2.1%). */
export function formatTick(value: number, unit: IndexUnit): string {
  const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  const n = value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return unit === "percent" ? `${n}%` : unit === "multiple" ? `${n}x` : `$${n}`;
}

/** Customer-facing status words: every status is published, each says how far to lean on it. */
export const STATUS_LABEL: Record<IndexStatus, string> = {
  robust: "Robust",
  signal: "Signal",
  noise: "Early read",
};

export function statusLine(status: IndexStatus, rule: StatusRule): string {
  if (status === "robust") return `Robust: built on ${rule.robustMinOutcomes}+ outcomes.`;
  if (status === "signal") return `Signal: built on ${rule.signalMinOutcomes} to ${rule.robustMinOutcomes - 1} outcomes.`;
  return `Early read: under ${rule.signalMinOutcomes} outcomes so far, published anyway.`;
}

/** Every range once, for a page listing several statuses: no word said twice. */
export function statusLegend(rule: StatusRule): string {
  return `Robust: ${rule.robustMinOutcomes}+ outcomes. Signal: ${rule.signalMinOutcomes} to ${rule.robustMinOutcomes - 1}. Early read: under ${rule.signalMinOutcomes}, published anyway.`;
}

const UNAVAILABLE: Record<string, string> = {
  not_recorded_yet: "Today's value is on its way. It is recorded every hour.",
  no_mature_workflow: "No workflow has enough results yet to state this number today.",
  not_measured: "Today's results are not enough to measure this number yet.",
  no_meeting_measured: "No meeting booked from a positive reply has been measured yet.",
  ledger_being_recomputed: "Our cost records are being rebuilt. The number comes back once they are done.",
};

/** Why there is no number today, in plain words. An unknown reason still reads as a sentence. */
export function unavailableLine(reason: string | null): string {
  if (reason && UNAVAILABLE[reason]) return UNAVAILABLE[reason];
  console.error(`[landing] fleet index: unknown unavailableReason ${JSON.stringify(reason)}`);
  return "This number is not available today. It is recorded every hour.";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Oct 18" (or "Oct 18, 2026" with the year). Days are UTC calendar days. */
export function formatDay(day: string, withYear = false): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}${withYear ? `, ${y}` : ""}`;
}

export function esc(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// ---------------------------------------------------------------------------
// The footer column
// ---------------------------------------------------------------------------

/** Where the footer's per-index links go; resolved per request by `withIndexLinks`. */
export const INDEX_LINKS_TOKEN = "<!--fleet-index-links-->";

/** The links themselves, one per served index, in the served order. */
export function indexLinksHtml(list: IndexList | null): string {
  if (!list) return "";
  return list.indexes.map((i) => `<li><a href="/indexes/${i.slug}">${esc(i.name)}</a></li>`).join("");
}
