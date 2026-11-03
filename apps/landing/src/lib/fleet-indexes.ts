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

/**
 * A RETURN index (`unit: "multiple"`, the median client ROI) is RETIRED (owner 2026-11-03,
 * ROI-CONSISTENCY-1103): a return exists only where a value lands, never as a fleet
 * median over pipeline. It is dropped from the list, its page answers like an unknown
 * slug, and its old URL redirects to the list (`RETIRED_INDEX_REDIRECT`).
 */
export function isRetiredIndex(s: Pick<IndexSummary, "unit">): boolean {
  return s.unit === "multiple";
}
/** Where a retired index's old public URL now points. */
export const RETIRED_INDEX_REDIRECT = "/indexes";
/**
 * Retired slugs the service no longer serves at all: their old URL still redirects to the
 * list, so a link or a search result keeps its reader once the page is gone upstream.
 */
export const RETIRED_INDEX_SLUGS: ReadonlySet<string> = new Set(["cold-email-roi"]);

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
    const list = parseIndexList(body);
    return { ...list, indexes: list.indexes.filter((i) => !isRetiredIndex(i)) };
  } catch (err) {
    console.error("[landing] /v1/public/indexes read failed", err);
    return null;
  }
}

/** One index and its daily series; "not_found" on an unknown slug, "retired" on a retired one, null on a failed read. */
export async function fetchIndexDetail(slug: string): Promise<IndexDetail | "not_found" | "retired" | null> {
  try {
    const { status, body } = await readJson(`/public/indexes/${encodeURIComponent(slug)}`, 8_000);
    if (status === 404) return "not_found";
    if (status !== 200) throw new Error(`status ${status}`);
    const detail = parseIndexDetail(body);
    return isRetiredIndex(detail.index) ? "retired" : detail;
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

/**
 * The figure we show, and the height we draw it at (owner 2026-11-02: with this little
 * data a decimal is noise). 10 or more goes to the nearest ten, 1 to 10 to the unit.
 * Below 1 the unit would print 0% for a rate we did measure (0.18% positive replies),
 * so it keeps its first meaningful digit (0.2%, 0.05%).
 */
export function displayValue(value: number): number {
  const a = Math.abs(value);
  if (a >= 10) return Math.round(value / 10) * 10;
  if (a >= 0.5 || a === 0) return Math.round(value);
  return Number(value.toPrecision(1));
}

function withUnit(value: number, unit: IndexUnit): string {
  const n = displayValue(value).toLocaleString("en-US", { maximumFractionDigits: 6 });
  return unit === "percent" ? `${n}%` : unit === "multiple" ? `${n}x` : `$${n}`;
}

/** $4, $1,240, 2%, 20x, 0.2%: a decimal only under 1. */
export function formatIndexValue(value: number, unit: IndexUnit): string {
  return withUnit(value, unit);
}

/** The chart scale labels, rounded the same way ($4, 2%, $40). */
export function formatTick(value: number, unit: IndexUnit): string {
  return withUnit(value, unit);
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
