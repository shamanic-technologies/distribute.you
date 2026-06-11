import { readFileSync } from "node:fs";
import { join } from "node:path";
import { URLS } from "@distribute/content";

interface BestPublicMetric {
  workflowSlug: string;
  workflowName: string;
  createdForBrandId: string | null;
  value: number;
}

interface BestPublicResponse {
  best: Record<string, BestPublicMetric | null>;
}

interface RankedWorkflowItem {
  stats: Record<string, number | null>;
}

interface RankedWorkflowResponse {
  results: RankedWorkflowItem[];
}

interface LivePerformanceMetrics {
  costPerPositiveReplyLabel: string;
  costPerPositiveReplyNumeric: string;
  openRateLabel: string;
  openRateNumeric: string;
  positiveReplyRateLabel: string;
  positiveReplyRateNumeric: string;
  openedPerHundredLabel: string;
  openedPerHundredNumeric: string;
  positiveRepliesPerHundredLabel: string;
  positiveRepliesPerHundredNumeric: string;
  positiveRepliesPerHundredRangeLabel: string;
  positiveRepliesPerHundredBarNumeric: string;
  emailsSentLabel: string;
  emailsSentNumeric: string;
}

const SALES_COLD_EMAIL_FEATURE_SLUG = "sales-cold-email-outreach";
const BEST_POSITIVE_REPLY_KEY = "recipientsRepliesPositive";

// Last-known-good marketing numbers (the values these stats held before they
// were sourced live). Used only when the public metrics API is unreachable or
// transiently omits a field, so a build-time prerender never aborts the whole
// landing deploy and a page never ships raw __PLACEHOLDER__ tokens.
const FALLBACK_LIVE_PERFORMANCE_METRICS: LivePerformanceMetrics = {
  costPerPositiveReplyLabel: "$1.42",
  costPerPositiveReplyNumeric: "1.42",
  openRateLabel: "38%",
  openRateNumeric: "38",
  positiveReplyRateLabel: "2.1%",
  positiveReplyRateNumeric: "2.1",
  openedPerHundredLabel: "38",
  openedPerHundredNumeric: "38",
  positiveRepliesPerHundredLabel: "2",
  positiveRepliesPerHundredNumeric: "2.1",
  positiveRepliesPerHundredRangeLabel: "1-2",
  positiveRepliesPerHundredBarNumeric: "2.1",
  emailsSentLabel: "14k",
  emailsSentNumeric: "14000",
};
const BEST_POSITIVE_REPLY_COST_LABEL = "__BEST_POSITIVE_REPLY_COST__";
const BEST_POSITIVE_REPLY_COST_NUMERIC = "__BEST_POSITIVE_REPLY_COST_NUMERIC__";
const OPEN_RATE_LABEL = "__OPEN_RATE__";
const OPEN_RATE_NUMERIC = "__OPEN_RATE_NUMERIC__";
const POSITIVE_REPLY_RATE_LABEL = "__POSITIVE_REPLY_RATE__";
const POSITIVE_REPLY_RATE_NUMERIC = "__POSITIVE_REPLY_RATE_NUMERIC__";
const OPENED_PER_HUNDRED_LABEL = "__OPENED_PER_HUNDRED__";
const OPENED_PER_HUNDRED_NUMERIC = "__OPENED_PER_HUNDRED_NUMERIC__";
const POSITIVE_REPLIES_PER_HUNDRED_LABEL = "__POSITIVE_REPLIES_PER_HUNDRED__";
const POSITIVE_REPLIES_PER_HUNDRED_NUMERIC = "__POSITIVE_REPLIES_PER_HUNDRED_NUMERIC__";
const POSITIVE_REPLIES_PER_HUNDRED_RANGE_LABEL = "__POSITIVE_REPLIES_PER_HUNDRED_RANGE__";
const POSITIVE_REPLIES_PER_HUNDRED_BAR_NUMERIC = "__POSITIVE_REPLIES_PER_HUNDRED_BAR_NUMERIC__";
const EMAILS_SENT_LABEL = "__EMAILS_SENT__";
const EMAILS_SENT_NUMERIC = "__EMAILS_SENT_NUMERIC__";

function resolvePublicApiUrl(): string {
  return process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL ?? URLS.api;
}

function formatCostCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function num(stats: Record<string, number | null>, key: string): number {
  return stats[key] ?? 0;
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function formatCount(value: number): string {
  if (value < 1 && value > 0) return value.toFixed(1);
  return String(Math.round(value));
}

function formatCompactCount(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toLocaleString("en-US");
}

async function fetchLivePerformanceMetrics(): Promise<LivePerformanceMetrics> {
  const apiUrl = resolvePublicApiUrl();
  const headers = { Accept: "application/json" };
  const [bestRes, rankedRes] = await Promise.all([
    fetch(
      `${apiUrl}/v1/public/features/best?featureSlug=${encodeURIComponent(
        SALES_COLD_EMAIL_FEATURE_SLUG,
      )}&groupBy=workflow`,
      { headers, next: { revalidate: 300 } },
    ),
    fetch(
      `${apiUrl}/v1/public/features/ranked?featureSlug=${encodeURIComponent(
        SALES_COLD_EMAIL_FEATURE_SLUG,
      )}&objective=emailsSent&groupBy=workflow&limit=100`,
      { headers, next: { revalidate: 300 } },
    ),
  ]);

  if (!bestRes.ok) {
    throw new Error(
      `[landing] /v1/public/features/best failed for ${SALES_COLD_EMAIL_FEATURE_SLUG}: ${bestRes.status}`,
    );
  }
  if (!rankedRes.ok) {
    throw new Error(
      `[landing] /v1/public/features/ranked failed for ${SALES_COLD_EMAIL_FEATURE_SLUG}: ${rankedRes.status}`,
    );
  }

  const bestData = (await bestRes.json()) as BestPublicResponse;
  const rankedData = (await rankedRes.json()) as RankedWorkflowResponse;
  const record = bestData.best[BEST_POSITIVE_REPLY_KEY];

  if (!record || typeof record.value !== "number") {
    throw new Error(
      `[landing] Missing ${BEST_POSITIVE_REPLY_KEY} in /v1/public/features/best response`,
    );
  }

  const totals = rankedData.results.reduce(
    (acc, item) => {
      acc.sent += num(item.stats, "recipientsSent");
      acc.opened += num(item.stats, "recipientsOpened");
      acc.positiveReplies += num(item.stats, "recipientsRepliesPositive");
      return acc;
    },
    { sent: 0, opened: 0, positiveReplies: 0 },
  );

  if (totals.sent <= 0) {
    throw new Error(
      `[landing] /v1/public/features/ranked returned no sent recipients for ${SALES_COLD_EMAIL_FEATURE_SLUG}`,
    );
  }

  const dollars = record.value / 100;
  const openRate = totals.opened / totals.sent;
  const positiveReplyRate = totals.positiveReplies / totals.sent;
  const openedPerHundred = openRate * 100;
  const positiveRepliesPerHundred = positiveReplyRate * 100;
  const positiveRepliesRounded = Math.round(positiveRepliesPerHundred);
  const positiveRepliesRange =
    positiveRepliesRounded <= 1
      ? "1"
      : `${Math.max(1, positiveRepliesRounded - 1)}-${positiveRepliesRounded}`;

  return {
    costPerPositiveReplyLabel: formatCostCents(record.value),
    costPerPositiveReplyNumeric: dollars.toFixed(2),
    openRateLabel: formatPercent(openRate),
    openRateNumeric: (openRate * 100).toFixed(1),
    positiveReplyRateLabel: formatPercent(positiveReplyRate),
    positiveReplyRateNumeric: (positiveReplyRate * 100).toFixed(1),
    openedPerHundredLabel: formatCount(openedPerHundred),
    openedPerHundredNumeric: openedPerHundred.toFixed(1),
    positiveRepliesPerHundredLabel: formatCount(positiveRepliesPerHundred),
    positiveRepliesPerHundredNumeric: positiveRepliesPerHundred.toFixed(1),
    positiveRepliesPerHundredRangeLabel: positiveRepliesRange,
    positiveRepliesPerHundredBarNumeric: Math.max(1, positiveRepliesPerHundred).toFixed(1),
    emailsSentLabel: formatCompactCount(totals.sent),
    emailsSentNumeric: String(Math.round(totals.sent)),
  };
}

async function resolveLivePerformanceMetrics(): Promise<LivePerformanceMetrics> {
  try {
    return await fetchLivePerformanceMetrics();
  } catch (error) {
    // Build-time prerender must stay shippable: a missing/transient public
    // metric (the public best endpoint occasionally omits a key while a
    // workflow has no data for it) must not abort the entire landing deploy.
    // Log loud and fall back to the last-known-good numbers. (CLAUDE.md
    // "Exception — Vercel build-time prerender")
    console.error(
      "[landing] live performance metrics unavailable, using fallback values",
      error,
    );
    return FALLBACK_LIVE_PERFORMANCE_METRICS;
  }
}

export function staticV2Html(fileName: string) {
  const html = readFileSync(
    join(process.cwd(), "public/landing-v2", fileName),
    "utf8",
  );

  return html
    .replaceAll('href="css/', 'href="/landing-v2/css/')
    .replaceAll('src="js/', 'src="/landing-v2/js/')
    .replaceAll('src="logo/logo-distribute-2.svg"', 'src="logo/logo-distribute.svg"')
    .replaceAll('src="logo/', 'src="/landing-v2/logo/')
    .replaceAll('href="index.html"', 'href="/"')
    .replaceAll('href="v2.html"', 'href="/"')
    .replaceAll('href="/docs/api"', `href="${URLS.apiDocs}"`)
    .replaceAll('href="/docs/mcp"', `href="${URLS.mcp}"`)
    .replaceAll('href="/docs"', `href="${URLS.docs}"`)
    .replaceAll('href="/sign-in"', `href="${URLS.signIn}"`)
    .replaceAll('href="/sign-up"', `href="${URLS.signUp}"`)
    .replaceAll('href="https://app.distribute.you/sign-up"', `href="${URLS.signUp}"`)
    .replaceAll(
      'href="https://github.com/distribute-you"',
      `href="${URLS.github}"`,
    );
}

async function withLivePerformanceMetrics(html: string) {
  if (
    !html.includes(BEST_POSITIVE_REPLY_COST_LABEL) &&
    !html.includes(OPEN_RATE_LABEL) &&
    !html.includes(POSITIVE_REPLY_RATE_LABEL) &&
    !html.includes("$1.42")
  ) {
    return html;
  }

  const liveMetrics = await resolveLivePerformanceMetrics();

  return html
    .replaceAll(BEST_POSITIVE_REPLY_COST_NUMERIC, liveMetrics.costPerPositiveReplyNumeric)
    .replaceAll(BEST_POSITIVE_REPLY_COST_LABEL, liveMetrics.costPerPositiveReplyLabel)
    .replaceAll(OPEN_RATE_NUMERIC, liveMetrics.openRateNumeric)
    .replaceAll(OPEN_RATE_LABEL, liveMetrics.openRateLabel)
    .replaceAll(POSITIVE_REPLY_RATE_NUMERIC, liveMetrics.positiveReplyRateNumeric)
    .replaceAll(POSITIVE_REPLY_RATE_LABEL, liveMetrics.positiveReplyRateLabel)
    .replaceAll(OPENED_PER_HUNDRED_NUMERIC, liveMetrics.openedPerHundredNumeric)
    .replaceAll(OPENED_PER_HUNDRED_LABEL, liveMetrics.openedPerHundredLabel)
    .replaceAll(POSITIVE_REPLIES_PER_HUNDRED_NUMERIC, liveMetrics.positiveRepliesPerHundredNumeric)
    .replaceAll(POSITIVE_REPLIES_PER_HUNDRED_LABEL, liveMetrics.positiveRepliesPerHundredLabel)
    .replaceAll(POSITIVE_REPLIES_PER_HUNDRED_RANGE_LABEL, liveMetrics.positiveRepliesPerHundredRangeLabel)
    .replaceAll(POSITIVE_REPLIES_PER_HUNDRED_BAR_NUMERIC, liveMetrics.positiveRepliesPerHundredBarNumeric)
    .replaceAll(EMAILS_SENT_NUMERIC, liveMetrics.emailsSentNumeric)
    .replaceAll(EMAILS_SENT_LABEL, liveMetrics.emailsSentLabel)
    .replaceAll("data-n=\"1.42\"", `data-n="${liveMetrics.costPerPositiveReplyNumeric}"`)
    .replaceAll("$1.42", liveMetrics.costPerPositiveReplyLabel);
}

export async function staticV2Response(fileName: string) {
  const html = await withLivePerformanceMetrics(staticV2Html(fileName));

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "s-maxage=300, stale-while-revalidate=31536000",
    },
  });
}
