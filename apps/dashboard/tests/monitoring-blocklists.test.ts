import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DomainBlocklistSchema,
  LeadSourceYieldSchema,
  blocklistCharts,
  ratePct,
  removalAttemptDetail,
  requestedLists,
  servesFailed,
  sortDomains,
  sortEvents,
  sourceLabel,
  yieldCharts,
  type DomainBlocklist,
} from "../src/lib/monitoring/blocklists";

const src = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", `${name}-prod-2026-10-19.json`), "utf8"));
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const blocklist = () => DomainBlocklistSchema.parse(fixture("ops-domain-blocklist"));
const yieldRead = () => LeadSourceYieldSchema.parse(fixture("ops-lead-source-yield"));

describe("Monitoring > Blocklists: instantly-service's reads parse as served in prod (2026-10-19, days=90)", () => {
  it("the whole domain-blocklist payload parses (59 domains, 12 listed, 40 events, 90 days)", () => {
    const d = blocklist();
    expect(d.domains.length).toBe(59);
    expect(d.domains.filter((x) => x.listed).length).toBe(12);
    expect(d.events.length).toBe(40);
    expect(d.series.days.length).toBe(90);
    expect(d.lists.map((l) => l.key)).toEqual(["surbl", "spamhaus_dbl", "uribl"]);
  });

  it("the whole lead-source-yield payload parses, per_tag", () => {
    const y = yieldRead();
    expect(y.countingRule).toBe("per_tag");
    expect(y.total.firstEmails).toBe(61644);
    expect(y.sources.length).toBe(9);
  });
});

describe("Blocklist charts read the served series", () => {
  it("a null point (before the first check) draws no bar, never a zero", () => {
    const charts = blocklistCharts(blocklist());
    const listed = charts.find((c) => c.id === "domainsListed")!;
    expect(listed.series[0]).toEqual({ day: "2026-07-22", parts: null });
    expect(listed.series.filter((p) => p.parts === null).length).toBe(86);
    expect(charts.find((c) => c.id === "mailboxesOut")!.series[0].parts).toBeNull();
  });

  it("each headline is the latest served point as served", () => {
    const by = Object.fromEntries(blocklistCharts(blocklist()).map((c) => [c.id, c.now]));
    expect(by.domainsListed).toBe("12");
    expect(by.mailboxesOut).toBe("45");
    expect(by.sendsFromListed).toBe("185");
    expect(by.blocklistBounces).toBe("1");
    expect(by.removalRequests).toBe("0 sent, 1 failed");
    expect(by.delistings).toBe("0");
  });

  it("the failed removal series is drawn only when every point serves it", () => {
    const d = blocklist();
    expect(servesFailed(d.series.removalRequests)).toBe(true);
    const removal = (x: DomainBlocklist) => blocklistCharts(x).find((c) => c.id === "removalRequests")!;
    expect(removal(d).legend.map((l) => l.label)).toContain("Failed");
    const partial: DomainBlocklist = {
      ...d,
      series: { ...d.series, removalRequests: d.series.removalRequests.map((p, i) => (i === 0 ? { day: p.day, linksIssued: p.linksIssued, requested: p.requested } : p)) },
    };
    expect(servesFailed(partial.series.removalRequests)).toBe(false);
    expect(removal(partial).legend.map((l) => l.label)).not.toContain("Failed");
    expect(removal(partial).now).toBe("0 sent");
  });

  it("names the bounce series' spamhaus key by the list's served name", () => {
    const bounces = blocklistCharts(blocklist()).find((c) => c.id === "blocklistBounces")!;
    expect(bounces.legend.map((l) => l.label)).toEqual(["SURBL", "Spamhaus DBL", "URIBL", "Other list"]);
  });
});

describe("Domains and History helpers", () => {
  it("listed domains come first, then by name", () => {
    const sorted = sortDomains(blocklist().domains);
    expect(sorted.slice(0, 12).every((d) => d.listed)).toBe(true);
    expect(sorted.slice(12).every((d) => !d.listed)).toBe(true);
  });

  it("history is newest first", () => {
    const e = sortEvents(blocklist().events);
    expect(e[0].occurredAt >= e[e.length - 1].occurredAt).toBe(true);
  });

  it("an automated SURBL attempt carries its reason or the list's answer", () => {
    const d = blocklist();
    const failed = d.events.find((e) => e.type === "removal_failed")!;
    expect(removalAttemptDetail(failed)?.error).toBe("no recent email from this domain to show");
    const sent = d.events.find((e) => e.type === "removal_requested")!;
    expect(removalAttemptDetail(sent)?.answer).toMatch(/^250 /);
    const listed = d.events.find((e) => e.type === "listed")!;
    expect(removalAttemptDetail(listed)).toBeNull();
  });

  it("requestedLists only counts recorded removal requests for that domain", () => {
    const d = blocklist();
    const sent = d.events.find((e) => e.type === "removal_requested")!;
    expect(requestedLists(d, sent.domain).has(sent.list)).toBe(true);
    expect(requestedLists(d, "no-such-domain.test").size).toBe(0);
  });
});

describe("Lead-source yield", () => {
  it("headlines are the served total, never the per_tag stack", () => {
    const y = yieldRead();
    const first = yieldCharts(y).find((c) => c.id === "firstEmails")!;
    const last = y.series.firstEmails[y.series.firstEmails.length - 1];
    expect(first.now).toBe(last.total.toLocaleString("en-US"));
    expect(yieldCharts(y).length).toBe(5);
  });

  it("names a source tag plainly and keeps pseudo keys verbatim", () => {
    expect(sourceLabel("sourcing-apollo-cold-filters")).toBe("Apollo cold filters");
    const legend = yieldCharts(yieldRead())[0].legend.map((l) => l.label);
    expect(legend).toContain("(no source recorded)");
  });

  it("formats a served fraction as a whole %, a decimal only below 1%", () => {
    expect(ratePct(0.0499)).toBe("5%");
    expect(ratePct(0.0074)).toBe("0.7%");
    expect(ratePct(0.0001)).toBe("<0.1%");
    expect(ratePct(0)).toBe("0%");
    expect(ratePct(null)).toBeNull();
  });
});

describe("Blocklists page source guards", () => {
  const page = stripComments(src("components/v2/monitoring-blocklists.tsx"));
  it("exports the page, sums nothing, and promises its strings", () => {
    expect(page).toContain("export function BlocklistsPage({ base }: { base: string })");
    expect(page).not.toContain("reduce(");
    for (const s of ["Check now", "I filed it", "Filed by us, weekly", "Requested", "Monitored since", "Not checked", "Which lead source feeds us dead addresses and spam traps"]) {
      expect(page).toContain(s);
    }
  });
  it("re-reads after each write and never prints the producer's error text", () => {
    expect(page.match(/refetchQueries\(\{ queryKey: \["staffDomainBlocklist"\] \}\)/g)?.length).toBe(2);
    expect(page).not.toMatch(/err\.message|String\(err\)/);
  });
  it("no em or en dash in copy, no raw greys", () => {
    expect(page).not.toMatch(/[–—]/);
    expect(page).not.toMatch(/text-gray-|bg-brand-50|rounded-lg border/);
  });
});
