import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import { UnsentAnswersSchema, campaignShortName, refusalCodeName, unsentPerson, unsentWhy } from "../src/lib/monitoring/unsent-answers";

/**
 * ONE-AI-REFUSED-ANSWERS-1029: a person wrote to a brand and the answer we owed them was refused by the sender, or every
 * run for it failed. campaign-service serves it (`GET /internal/ops/unsent-answers`), api-service passes it through to
 * Monitoring > Triggers > Unsent answers; red on the hub is the alert, never an email.
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
// The real production read of 2026-10-29 (people's addresses replaced by example ones).
const fixture = () => JSON.parse(readFileSync(join(__dirname, "fixtures", "campaign-unsent-answers-prod-1029.json"), "utf8"));

describe("Monitoring > Unsent answers: campaign-service's read parses as served", () => {
  it("the real production read parses whole: red, refused and failed answers listed, a daily series", () => {
    const d = UnsentAnswersSchema.parse(fixture());
    expect(d.status).toBe("red");
    expect(d.brokenLast24h).toBeGreaterThan(0);
    expect(d.unsent.some((a) => a.state === "refused" && a.refusalCode && a.refusalReason)).toBe(true);
    expect(d.unsent.some((a) => a.state === "failed" && a.refusalCode === null)).toBe(true);
    expect(d.unsent.some((a) => a.person === null)).toBe(true);
    expect(Object.keys(d.byDay[0]).sort()).toEqual(["answered", "answeredByTeam", "day", "failed", "refused", "refusedByCode", "replaying"]);
  });

  it("a day answered only by the brand's team carries no refused and no failed answer (stays normal)", () => {
    const d = UnsentAnswersSchema.parse(fixture());
    const team = d.byDay.find((x) => x.day === "2026-10-22");
    expect(team).toMatchObject({ answeredByTeam: 3, refused: 0, failed: 0 });
  });

  it("an ok read with nothing unsent parses too", () => {
    const d = UnsentAnswersSchema.parse({ ...fixture(), status: "ok", brokenLast24h: 0, unsent: [] });
    expect(d.status).toBe("ok");
  });

  it("says why in plain words, an unknown code as served", () => {
    expect(refusalCodeName("not_on_whatsapp")).toBe("Number not on WhatsApp");
    expect(refusalCodeName("something_new")).toBe("Something new");
    expect(unsentWhy({ state: "failed", refusalCode: null, runs: 3 })).toBe("Every run failed (3 tries)");
    expect(unsentWhy({ state: "refused", refusalCode: "email_not_verified", runs: 1 })).toBe("Email address did not pass our check");
    expect(unsentPerson({ person: { name: null, email: null, phone: "+447700900123" } })).toBe("+447700900123");
    expect(unsentPerson({ person: null })).toBeNull();
    expect(campaignShortName("Lead Follow-up f1ab54e3 - ai-follow-up-email - b - o - start_to_paid_client")).toBe("Lead Follow-up f1ab54e3");
  });
});

describe("Monitoring > Unsent answers: page and hub", () => {
  it("reads the staff gateway route, never persisted to disk", () => {
    const api = read("lib/api.ts");
    expect(api).toContain('unsentAnswers: "/campaigns/ops/unsent-answers"');
    expect(api).toContain("STAFF_MONITORING_PATHS.unsentAnswers");
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    expect(sensitive).toContain('"staffUnsentAnswers"');
    expect(read("components/v2/monitoring-unsent-answers.tsx")).toContain('["staffUnsentAnswers", UNSENT_ANSWERS_DAYS]');
  });

  it("is a Monitoring page, mounted, with its red tile above the collapsible rows and a card in Triggers", () => {
    expect(MONITORING_PAGES).toContain("triggers/unsent");
    expect(parseMonitoringPath("/triggers/unsent")).toEqual({ view: "page", page: "triggers/unsent" });
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('view.page === "triggers/unsent" && <UnsentAnswersPage />');
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    expect(hub.indexOf('<UnsentAnswersTile href={href("triggers/unsent")} />')).toBeGreaterThan(-1);
    expect(hub.indexOf("<UnsentAnswersTile")).toBeLessThan(hub.indexOf("<Section "));
    expect(hub).toContain('page="triggers/unsent"');
  });

  it("draws the served verdict, list and series in served order: no client sort, no sum; red only on refused or failed", () => {
    const src = read("components/v2/monitoring-unsent-answers.tsx");
    expect(src).toContain('data.status === "red"');
    expect(src).toContain("data.unsent.map");
    expect(src).toContain("data.byDay.map");
    expect(src).not.toMatch(/\.sort\(/);
    expect(src).not.toMatch(/\.reduce\(/);
    // The normal ones never wear red.
    expect(src).toMatch(/key: "answeredByTeam", label: "[^"]+", color: "var\(--data-teal\)"/);
    expect(src).toMatch(/key: "replaying", label: "[^"]+", color: "var\(--data-sky\)"/);
  });
});
