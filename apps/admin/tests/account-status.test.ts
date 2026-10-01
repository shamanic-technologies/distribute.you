import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ACCOUNT_STATUSES, ACCOUNT_STATUS_LABEL, accountStatusRank } from "../src/lib/account-status";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("account status (features-service /internal/stats/accounts + customer-health)", () => {
  it("knows every status the producer serves", () => {
    expect([...ACCOUNT_STATUSES].sort()).toEqual(
      ["active", "inactive", "no_payment_method", "paused", "payment_declined", "reactive_only"],
    );
  });

  it("ranks reactive_only between active and paused, inactive last", () => {
    expect(accountStatusRank("active")).toBeLessThan(accountStatusRank("reactive_only"));
    expect(accountStatusRank("reactive_only")).toBeLessThan(accountStatusRank("paused"));
    for (const s of ACCOUNT_STATUSES) {
      if (s !== "inactive") expect(accountStatusRank(s)).toBeLessThan(accountStatusRank("inactive"));
    }
  });

  it("labels reactive_only as Reactive only, no em-dash in any label", () => {
    expect(ACCOUNT_STATUS_LABEL.reactive_only).toBe("Reactive only");
    for (const label of Object.values(ACCOUNT_STATUS_LABEL)) expect(label).not.toContain("—");
  });

  it("accounts page shows Proactive and Reactive as separate columns and a reactive cap stat", () => {
    const src = read("src/app/(authed)/(dashboard)/audit/accounts/page.tsx");
    expect(src).toContain(">Proactive</th>");
    expect(src).toContain(">Reactive</th>");
    expect(src).toContain("value={r.proactiveRunningDailyBudgetUsd}");
    expect(src).toContain("value={r.reactiveRunningDailyCapUsd}");
    expect(src).toContain("s.totalReactiveRunningDailyCapUsd");
    expect(src).toContain("s.reactiveOnlyCount");
    expect(src).toContain("accountStatusRank(a.status)");
    expect(src).not.toContain("\u2014");
  });

  it("customer success pills every status through the shared labels", () => {
    const src = read("src/components/customer-success-view.tsx");
    expect(src).toContain("const STATUS_PILL: Record<AccountStatus, string>");
    expect(src).toContain("{ACCOUNT_STATUS_LABEL[status]}");
    expect(src).toContain("s.reactiveOnlyCount");
  });
});
