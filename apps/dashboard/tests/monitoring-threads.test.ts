import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  OpsThreadMessagesSchema,
  OpsThreadsSchema,
  THREADS_PAGE_SIZE,
  appendThreads,
  domainOf,
  hasActiveFilters,
  servedWord,
  threadKindWord,
  threadMessagesQuery,
  threadReadingOrder,
  threadsQuery,
} from "../src/lib/monitoring/threads";

const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", `${name}-prod-2026-10-19.json`), "utf8"));

describe("Monitoring > Emails > Threads: wire shapes (whole prod payloads)", () => {
  it.each(["ops-threads", "ops-threads-replied", "ops-threads-seed"])("%s parses whole", (name) => {
    const parsed = OpsThreadsSchema.safeParse(fixture(name));
    expect(parsed.success, JSON.stringify(parsed.error?.issues?.slice(0, 3))).toBe(true);
    expect(parsed.data!.threads.length).toBeGreaterThan(0);
  });

  it.each(["ops-thread-messages", "ops-thread-messages-replied"])("%s parses whole", (name) => {
    const parsed = OpsThreadMessagesSchema.safeParse(fixture(name));
    expect(parsed.success, JSON.stringify(parsed.error?.issues?.slice(0, 3))).toBe(true);
    expect(parsed.data!.messages.length).toBeGreaterThan(0);
  });

  it("a rotten thread (count as null) is refused, never read as zero", () => {
    const raw = fixture("ops-threads");
    raw.threads[0].messageCount = null;
    expect(OpsThreadsSchema.safeParse(raw).success).toBe(false);
  });
});

describe("Monitoring > Emails > Threads: queries", () => {
  it("limit is always first and present; blanks are left off; hasInbound is tri-state", () => {
    expect(threadsQuery({}, null)).toBe(`limit=${THREADS_PAGE_SIZE}`);
    expect(threadsQuery({ kind: "outreach", account: "  ", hasInbound: false }, null)).toBe(`limit=${THREADS_PAGE_SIZE}&kind=outreach&hasInbound=false`);
    expect(threadsQuery({ account: "a+b@x.com", since: "2026-10-01" }, "abc")).toBe(`limit=${THREADS_PAGE_SIZE}&account=a%2Bb%40x.com&since=2026-10-01&cursor=abc`);
    expect(threadMessagesQuery("self:60ce")).toBe("limit=200&threadId=self%3A60ce");
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ domain: " " })).toBe(false);
    expect(hasActiveFilters({ hasInbound: true })).toBe(true);
  });
});

describe("Monitoring > Emails > Threads: helpers", () => {
  it("a page appends without duplicating a thread that moved", () => {
    const { threads } = OpsThreadsSchema.parse(fixture("ops-threads"));
    const merged = appendThreads(threads.slice(0, 3), threads.slice(2, 5));
    expect(merged.map((t) => t.threadId)).toEqual(threads.slice(0, 5).map((t) => t.threadId));
  });

  it("a thread reads oldest first (the producer serves newest first)", () => {
    const { messages } = OpsThreadMessagesSchema.parse(fixture("ops-thread-messages-replied"));
    const ordered = threadReadingOrder(messages);
    expect(ordered[0].kind).toBe("outreach");
    for (let i = 1; i < ordered.length; i++) expect(Date.parse(ordered[i].occurredAt)).toBeGreaterThanOrEqual(Date.parse(ordered[i - 1].occurredAt));
  });

  it("served tokens read as words; unknown kinds print as served", () => {
    expect(servedWord("lead_meeting_requested")).toBe("Meeting requested");
    expect(servedWord("auto_reply_received")).toBe("Auto reply received");
    expect(servedWord("bounced")).toBe("Bounced");
    expect(servedWord(null)).toBeNull();
    expect(threadKindWord("outreach")).toBe("Campaign");
    expect(threadKindWord("delay")).toBe("Delay notice");
    expect(threadKindWord("something_new")).toBe("something_new");
    expect(domainOf("Kevin@GrowDistribute.com")).toBe("growdistribute.com");
    expect(domainOf(null)).toBeNull();
  });
});

describe("Monitoring > Emails > Threads: page source", () => {
  const src = read("components/v2/monitoring-threads.tsx");
  const api = read("lib/api.ts");
  const region = api.slice(api.indexOf("ported from the admin cold-email pages (threads)"), api.indexOf("ported from the admin cold-email pages (entity-details)"));

  it("reads through the staff passthroughs, the thread filter and the shared body read", () => {
    expect(region).toContain('threads: "/instantly/ops/threads"');
    expect(region).toContain('messages: "/instantly/ops/messages"');
    expect(region).toContain("threadMessagesQuery(threadId)");
    expect(src).toContain('["staffMessageBody", id]');
    expect(src).toContain('["staffOpsThreads", query]');
    expect(src).toContain('["staffOpsThreadMessages", t.threadId]');
  });

  it("exports the page, opens a row in place, pages on the cursor, never polls", () => {
    expect(src).toContain("export function ThreadsPage({ base }: { base: string })");
    expect(src).toContain("ThreadDetail");
    expect(src).toContain("setCursor(nextCursor)");
    expect(src).toContain("q.isPlaceholderData");
    expect(src).not.toMatch(/refetchInterval|pollOptions/);
  });

  it("ports every admin panel block and computes no figure", () => {
    for (const label of ["Sending address", "Mailbox", "Domain", "Transport", "Counterparty", "Lead", "Delivery", "Reply classification", "Reply kind", "Placement", "Messages", "First activity", "Last activity", "Sequence", "Org", "Campaign", "Brands"]) {
      expect(src).toContain(`label="${label}"`);
    }
    expect(src).not.toMatch(/\.reduce\(/);
    expect(src).not.toMatch(/[\u2013\u2014]/);
    expect(src).not.toMatch(/text-gray-|bg-brand-50|rounded-lg border|shadow-2xl|border-l-[2-9]/);
    expect(src).not.toMatch(/dangerouslySetInnerHTML/);
  });
});
