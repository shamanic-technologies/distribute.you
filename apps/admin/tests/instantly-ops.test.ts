import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  appendPage,
  buildMessagesQuery,
  buildThreadsQuery,
  dnsBadges,
  dnsErrorCount,
  formatCents,
  formatPct,
  hasActiveFilters,
  INBOX_DIRECTIONS,
  INBOX_LIMIT_MAX,
  INBOX_LIMIT_MIN,
  INBOX_PAGE_SIZE,
  isEstimate,
  lifecycleLabel,
  messageKindLabel,
  PAID_TO_DATE_NOTE,
  paidToDateQualifier,
  poolLabel,
  rampReaches,
  threadReadingOrder,
} from "@/lib/instantly-ops";
import type { OpsDns } from "@/lib/api";

/**
 * Real unit tests — `lib/instantly-ops.ts` carries no runtime `@` import, so it
 * is callable here rather than read as a string.
 */

// ---------------------------------------------------------------------------
// Filters → query string
// ---------------------------------------------------------------------------

function parse(q: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(q).entries());
}

describe("buildThreadsQuery", () => {
  it("ALWAYS sets limit — it is required downstream and a missing one is a 400", () => {
    expect(parse(buildThreadsQuery({})).limit).toBe(String(INBOX_PAGE_SIZE));
    expect(parse(buildThreadsQuery({}, { limit: 25 })).limit).toBe("25");
  });

  it("sits inside the producer's own limit bounds by default", () => {
    expect(INBOX_PAGE_SIZE).toBeGreaterThanOrEqual(INBOX_LIMIT_MIN);
    expect(INBOX_PAGE_SIZE).toBeLessThanOrEqual(INBOX_LIMIT_MAX);
  });

  it("OMITS a blank or whitespace-only filter rather than sending an empty value", () => {
    const q = parse(buildThreadsQuery({ account: "", domain: "   ", mailbox: "a@b.com" }));
    expect(q.account).toBeUndefined();
    expect(q.domain).toBeUndefined();
    expect(q.mailbox).toBe("a@b.com");
  });

  it("trims a filter, so the same intent produces the same cache key", () => {
    expect(buildThreadsQuery({ domain: " example.com " })).toBe(
      buildThreadsQuery({ domain: "example.com" }),
    );
  });

  it("carries every shared filter the producer accepts", () => {
    const q = parse(
      buildThreadsQuery({
        kind: "outreach",
        direction: "in",
        account: "a@b.com",
        mailbox: "m@b.com",
        domain: "b.com",
        counterparty: "p@c.com",
        orgId: "org-1",
        campaignId: "camp-1",
        since: "2026-09-01",
        until: "2026-09-18",
        placement: "inbox",
      }),
    );
    expect(q).toMatchObject({
      kind: "outreach",
      direction: "in",
      account: "a@b.com",
      mailbox: "m@b.com",
      domain: "b.com",
      counterparty: "p@c.com",
      orgId: "org-1",
      campaignId: "camp-1",
      since: "2026-09-01",
      until: "2026-09-18",
      placement: "inbox",
    });
  });

  it("sends hasInbound as the literal true/false the producer validates, and omits it when unset", () => {
    expect(parse(buildThreadsQuery({ hasInbound: true })).hasInbound).toBe("true");
    expect(parse(buildThreadsQuery({ hasInbound: false })).hasInbound).toBe("false");
    expect(parse(buildThreadsQuery({})).hasInbound).toBeUndefined();
  });

  it("only ever sends a direction the producer accepts", () => {
    for (const d of INBOX_DIRECTIONS) {
      expect(parse(buildThreadsQuery({ direction: d })).direction).toBe(d);
    }
  });

  it("carries the cursor when paging and omits it on page one", () => {
    expect(parse(buildThreadsQuery({}, { cursor: "abc" })).cursor).toBe("abc");
    expect(parse(buildThreadsQuery({}, { cursor: null })).cursor).toBeUndefined();
    expect(parse(buildThreadsQuery({}, { cursor: "" })).cursor).toBeUndefined();
  });

  it("URL-encodes a value rather than pasting it raw", () => {
    expect(buildThreadsQuery({ counterparty: "a b+c@d.com" })).toContain(
      "counterparty=a+b%2Bc%40d.com",
    );
  });
});

describe("buildMessagesQuery", () => {
  it("does NOT forward hasInbound — the producer drops it on /messages, so sending it would split the cache on a value that changes no answer", () => {
    expect(parse(buildMessagesQuery({ hasInbound: true })).hasInbound).toBeUndefined();
  });

  it("forwards threadId, which is the messages-only filter", () => {
    expect(parse(buildMessagesQuery({ threadId: "t-1" })).threadId).toBe("t-1");
    expect(parse(buildMessagesQuery({ threadId: "  " })).threadId).toBeUndefined();
  });

  it("still always sets limit", () => {
    expect(parse(buildMessagesQuery({}, { limit: 200 })).limit).toBe("200");
  });
});

