import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  INDEX_LINKS_TOKEN,
  RENAMED_INDEX_SLUGS,
  formatIndexValue,
  indexLinksHtml,
  parseIndexDetail,
  parseIndexList,
  unavailableLine,
  type IndexDetail,
  type IndexList,
  type IndexPoint,
  type IndexSummary,
} from "../../src/lib/fleet-indexes";
import { basisLegendHtml, chartDomain, chartHtml, historyTableHtml, renderIndexListPage, renderIndexPage, ribbonHtml } from "../../src/lib/pages/indexes";
import { footer } from "../../src/lib/v2-shell";
import { withSiteChrome } from "../../src/lib/site-chrome";

/**
 * The public fleet indexes (owner 2026-10-18): one page per served index, its value
 * large and its daily series drawn in the hero, a list page, and a footer column.
 * Everything is read from the served list; nothing here names a slug the pages need.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

const RULE = { signalMinOutcomes: 10, robustMinOutcomes: 30 };

function summary(over: Partial<IndexSummary> = {}): IndexSummary {
  return {
    slug: "cold-email-cost-per-click",
    name: "Distribute.you Cost Per Click Index",
    channelSlug: "sales-cold-email-outreach",
    channelName: "Sales Cold Email Outreach",
    outcome: "website_visit",
    metric: "cost_per_outcome",
    unit: "usd",
    valuePer: "per website visit",
    method: "What our best proven cold email workflow spends to bring one person to a client's website.",
    day: "2026-10-18",
    value: 4.3512,
    status: "robust",
    outcomes: 42,
    contacted: 2019,
    workflowDynastySlug: "w",
    workflowDynastyName: "Sienna",
    unavailableReason: null,
    recordedAt: "2026-10-18T14:00:00.000Z",
    ...over,
  };
}

function point(day: string, value: number | null, over: Partial<IndexPoint> = {}): IndexPoint {
  return { day, value, status: "robust", outcomes: 42, contacted: 2019, workflowDynastyName: "Sienna", unavailableReason: null, ...over };
}

const LIST: IndexList = {
  statusRule: RULE,
  indexes: [summary(), summary({ slug: "cold-email-click-rate", name: "Distribute.you Click Rate Index", unit: "percent", value: 2.0812, valuePer: "of people emailed" })],
};

describe("values are formatted, never shown raw", () => {
  it("dollars and percents", () => {
    expect(formatIndexValue(4.3512, "usd")).toBe("$4.35");
    expect(formatIndexValue(1240.4, "usd")).toBe("$1,240");
    expect(formatIndexValue(2.0812, "percent")).toBe("2.08%");
  });

  it("a null value reads as a sentence, never $0 or NaN", () => {
    const html = renderIndexPage(
      "cold-email-cost-per-meeting",
      { statusRule: RULE, index: summary({ value: null, status: "noise", unavailableReason: "no_mature_workflow", day: null }), points: [] },
      LIST,
    );
    const hero = html.slice(html.indexOf('class="ix-hero"'), html.indexOf('id="measures"'));
    expect(hero).toContain(unavailableLine("no_mature_workflow"));
    expect(hero).not.toMatch(/\$0\b|NaN|undefined|null/);
  });
});

describe("the served contract is read strictly", () => {
  it("parses the list and a series", () => {
    expect(parseIndexList(LIST).indexes).toHaveLength(2);
    const detail = parseIndexDetail({ statusRule: RULE, index: summary(), points: [point("2026-10-18", 4.35)] });
    expect(detail.points[0].value).toBe(4.35);
  });

  it("refuses a status or a unit it does not know", () => {
    expect(() => parseIndexList({ statusRule: RULE, indexes: [summary({ status: "great" as never })] })).toThrow();
    expect(() => parseIndexList({ statusRule: RULE, indexes: [summary({ unit: "eur" as never })] })).toThrow();
    expect(() => parseIndexList({ indexes: [] })).toThrow();
  });
});

describe("the chart grows from one day", () => {
  it("one day draws a full-width level line ending on today's dot", () => {
    const html = chartHtml([point("2026-10-18", 4.35)], "usd", "x");
    expect(html).toContain('d="M0.0 150.0 L1000.0 150.0"');
    expect(html).toContain("ix-pt ix-pt-now");
    expect(html).toContain("First recorded Oct 18, 2026");
    expect(html).not.toContain("NaN");
  });

  it("several days spread over the width, and a null day breaks the line", () => {
    const html = chartHtml(
      [point("2026-10-18", 4), point("2026-10-19", null), point("2026-10-20", 5), point("2026-10-21", 4.5)],
      "usd",
      "x",
    );
    expect(html.match(/class="ix-line"/g)).toHaveLength(2);
    expect(html.match(/class="ix-pt/g)).toHaveLength(3);
    expect(html).not.toContain("NaN");
  });

  it("a flat series sits mid-height, never on an edge", () => {
    expect(chartDomain([2, 2])).toEqual({ lo: 1, hi: 3 });
  });

  it("the ribbon says every day while no day is missed", () => {
    expect(ribbonHtml([point("2026-10-18", 4)])).toContain("Published every day since Oct 18, 2026. 1 day so far.");
    expect(ribbonHtml([point("2026-10-18", 4), point("2026-10-20", 4)])).toContain("Published on 2 of the 3 days since Oct 18, 2026.");
  });
});

describe("the pages", () => {
  const detail: IndexDetail = { statusRule: RULE, index: summary(), points: [point("2026-10-18", 4.3512)] };
  const page = renderIndexPage("cold-email-cost-per-click", detail, LIST);

  it("the hero is the index: value, unit, status, chart", () => {
    const hero = page.slice(page.indexOf('class="ix-hero"'), page.indexOf('id="measures"'));
    expect(hero).toContain('<div class="ix-value" data-motion="count-up">$4.35</div>');
    expect(hero).toContain("per website visit");
    expect(hero).toContain("Robust");
    expect(hero).toContain("ix-chart");
  });

  it("states what it measures, its status and when; never the workflow nor the outcome volume (owner 2026-10-18)", () => {
    expect(page).not.toContain("Sienna");
    expect(page).not.toMatch(/2,019|42 website visits|people emailed\./);
    expect(page.match(/Robust: built on 30\+ outcomes\./g)).toHaveLength(1);
    expect(page).toContain("Oct 18, 2026");
  });

  it("links every other index, and ends on the usual CTA", () => {
    expect(page).toContain('href="/indexes/cold-email-click-rate"');
    expect(page).toContain("cta-box");
  });

  it("the status legend states each range once", () => {
    const legend = renderIndexListPage(LIST, new Map()).match(/<p class="ix-rule"[^>]*>([^<]*)</)![1];
    expect(legend).toBe("Robust: 30+ outcomes. Signal: 10 to 29. Early read: under 10, published anyway.");
  });

  it("the list links every served index with its value", () => {
    const list = renderIndexListPage(LIST, new Map());
    expect(list).toContain('href="/indexes/cold-email-cost-per-click"');
    expect(list).toContain("$4.35");
    expect(list).toContain("2.08%");
  });

  it("a failed read says so", () => {
    expect(renderIndexListPage(null, new Map())).toContain("could not be read just now");
    expect(renderIndexPage("cold-email-x", null, null)).toContain("could not be read just now");
  });

  it("no em dash, never an agency", () => {
    for (const full of [page, renderIndexListPage(LIST, new Map())]) {
      const html = full.slice(0, full.indexOf("<footer>"));
      expect(html).not.toContain(String.fromCharCode(0x2014));
      expect(html.toLowerCase()).not.toContain("agency");
    }
  });
});

describe("the footer links every index on all three footers", () => {
  it("rendered footer and homepage carry the column and its live slot", () => {
    for (const html of [
      footer(),
      withSiteChrome(read("public/landing/index-v2.html"), "/"),
      withSiteChrome(read("public/landing/index-v2-subscription.html"), "/"),
    ]) {
      expect(html).toContain(`<h4>Indexes</h4><ul>${INDEX_LINKS_TOKEN}<li><a href="/indexes">All indexes</a></li></ul>`);
    }
  });

  it("the slot fills from the served list, and stays empty on a failed read", () => {
    expect(indexLinksHtml(LIST)).toBe(
      '<li><a href="/indexes/cold-email-cost-per-click">Distribute.you Cost Per Click Index</a></li><li><a href="/indexes/cold-email-click-rate">Distribute.you Click Rate Index</a></li>',
    );
    expect(indexLinksHtml(null)).toBe("");
  });

  it("the React footer reads the same list", () => {
    const src = read("src/components/footer.tsx");
    expect(src).toContain("fetchIndexList(");
    expect(src).toContain("c.indexLinks");
  });
});

describe("the first slugs redirect to their renamed pages (2026-10-19)", () => {
  it("each old slug points at a cold-email slug, permanently, only once the service forgot it", () => {
    for (const [from, to] of Object.entries(RENAMED_INDEX_SLUGS)) {
      expect(from).toMatch(/^sceo-/);
      expect(to).toMatch(/^cold-email-[a-z-]+$/);
    }
    const src = read("src/app/indexes/[slug]/route.ts");
    const branch = src.slice(src.indexOf('if (detail === "not_found")'), src.indexOf("return renderedResponse(renderIndexPage"));
    expect(branch).toContain("RENAMED_INDEX_SLUGS[slug]");
    expect(branch).toContain("status: 301");
    expect(branch).toContain("Location: `/indexes/${renamed}`");
  });
});

describe("an index page is built to be found (2026-10-19)", () => {
  const detail: IndexDetail = {
    statusRule: RULE,
    index: summary({ day: "2026-10-19" }),
    points: [point("2026-10-18", 4.1), point("2026-10-19", 4.3512, { status: "signal" })],
  };
  const page = renderIndexPage("cold-email-cost-per-click", detail, LIST);
  const ld = [...page.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const dataset = ld.find((n) => n["@type"] === "Dataset");

  it("the title carries today's value and the search words", () => {
    expect(page).toContain("<title>Distribute.you Cost Per Click Index: $4.35 per website visit | Cold email benchmark</title>");
  });

  it("every recorded day is in a text table, newest first", () => {
    const table = page.slice(page.indexOf('id="history"'), page.indexOf('id="why"'));
    expect(table.indexOf("Oct 19, 2026")).toBeGreaterThan(-1);
    expect(table.indexOf("Oct 19, 2026")).toBeLessThan(table.indexOf("Oct 18, 2026"));
    expect(table).toContain("<td>$4.10</td>");
    expect(historyTableHtml([], "usd", "x")).toBe("");
  });

  it("the Dataset node says what is measured, in what unit, and when", () => {
    expect(dataset.variableMeasured).toMatchObject({ "@type": "PropertyValue", unitText: "USD", value: 4.3512 });
    expect(dataset).toMatchObject({ datePublished: "2026-10-18", dateModified: "2026-10-19", temporalCoverage: "2026-10-18/2026-10-19" });
    expect(dataset.includedInDataCatalog.url).toBe("https://distribute.you/indexes");
    expect(dataset.keywords).toContain("cold email");
  });
});

describe("rebuilt days read apart from the days we published live (INDEX-HISTORY-BACKFILL-1019)", () => {
  const rule = { recorded: "Recorded live that day.", recomputed: "Rebuilt later as of that day." };
  const pts: IndexPoint[] = [
    ...Array.from({ length: 40 }, (_, k) => point(`2026-09-${String(k < 30 ? k + 1 : 30).padStart(2, "0")}`, 5 + k / 10, { basis: "recomputed" })).slice(0, 30),
    ...Array.from({ length: 17 }, (_, k) => point(`2026-10-${String(k + 1).padStart(2, "0")}`, 5, { basis: "recomputed" })),
    point("2026-10-18", 4.1, { basis: "recorded" }),
    point("2026-10-19", 4.3, { basis: "recorded" }),
  ];
  const detail = parseIndexDetail({ statusRule: RULE, index: summary({ day: "2026-10-19" }), points: pts, basisRule: rule });
  const page = renderIndexPage("cold-email-cost-per-click", detail, LIST);

  it("the served rule is read, an unknown basis refused", () => {
    expect(detail.basisRule).toEqual(rule);
    expect(() => parseIndexDetail({ statusRule: RULE, index: summary(), points: [point("2026-10-18", 1, { basis: "guess" as never })] })).toThrow();
  });

  it("rebuilt days are a dashed line with no dots, labelled in the service's words", () => {
    const chart = chartHtml(detail.points, "usd", "x");
    expect(chart.match(/class="ix-line ix-line-re"/g)).toHaveLength(1);
    expect(chart.match(/class="ix-pt/g)).toHaveLength(2);
    expect(page).toContain(rule.recomputed);
    expect(basisLegendHtml([point("2026-10-18", 1, { basis: "recorded" })], rule)).toBe("");
  });

  it("the ribbon counts live days and names the rebuilt ones", () => {
    expect(ribbonHtml(detail.points)).toContain("Published every day since Oct 18, 2026. 47 earlier days rebuilt, back to Sep 1, 2026.");
  });

  it("the table keeps a month in view and folds the rest, sources marked", () => {
    const table = page.slice(page.indexOf('id="history"'), page.indexOf('id="why"'));
    expect(table).toContain("<summary>19 earlier days</summary>");
    expect(table).toContain("<td>Recorded live</td>");
    expect(table).toContain("<td>Rebuilt later</td>");
  });

  it("the dataset is published from its first live day", () => {
    const ds = [...page.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1])).find((n) => n["@type"] === "Dataset");
    expect(ds).toMatchObject({ datePublished: "2026-10-18", temporalCoverage: "2026-09-01/2026-10-19" });
  });
});

describe("a return index reads like the hero ROI (cold-email-roi, 2026-10-19)", () => {
  const roi = summary({ slug: "cold-email-roi", name: "Cold Email ROI Index", unit: "multiple", value: 3.62, valuePer: "back per dollar spent, median of our clients" });

  it("the list accepts the unit instead of failing every page", () => {
    expect(parseIndexList({ statusRule: RULE, indexes: [summary(), roi] }).indexes[1].unit).toBe("multiple");
    expect(() => parseIndexList({ statusRule: RULE, indexes: [summary({ unit: "euro" as never })] })).toThrow();
  });

  it("value, ticks, table and JSON-LD speak in x", () => {
    expect(formatIndexValue(3.62, "multiple")).toBe("3.6x");
    expect(formatIndexValue(18.3, "multiple")).toBe("18x");
    const page = renderIndexPage("cold-email-roi", { statusRule: RULE, index: roi, points: [point("2026-10-18", 3.4), point("2026-10-19", 3.62)] }, LIST);
    expect(page).toContain('<div class="ix-value" data-motion="count-up">3.6x</div>');
    expect(page).toContain("<td>3.4x</td>");
    expect(page).not.toMatch(/\$3\.6/);
    const ds = [...page.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1])).find((n) => n["@type"] === "Dataset");
    expect(ds.variableMeasured.unitText).toBe("multiple of spend");
  });
});

describe("an expected value says so wherever it prints (MEETING-INDEX-EXPECTED-LABEL-1025)", () => {
  // 2026-10-25: the cost ledger is being rebuilt; features-service serves the meeting
  // index's expected price meanwhile, flagged `valueKind: "expected"` on the summary and
  // on every point. A visitor must never read it as a measured price.
  const meeting = summary({
    slug: "cold-email-cost-per-meeting", name: "Cold Email Cost Per Meeting Index", value: 794.12, valuePer: "per meeting booked", valueKind: "expected",
  });
  const points = [point("2026-10-24", 794.12, { valueKind: "expected" }), point("2026-10-25", 794.12, { valueKind: "expected" })];

  it("reads the field, and refuses a kind it does not know", () => {
    expect(parseIndexList({ statusRule: RULE, indexes: [meeting] }).indexes[0].valueKind).toBe("expected");
    expect(parseIndexDetail({ statusRule: RULE, index: meeting, points }).points[0].valueKind).toBe("expected");
    expect(() => parseIndexList({ statusRule: RULE, indexes: [summary({ valueKind: "guessed" as never })] })).toThrow();
    expect(() => parseIndexDetail({ statusRule: RULE, index: summary(), points: [point("2026-10-25", 1, { valueKind: "guessed" as never })] })).toThrow();
  });

  it("the index page labels the value, its title, the chart and every day of the table", () => {
    const page = renderIndexPage(meeting.slug, { statusRule: RULE, index: meeting, points }, LIST);
    expect(page).toContain('<div class="ix-value" data-motion="count-up">$794.12</div>');
    expect(page).toContain('<span class="ix-expected">Expected</span>');
    expect(page).toContain("<title>Cold Email Cost Per Meeting Index: $794.12 expected per meeting booked");
    expect(page).toContain("<td>$794.12 expected</td>");
    expect(page).toContain('title="Oct 25, 2026: $794.12 expected"');
    expect(page).not.toContain("$0");
  });

  it("the list labels the row", () => {
    const page = renderIndexListPage({ statusRule: RULE, indexes: [meeting, summary()] }, new Map());
    expect(page.match(/class="ix-expected"/g)).toHaveLength(1);
  });

  it("an absent kind reads as measured: no label anywhere", () => {
    const plain = summary({ value: 457.2 });
    const page = renderIndexPage(plain.slug, { statusRule: RULE, index: plain, points: [point("2026-10-25", 457.2)] }, LIST);
    expect(page).not.toContain("ix-expected\">");
    expect(page).not.toMatch(/\d expected/);
    expect(renderIndexListPage(LIST, new Map())).not.toContain('class="ix-expected"');
    expect(summary({ valueKind: "measured" }).valueKind).toBe("measured");
    expect(renderIndexPage(plain.slug, { statusRule: RULE, index: summary({ valueKind: "measured" }), points: [] }, LIST)).not.toContain('class="ix-expected"');
  });

  it("a null value stays words, the recompute said plainly", () => {
    const page = renderIndexPage(meeting.slug, { statusRule: RULE, index: { ...meeting, value: null, valueKind: undefined, unavailableReason: "ledger_being_recomputed" }, points: [] }, LIST);
    expect(page).toContain("Our cost records are being rebuilt.");
    expect(page).not.toContain('class="ix-value"');
  });
});
