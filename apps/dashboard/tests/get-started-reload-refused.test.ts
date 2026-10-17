import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// Senthil 2026-10-17 (CeXO AI): the credit was paid, billing refused the automatic reload
// (a card issued in India takes no off-session mandate), and "Check my payment and launch"
// looped on the same refusal forever.
describe("a reload billing refuses never holds a paid launch back", () => {
  const src = read("src/components/v2/get-started/pay-topup.ts");
  const settle = src.slice(src.indexOf("export async function settleTopup("));

  it("a 400 on the reload settles ok, the reload marked refused", () => {
    const refused = settle.indexOf("e instanceof ApiError && e.status === 400");
    expect(refused).toBeGreaterThan(-1);
    expect(settle.slice(refused, refused + 300)).toContain("return { ok: true, account: acct, reloadRefused: true };");
    // Only a non-refusal (5xx, network) keeps the retry message.
    expect(settle.indexOf("Check again to retry.")).toBeGreaterThan(refused);
  });

  it("both payment surfaces go on to the launch and record the refusal", () => {
    for (const f of ["src/components/v2/get-started/account-card-wall.tsx", "src/components/v2/get-started/org-launch.tsx"]) {
      expect(read(f)).toContain('if (settled.reloadRefused) posthog.capture("get_started_reload_refused"');
    }
  });
});