describe("hasActiveFilters", () => {
  it("is false for an empty set and for blank values", () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ domain: "", account: "  " })).toBe(false);
  });
  it("is true for any set filter, hasInbound included", () => {
    expect(hasActiveFilters({ domain: "b.com" })).toBe(true);
    expect(hasActiveFilters({ hasInbound: false })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Thread display
// ---------------------------------------------------------------------------

describe("threadReadingOrder", () => {
  const msg = (id: string, occurredAt: string) => ({ id, occurredAt });

  it("reverses the producer's newest-first list so a thread reads in the order it happened", () => {
    const wire = [
      msg("c", "2026-09-18T10:00:00.000Z"),
      msg("b", "2026-09-17T10:00:00.000Z"),
      msg("a", "2026-09-16T10:00:00.000Z"),
    ];
    expect(threadReadingOrder(wire).map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("breaks a tie on the id, so two messages at the same instant cannot swap between polls", () => {
    const same = "2026-09-18T10:00:00.000Z";
    const first = threadReadingOrder([msg("b", same), msg("a", same)]).map((m) => m.id);
    const second = threadReadingOrder([msg("a", same), msg("b", same)]).map((m) => m.id);
    expect(first).toEqual(["a", "b"]);
    expect(second).toEqual(first);
  });

  it("does not mutate the array it was given", () => {
    const wire = [msg("b", "2026-09-18T10:00:00.000Z"), msg("a", "2026-09-17T10:00:00.000Z")];
    threadReadingOrder(wire);
    expect(wire.map((m) => m.id)).toEqual(["b", "a"]);
  });
});

describe("appendPage", () => {
  const row = (threadId: string) => ({ threadId });
  const idOf = (r: { threadId: string }) => r.threadId;

  it("appends a page to what is already on screen", () => {
    const out = appendPage([row("a"), row("b")], [row("c")], idOf);
    expect(out.map(idOf)).toEqual(["a", "b", "c"]);
  });

  it("drops a row the list already holds — the producer pages over a MOVING index, so a row whose activity advances can come back on a later page", () => {
    const out = appendPage([row("a"), row("b")], [row("b"), row("c")], idOf);
    expect(out.map(idOf)).toEqual(["a", "b", "c"]);
  });

  it("keeps the FIRST occurrence, so a position the reader scrolled past never shifts", () => {
    const first = { threadId: "a", subject: "original" };
    const later = { threadId: "a", subject: "moved" };
    const out = appendPage([first], [later], (r) => r.threadId);
    expect(out).toHaveLength(1);
    expect(out[0].subject).toBe("original");
  });

  it("does not mutate the existing list", () => {
    const existing = [row("a")];
    appendPage(existing, [row("b")], idOf);
    expect(existing).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Estimate labelling
// ---------------------------------------------------------------------------

describe("paid-to-date is labelled an ESTIMATE, never presented as a charge", () => {
  const paid = (source: string) => ({
    cents: 1467,
    currency: "USD",
    source,
    since: "2026-09-13T11:20:16.596Z",
    months: 1,
  });

  it("recognises the producer's own word", () => {
    expect(isEstimate(paid("estimate"))).toBe(true);
    expect(isEstimate(paid("ledger"))).toBe(false);
  });

  it("treats an ABSENT figure as neither — absent is not measured", () => {
    expect(isEstimate(null)).toBe(false);
    expect(isEstimate(undefined)).toBe(false);
    expect(paidToDateQualifier(null)).toBeNull();
  });

  it("carries the producer's word through rather than inventing one", () => {
    expect(paidToDateQualifier(paid("estimate"))).toBe("estimate");
    expect(paidToDateQualifier(paid("invoiced"))).toBe("invoiced");
  });

  it("states in words that it is not a ledger of charges", () => {
    expect(PAID_TO_DATE_NOTE.toLowerCase()).toContain("estimate");
    expect(PAID_TO_DATE_NOTE.toLowerCase()).toContain("not a ledger");
  });

  it("is rendered with that word attached everywhere it appears", () => {
    // The ONE component that draws a paid-to-date amount reads the qualifier; a
    // second, bare render site is how an estimate comes to read as money spent.
    const primitives = fs.readFileSync(
      path.resolve(__dirname, "../src/components/cold-email/primitives.tsx"),
      "utf-8",
    );
    expect(primitives).toContain("paidToDateQualifier");
    expect(primitives).toContain("PAID_TO_DATE_NOTE");
  });
});

// ---------------------------------------------------------------------------
// DNS verdicts
// ---------------------------------------------------------------------------

function dns(patch: Partial<OpsDns> = {}): OpsDns {
  return {
    spf: { present: true, allQualifier: "~all", includes: ["_spf.google.com"], raw: "v=spf1 ~all" },
    dmarc: { present: true, policy: "reject", subdomainPolicy: null, pct: 100, rua: [], raw: "v=DMARC1; p=reject" },
    dkimSelectors: ["google"],
    mx: ["1 smtp.google.com"],
    errors: {},
    ...patch,
  };
}

describe("dnsBadges", () => {
  it("grades the four records an operator reads a sending domain on", () => {
    expect(dnsBadges(dns()).map((b) => b.label)).toEqual(["SPF", "DMARC", "DKIM", "MX"]);
  });

  it("calls a permissive SPF WEAK, not missing — a record that is there and says nothing is a different problem from no record", () => {
    const weak = dnsBadges(dns({ spf: { present: true, allQualifier: "?all", includes: [], raw: "v=spf1 ?all" } }));
    expect(weak[0].verdict).toBe("weak");
    const absent = dnsBadges(dns({ spf: { present: false, allQualifier: null, includes: [], raw: null } }));
    expect(absent[0].verdict).toBe("missing");
  });

  it("accepts both enforcing SPF qualifiers", () => {
    for (const q of ["-all", "~all"]) {
      const b = dnsBadges(dns({ spf: { present: true, allQualifier: q, includes: [], raw: "x" } }));
      expect(b[0].verdict).toBe("ok");
    }
  });

  it("calls DMARC p=none WEAK and reject/quarantine OK", () => {
    const none = dnsBadges(dns({ dmarc: { present: true, policy: "none", subdomainPolicy: null, pct: null, rua: [], raw: "v=DMARC1; p=none;" } }));
    expect(none[1].verdict).toBe("weak");
    for (const p of ["reject", "quarantine"]) {
      const b = dnsBadges(dns({ dmarc: { present: true, policy: p, subdomainPolicy: null, pct: null, rua: [], raw: "x" } }));
      expect(b[1].verdict).toBe("ok");
    }
  });

  it("grades DKIM and MX on whether anything was found at all", () => {
    const bare = dnsBadges(dns({ dkimSelectors: [], mx: [] }));
    expect(bare[2].verdict).toBe("missing");
    expect(bare[3].verdict).toBe("missing");
  });

  it("carries what the record actually says, and null when there is none", () => {
    const b = dnsBadges(dns());
    expect(b[0].detail).toBe("v=spf1 ~all");
    expect(b[2].detail).toBe("google");
    expect(dnsBadges(dns({ mx: [] }))[3].detail).toBeNull();
  });
});

describe("dnsErrorCount", () => {
  it("counts the probes that could not be read, so an unread record is never rendered as an absent one", () => {
    expect(dnsErrorCount(dns())).toBe(0);
    expect(dnsErrorCount(dns({ errors: { dmarc: "NXDOMAIN", dkim: "timeout" } }))).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Vocabulary & formatting
// ---------------------------------------------------------------------------

describe("vocabulary", () => {
  it("labels the states we know", () => {
    expect(lifecycleLabel("in_production")).toBe("In production");
    expect(poolLabel("gandi-relay")).toBe("Gandi relay");
    expect(messageKindLabel("warmup_reply")).toBe("Warmup reply");
  });

  it("prints an UNKNOWN token verbatim — the vocabulary is the producer's and it grows, so a state nobody labelled is still a state", () => {
    expect(lifecycleLabel("some_new_state")).toBe("some_new_state");
    expect(poolLabel("brand-new-pool")).toBe("brand-new-pool");
    expect(messageKindLabel("forward")).toBe("forward");
  });
});

describe("formatting", () => {
  it("formats cents, defaulting the currency only when the producer gave none", () => {
    expect(formatCents(1467, "USD")).toBe("$14.67");
    expect(formatCents(1467, null)).toBe("$14.67");
  });

  it("returns null for an absent amount — never a fabricated $0", () => {
    expect(formatCents(null, "USD")).toBeNull();
    expect(formatCents(undefined, "USD")).toBeNull();
    expect(formatCents(Number.NaN, "USD")).toBeNull();
  });

  it("keeps a real ZERO, which is a measurement", () => {
    expect(formatCents(0, "USD")).toBe("$0.00");
  });

  it("returns null for an unmeasured percentage and a string for a measured zero", () => {
    expect(formatPct(null)).toBeNull();
    expect(formatPct(0)).toBe("0.0%");
    expect(formatPct(87.5)).toBe("87.5%");
  });
});

describe("rampReaches", () => {
  it("names the day the projection reaches its highest cap", () => {
    expect(
      rampReaches([
        { date: "2026-09-18", cap: 5 },
        { date: "2026-09-19", cap: 8 },
        { date: "2026-09-20", cap: 50 },
      ]),
    ).toEqual({ date: "2026-09-20", cap: 50 });
  });

  it("takes the FIRST date at that cap when the projection flattens", () => {
    expect(
      rampReaches([
        { date: "2026-09-18", cap: 50 },
        { date: "2026-09-19", cap: 50 },
      ]),
    ).toEqual({ date: "2026-09-18", cap: 50 });
  });

  it("answers null for an empty projection — we were not told, which is not 'today'", () => {
    expect(rampReaches([])).toBeNull();
  });
});
