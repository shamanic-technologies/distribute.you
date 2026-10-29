import { z } from "zod";

/**
 * The staff Ledger page (FACTORY-P4-PAGES): the books of ONE brand, read from runs-service
 * (`GET /internal/brands/:brandId/ledger` and `/ledger/runs`, through api-service's staff
 * passthrough `/v1/runs/brands/:brandId/ledger(/runs)`).
 *
 * runs-service serves every figure, exact decimal cents as strings, and the reconciliation
 * verdict (`balanced`, `difference`); this module only parses them. Alias-free (real unit tests).
 */

export const LedgerMoneySchema = z
  .object({ grossCents: z.string(), netCents: z.string(), vendorCents: z.string(), unpricedGrossCents: z.string() })
  .passthrough();
export type LedgerMoney = z.infer<typeof LedgerMoneySchema>;

const BooksFields = {
  // runs-service v0.47.110 (FACTORY-P4-PAGES): the spread part, served so the page computes no part.
  production: LedgerMoneySchema.optional(),
  standardCharged: LedgerMoneySchema,
  reuseGain: LedgerMoneySchema,
  producedNone: LedgerMoneySchema,
  support: LedgerMoneySchema,
  undeclared: LedgerMoneySchema,
  abnormal: LedgerMoneySchema,
  spend: LedgerMoneySchema,
  difference: LedgerMoneySchema,
  balanced: z.boolean(),
};

export const BrandBooksSchema = z.object(BooksFields).passthrough();
export type BrandBooks = z.infer<typeof BrandBooksSchema>;

export const BrandLedgerSchema = z
  .object({
    brandId: z.string(),
    since: z.string(),
    until: z.string(),
    complete: z.boolean(),
    daysMissing: z.array(z.string()),
    books: BrandBooksSchema,
    days: z.array(z.object({ day: z.string(), occurrences: z.number(), ...BooksFields }).passthrough()),
    outcomes: z.array(z.object({ outcomeKey: z.string(), occurrences: z.number(), cost: LedgerMoneySchema }).passthrough()),
  })
  .passthrough();
export type BrandLedger = z.infer<typeof BrandLedgerSchema>;
export type BrandLedgerDay = BrandLedger["days"][number];

const OutcomeCountSchema = z.object({ outcomeKey: z.string(), occurrences: z.number() }).passthrough();

export const BrandLedgerRunSchema = z
  .object({
    id: z.string(),
    parentRunId: z.string().nullable(),
    startedAt: z.string(),
    completedAt: z.string().nullable(),
    status: z.string(),
    serviceName: z.string(),
    taskName: z.string(),
    workflowSlug: z.string().nullable(),
    featureSlug: z.string().nullable(),
    campaignId: z.string().nullable(),
    cost: z.object({ grossCents: z.string(), netCents: z.string() }).passthrough(),
    costRows: z.number(),
    produced: z.array(OutcomeCountSchema),
    consumed: z.array(OutcomeCountSchema),
    supportKind: z.string().nullable(),
    // runs-service v0.47.112: the run this one is a step of (its caller). Optional until served.
    parent: z.object({ serviceName: z.string(), taskName: z.string() }).passthrough().nullish(),
  })
  .passthrough();
export type BrandLedgerRun = z.infer<typeof BrandLedgerRunSchema>;

export const BrandLedgerRunsSchema = z
  .object({
    brandId: z.string(),
    before: z.string(),
    windowStart: z.string(),
    runs: z.array(BrandLedgerRunSchema),
    nextBefore: z.string(),
    nextBeforeId: z.string().nullable(),
    // runs-service v0.47.112: the tab asked and, on a first page, the 24 h window's counts per tab.
    kind: z.enum(["made", "running", "none"]).nullish(),
    counts: z
      .object({ since: z.string(), until: z.string(), all: z.number(), made: z.number(), running: z.number(), none: z.number() })
      .passthrough()
      .nullish(),
  })
  .passthrough();
export type BrandLedgerRuns = z.infer<typeof BrandLedgerRunsSchema>;

/** The cursor of one page of production orders: null = the newest page. */
export type LedgerRunsCursor = { before: string; beforeId: string | null } | null;

/** The production orders' tabs: all, or one part of runs-service's partition. */
export type LedgerRunsTab = "all" | "made" | "running" | "none";
export const LEDGER_RUNS_TABS: { key: LedgerRunsTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "made", label: "Made something" },
  { key: "running", label: "Running" },
  { key: "none", label: "Made none" },
];

/** The runs read's query string for one page of one tab. */
export function ledgerRunsQuery(cursor: LedgerRunsCursor, limit = 50, tab: LedgerRunsTab = "all"): string {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (tab !== "all") qs.set("kind", tab);
  if (cursor) {
    qs.set("before", cursor.before);
    if (cursor.beforeId) qs.set("beforeId", cursor.beforeId);
  }
  return qs.toString();
}

/** The next (older) page's cursor, as the producer served it. */
export function nextLedgerRunsCursor(page: BrandLedgerRuns): LedgerRunsCursor {
  return { before: page.nextBefore, beforeId: page.nextBeforeId };
}

/** A served decimal-cents string as a number of DOLLARS for a chart axis or a formatter (display only). */
export const centsToUsd = (cents: string): number => Number(cents) / 100;

/**
 * What a run made, in words, from served facts only: its outputs; else still open; else its support
 * function; else a free step of its caller (no cost row, a parent: a call made on another run's behalf,
 * e.g. one Google API request of a CRM sync); else it closed having made nothing.
 */
export type RunResult =
  | { kind: "made" }
  | { kind: "running" }
  | { kind: "support"; fn: string }
  | { kind: "step"; parent: string }
  | { kind: "none" };

export function runResult(run: Pick<BrandLedgerRun, "produced" | "status" | "supportKind" | "costRows" | "parent">): RunResult {
  if (run.produced.length > 0) return { kind: "made" };
  if (run.status === "running") return { kind: "running" };
  if (run.supportKind) return { kind: "support", fn: run.supportKind.replace(/_/g, " ") };
  if (run.costRows === 0 && run.parent) return { kind: "step", parent: `${run.parent.serviceName} · ${run.parent.taskName}` };
  return { kind: "none" };
}
