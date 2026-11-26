import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// Owner 2026-11-25: the card is asked first, saying nothing is charged now; the next
// screen picks the credit and its reload, paid on that saved card.
describe("card first on the credit step (owner 2026-11-25)", () => {
  const wall = src("src/components/v2/get-started/account-card-wall.tsx");
  const launch = src("src/components/v2/get-started/org-launch.tsx");
  const pay = src("src/components/v2/get-started/pay-topup.ts");

  it("says nothing is charged before the card form opens", () => {
    expect(src("src/components/v2/get-started/card-first.tsx")).toContain("Nothing is charged now. You pick your credit next.");
  });

  it("both walks show the card first, then the credit step", () => {
    for (const f of [wall, launch]) {
      expect(f).toContain(") : !cardOnFile ? (");
      expect(f).toContain("<CardFirst busy={busy} onAdd={() => void addCardFirst()} />");
    }
  });

  it("sets prepaid BEFORE the card save, so the save charges nothing", () => {
    for (const f of [wall, launch]) {
      const at = f.indexOf("async function addCardFirst(");
      const body = f.slice(at, f.indexOf("\n  }\n", at));
      expect(body.indexOf("prepareCardFirst(")).toBeGreaterThan(-1);
      expect(body.indexOf("prepareCardFirst(")).toBeLessThan(body.indexOf("openCardSave("));
    }
  });

  it("pays the credit on the saved card, the form only when the card cannot", () => {
    expect(pay).toContain("await chargeSavedCard({");
    expect(src("src/lib/api.ts")).toContain('apiCall("/billing/accounts/charge"');
    for (const f of [wall, launch]) {
      expect(f).toContain("if (cardOnFile && !formFallback) {");
      expect(f).toContain("setFormFallback(true);");
    }
  });
});
