import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// features-service v0.179.24 splits campaigns into Proactive (start conversations, spend the
// budget) and Reactive (act on existing ones, only a cap) and serves a reactive_only status.
const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const api = read("src/lib/api.ts");
const page = read("src/app/(authed)/(dashboard)/audit/accounts/page.tsx");
const cs = read("src/components/customer-success-view.tsx");

describe("account status: proactive vs reactive (admin)", () => {
  it("types every status the producer serves", () => {
    const decl = api.slice(api.indexOf("export type AccountStatus ="), api.indexOf("export const ACCOUNT_STATUS_RANK"));
    for (const s of ["active", "payment_declined", "no_payment_method", "reactive_only", "paused", "inactive"]) {
      expect(decl).toContain(`"${s}"`);
    }
  });

  it("ranks reactive_only after active and before paused", () => {
    const rank = api.slice(api.indexOf("export const ACCOUNT_STATUS_RANK"), api.indexOf("export interface AuditAccountsStats"));
    const at = (s: string) => Number(rank.match(new RegExp(`\\b${s}: (\\d+)`))?.[1]);
    expect(at("active")).toBeLessThan(at("reactive_only"));
    expect(at("reactive_only")).toBeLessThan(at("paused"));
  });

  it("accounts page: Proactive and Reactive columns, reactive cap card, Reactive only pill", () => {
    expect(page).toContain(">Proactive</th>");
    expect(page).toContain(">Reactive</th>");
    expect(page).toContain("s.totalReactiveRunningDailyCapUsd");
    expect(page).toContain('label: "Reactive only"');
  });

  it("customer success pills Reactive only", () => {
    expect(cs).toContain('label: "Reactive only"');
  });

  it("accounts page renders no em-dash", () => {
    expect(page).not.toContain("—");
  });
});
