import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { monitoringUrlForColdEmail } from "../src/lib/cold-email-moved";

/**
 * MONITORING-ADMIN-PORT-1019: the cold-email audit pages moved to dashboard v2 Monitoring > Emails
 * (owner 2026-10-19). Every old URL lands on its Monitoring page; the nav names no dead route.
 */
const root = join(__dirname, "../src/app/(authed)/(dashboard)/audit");

describe("cold-email pages moved to Monitoring", () => {
  it("maps every old page to its Monitoring page", () => {
    const base = "https://dashboard.distribute.you/v2/monitoring/emails/";
    expect(monitoringUrlForColdEmail(undefined)).toBe(`${base}capacity`);
    expect(monitoringUrlForColdEmail("domains")).toBe(`${base}domains`);
    expect(monitoringUrlForColdEmail("blocklists")).toBe(`${base}blocklists`);
    expect(monitoringUrlForColdEmail("mailboxes")).toBe(`${base}mailboxes`);
    expect(monitoringUrlForColdEmail("accounts")).toBe(`${base}accounts`);
    expect(monitoringUrlForColdEmail("inbox")).toBe(`${base}threads`);
    expect(monitoringUrlForColdEmail("rules")).toBe(`${base}rules`);
    expect(monitoringUrlForColdEmail("nope")).toBe(`${base}capacity`);
  });

  it("keeps only redirects under the old routes", () => {
    for (const p of ["page.tsx", "domains", "blocklists", "mailboxes", "accounts", "inbox", "rules"]) {
      expect(existsSync(join(root, "cold-email", p))).toBe(false);
    }
    expect(readFileSync(join(root, "cold-email/[[...path]]/page.tsx"), "utf8")).toContain("redirect(monitoringUrlForColdEmail(");
    expect(readFileSync(join(root, "instantly/page.tsx"), "utf8")).toContain("redirect(monitoringUrlForColdEmail(");
  });

  it("the nav links no removed cold-email route", () => {
    const nav = readFileSync(join(__dirname, "../src/components/context-sidebar.tsx"), "utf8");
    expect(nav).not.toContain("/audit/cold-email");
    expect(nav).toContain("DASHBOARD_MONITORING_URL");
  });
});
