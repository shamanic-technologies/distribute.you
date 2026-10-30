import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { join } from "node:path";

// Owner 2026-10-21: « You OWE est vraiment une tournure de phrase dégueulasse ». Billing copy
// follows Google Ads / Google Cloud: "Balance due" (owner 2026-10-30), "No balance due".
describe("billing copy never says 'you owe'", () => {
  it("no app source carries 'You owe' / 'Owed now' in copy", () => {
    const root = join(__dirname, "../..");
    const out = execSync(
      `grep -rnE "\\"You owe|>\\s*You owe|\\\`You owe|Owed now|You owe \\{|Text\\(\\"You owe" --include=*.ts --include=*.tsx --include=*.swift dashboard/src admin/src desktop/Sources || true`,
      { cwd: root, encoding: "utf8" },
    );
    expect(out).toBe("");
  });
});
