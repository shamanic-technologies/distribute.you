import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// A failed sync (status "error") is still ON and retried every pass. Only a connection
// someone paused reads "Paused" (PostHog 429s showed "Paused" for 5 days, 2026-11-07).
const files = [
  "src/components/settings/brand-integrations-card.tsx",
  "src/components/v2/integrations-crm.tsx",
];

describe("connection Paused label", () => {
  for (const f of files) {
    it(`${f} reads Paused only for status "paused"`, () => {
      const src = readFileSync(join(__dirname, "..", f), "utf8");
      expect(src).toContain('const paused = connection.status === "paused";');
      expect(src).not.toContain('const paused = connection.status !== "active";');
    });
  }
});

describe("PostHog catching up (crm-service POSTHOG-429-1107)", () => {
  const src = readFileSync(join(__dirname, "..", "src/components/settings/brand-integrations-card.tsx"), "utf8");
  it("a read-budget wait reads Catching up, never Needs attention", () => {
    const pill = src.slice(src.indexOf("function StatusPill("), src.indexOf("function IntegrationRow("));
    expect(pill.indexOf('"catching_up"')).toBeGreaterThan(-1);
    expect(pill.indexOf('"catching_up"')).toBeLessThan(pill.indexOf('label: "Needs attention"'));
  });
  it("the wait line replaces the raw vendor error at the call site", () => {
    expect(src).toContain("catchingUpLine(connection) ? (");
  });
});
