import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import { WhatsappLinesSchema, dayStrip, linesDown, linkedLines, stateWord } from "../src/lib/monitoring/whatsapp-lines";

/**
 * WA-LINE-MONITOR-1023: distribute.you's WhatsApp line +77776879632 sat logged out from 2026-10-19
 * 14:39 to 10-22 18:41 UTC and nobody saw it. crm-service's line watch (crm #190) is read through
 * the gateway (api-service #1358) onto Monitoring > WhatsApp > Lines; red on the hub is the alert.
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const lines = () => WhatsappLinesSchema.parse(JSON.parse(readFileSync(join(__dirname, "fixtures", "crm-whatsapp-lines-prod-2026-10-23.json"), "utf8")));

describe("Monitoring > WhatsApp lines: crm-service's read parses as served in prod (2026-10-23, days=30)", () => {
  it("the whole payload parses, in the served order (linked first, red first)", () => {
    const d = lines();
    expect(d.lines.length).toBeGreaterThan(0);
    const linked = d.lines.map((l) => l.linked);
    expect(linked).toEqual([...linked].sort((a, b) => Number(b) - Number(a)));
  });

  it("every line names its brand and org (crm #194)", () => {
    for (const l of lines().lines) {
      expect(l.brandName).toBe("Distribute.you");
      expect(l.orgName).toBe("distribute.you");
    }
  });

  it("our own line's 10-20 and 10-21 read down, as served", () => {
    const ours = lines().lines.find((l) => l.phone === "+77776879632")!;
    expect(ours).toBeDefined();
    const by = Object.fromEntries(ours.days.map((d) => [d.day, d.status]));
    expect(by["2026-10-20"]).toBe("down");
    expect(by["2026-10-21"]).toBe("down");
  });

  it("the strip lays the served days on the window's calendar, oldest left, no history = empty slot", () => {
    const d = lines();
    const ours = d.lines.find((l) => l.phone === "+77776879632")!;
    const strip = dayStrip(d.from, d.to, ours.days);
    expect(strip[0].day).toBe(d.from);
    expect(strip[strip.length - 1].day).toBe(d.to);
    expect(strip.filter((s) => s.served).length).toBe(ours.days.length);
    expect(strip.find((s) => s.day === "2026-10-20")!.served!.status).toBe("down");
    expect(dayStrip("2026-10-30", "2026-11-02", []).map((s) => s.day)).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });

  it("red = a LINKED line the producer serves down now", () => {
    const d = lines();
    const fake = {
      ...d,
      lines: [
        { ...d.lines[0], linked: true, current: { ...d.lines[0].current, down: true } },
        { ...d.lines[0], phone: "+1", linked: false, current: { ...d.lines[0].current, down: true } },
        { ...d.lines[0], phone: "+2", linked: true, current: { ...d.lines[0].current, down: false } },
      ],
    };
    expect(linesDown(fake).map((l) => l.phone)).toEqual([d.lines[0].phone]);
    expect(linkedLines(fake).length).toBe(2);
  });

  it("the state word is the producer's own, capitalised", () => {
    expect(stateWord("logged_out")).toBe("Logged out");
    expect(stateWord("bridge_unreachable")).toBe("Bridge unreachable");
    expect(stateWord("connected")).toBe("Connected");
  });
});

describe("Monitoring > WhatsApp lines: page and hub", () => {
  it("is a Monitoring page, mounted, chipped and carded on the hub, with an always-visible red tile", () => {
    expect(MONITORING_PAGES).toContain("whatsapp/lines");
    expect(parseMonitoringPath("/whatsapp/lines")).toEqual({ view: "page", page: "whatsapp/lines" });
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('view.page === "whatsapp/lines" && <WhatsappLinesPage />');
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    // the tile sits before the first collapsible row: a collapsed row would hide the red
    expect(hub.indexOf('<WhatsappLinesTile href={href("whatsapp/lines")} />')).toBeGreaterThan(-1);
    expect(hub.indexOf("<WhatsappLinesTile")).toBeLessThan(hub.indexOf("<Section "));
    expect(hub).toContain('page="whatsapp/lines"');
  });

  it("renders the served order and verdicts: no client sort, no uptime %, no email", () => {
    const src = stripComments(read("components/v2/monitoring-whatsapp.tsx"));
    expect(src).not.toMatch(/\.sort\(/);
    expect(src).not.toMatch(/uptime/i);
    // a percentage on screen ("99%", "pct"), never the modulo of a minutes label
    expect(src).not.toMatch(/%`|%"|%<|\bpct\b/);
    expect(src).toContain("runStaffWhatsappLineCheck()");
    expect(src).toContain('queryKey: ["staffWhatsappLines"]');
    expect(src).toContain("relink it from Integrations");
  });

  it("reads the gateway's staff passthrough, and the root is never persisted", () => {
    const api = read("lib/api.ts");
    expect(api).toContain('lines: "/crm/ops/whatsapp-lines"');
    expect(api).toContain('check: "/crm/ops/whatsapp-lines/check"');
    const cache = read("lib/persist-cache.ts");
    const sensitive = cache.slice(cache.indexOf("export const SENSITIVE_QUERY_ROOTS"), cache.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    expect(sensitive).toContain('"staffWhatsappLines"');
  });
});
