import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The lead panel's email copy is GA: every reader sees the words of every message, ours
 * drafted, ours as it went out, and the prospect's own reply (owner-decided 2026-09-25).
 *
 * It used to be withheld until the lead produced a sales interest, with the beta list as
 * the other way in and a beta badge on the copy a beta reader could see (#3793, #4226).
 * Both the gate and the badge are gone, so this pins their absence.
 */
const TIMELINE = readFileSync(
  join(__dirname, "../src/components/audiences/lead-history-timeline.tsx"),
  "utf8",
);
const PAGE = readFileSync(
  join(__dirname, "../src/components/audiences/engaged-leads-page.tsx"),
  "utf8",
);

describe("the lead panel shows every email body to every reader", () => {
  it("renders a body whenever the message has one, behind no flag", () => {
    expect(TIMELINE).toContain("{hasReadableBody(e) && (");
    expect(TIMELINE).not.toContain("canReadEmailCopy");
    expect(TIMELINE).not.toContain("betaOnlyCopy");
  });

  it("keeps the draft row, and every other row", () => {
    expect(TIMELINE).toContain("const visible = history.events;");
    expect(TIMELINE).not.toContain('e.type !== "generated_email"');
  });

  it("carries no beta badge on the copy", () => {
    expect(TIMELINE).not.toContain("MaturityBadge");
  });

  it("still says when we hold a message and could not read it", () => {
    expect(TIMELINE).toContain('{e.bodyStatus === "unavailable" && (');
  });

  it("the page resolves no copy gate and passes none", () => {
    expect(PAGE).not.toContain("canReadEmailCopy");
    expect(PAGE).not.toContain("betaOnlyCopy");
    expect(PAGE).not.toContain("hasSalesInterest(selectedLead)");
  });
});
