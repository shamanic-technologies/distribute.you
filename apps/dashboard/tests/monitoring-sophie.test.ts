import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import { RED_WINDOW_DAYS, SophieReplyDaysSchema, recentNotDelivered, type SophieReplyDays } from "../src/lib/monitoring/sophie-replies";

/**
 * SOPHIE-WA-DELIVERY-CHART-1029: on 2026-10-27 and 2026-10-29 every reply Sophie wrote on WhatsApp to a signed-in
 * person was refused at send, silently, for two days. chat-service's stored daily series is read through the gateway
 * onto Monitoring > WhatsApp > Sophie's replies; red on the hub is the alert, never an email.
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const day = (d: string, received: number, delivered: number, notDelivered: number) => ({ day: d, received, delivered, notDelivered });

describe("Sophie's replies: chat-service's read as served in prod (2026-10-29, days=30)", () => {
  const prod = () => SophieReplyDaysSchema.parse(JSON.parse(readFileSync(join(__dirname, "fixtures", "chat-channel-replies-prod-2026-10-29.json"), "utf8")));

  it("the whole payload parses: 30 UTC days oldest first, quiet days with zeros", () => {
    const d = prod();
    expect(d.days.length).toBe(30);
    expect(d.days[0].day).toBe("2026-09-30");
    expect(d.days[29].day).toBe("2026-10-29");
  });

  it("10-27 and 10-29 hold the refused replies, and the hub reads red on both, newest first", () => {
    const by = Object.fromEntries(prod().days.map((x) => [x.day, x.notDelivered]));
    expect(by["2026-10-27"]).toBeGreaterThan(0);
    expect(by["2026-10-29"]).toBeGreaterThan(0);
    expect(recentNotDelivered(prod()).map((x) => x.day)).toEqual(["2026-10-29", "2026-10-27"]);
  });
});

describe("Sophie's replies: chat-service's read and the red window", () => {
  it("parses as served: one row per UTC day, oldest first", () => {
    const d = SophieReplyDaysSchema.parse({ days: [day("2026-10-28", 4, 4, 0), day("2026-10-29", 3, 1, 2)] });
    expect(d.days.map((x) => x.day)).toEqual(["2026-10-28", "2026-10-29"]);
    expect(() => SophieReplyDaysSchema.parse({ days: [{ day: "2026-10-29", received: 1 }] })).toThrow();
  });

  it("is red while today or one of the 2 days before holds a not-delivered reply, newest first", () => {
    expect(RED_WINDOW_DAYS).toBe(3);
    const d: SophieReplyDays = {
      days: [day("2026-10-26", 2, 2, 0), day("2026-10-27", 5, 0, 5), day("2026-10-28", 3, 3, 0), day("2026-10-29", 4, 2, 2)],
    };
    expect(recentNotDelivered(d).map((x) => x.day)).toEqual(["2026-10-29", "2026-10-27"]);
  });

  it("clears on its own once the bad day leaves the window, and a quiet day is not red", () => {
    const d: SophieReplyDays = {
      days: [day("2026-10-27", 5, 0, 5), day("2026-10-28", 3, 3, 0), day("2026-10-29", 0, 0, 0), day("2026-10-30", 2, 2, 0)],
    };
    expect(recentNotDelivered(d)).toEqual([]);
    expect(recentNotDelivered({ days: [] })).toEqual([]);
  });
});

describe("Sophie's replies: page and hub", () => {
  it("is a Monitoring page, mounted, chipped, carded and charted on the hub, with an always-visible tile", () => {
    expect(MONITORING_PAGES).toContain("whatsapp/sophie");
    expect(parseMonitoringPath("/whatsapp/sophie")).toEqual({ view: "page", page: "whatsapp/sophie" });
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('view.page === "whatsapp/sophie" && <SophieRepliesPage />');
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    // the tile sits before the first collapsible row: a collapsed row would hide the red
    expect(hub.indexOf('<SophieRepliesTile href={href("whatsapp/sophie")} />')).toBeGreaterThan(-1);
    expect(hub.indexOf("<SophieRepliesTile")).toBeLessThan(hub.indexOf("<Section "));
    expect(hub).toContain('page="whatsapp/sophie"');
    expect(hub).toContain("<SophieRepliesChart data={sophie.data} />");
  });

  it("draws Delivered and Not delivered as served: no sum, no rate, no email", () => {
    const src = stripComments(read("components/v2/monitoring-sophie.tsx"));
    expect(src).toContain('label: "Delivered"');
    expect(src).toContain('label: "Not delivered"');
    expect(src).not.toMatch(/\.reduce\(|\.sort\(/);
    expect(src).not.toMatch(/%`|%"|\bpct\b/);
    expect(src).not.toMatch(/email/i);
  });

  it("reads the gateway's staff passthrough, and the root is never persisted", () => {
    expect(read("lib/api.ts")).toContain('STAFF_SOPHIE_REPLIES_PATH = "/chat/ops/channel-replies/daily"');
    expect(read("components/v2/monitoring-sophie.tsx")).toContain('["staffSophieReplies", SOPHIE_REPLY_DAYS]');
    const cache = read("lib/persist-cache.ts");
    const sensitive = cache.slice(cache.indexOf("export const SENSITIVE_QUERY_ROOTS"), cache.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    expect(sensitive).toContain('"staffSophieReplies"');
  });
});
