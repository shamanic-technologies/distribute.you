import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Stripe is the acquirer for every NEW org (owner 2026-10-15): Revolut declined a US
 * business card's $1 card check ("do_not_honour") and lost a $100/day client at the card
 * step. The dashboard no longer pins any org to Revolut; stripe-service's rollout share
 * decides (set to 0%). Orgs whose card already lives on Revolut keep its widget, which
 * billing answers as `embedded_widget`.
 */

const root = join(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("no surface pins an org to Revolut", () => {
  it("nothing in src calls the old declaration", () => {
    const hits = walk(join(root, "src")).filter((f) => {
      const s = readFileSync(f, "utf8");
      return s.includes("/api/orgs/revolut") || s.includes("declareRevolut") || s.includes("/v1/accounts/acquirer");
    });
    expect(hits).toEqual([]);
  });

  it("the declaration route is gone", () => {
    expect(existsSync(join(root, "src/app/(authed)/api/orgs/revolut/route.ts"))).toBe(false);
  });

  it("an older Revolut org still gets its widget", () => {
    expect(readFileSync(join(root, "src/lib/card-setup-widget.ts"), "utf8")).toContain("RevolutCheckout(");
  });
});
