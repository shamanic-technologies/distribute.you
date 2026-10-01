import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

const SECTION = read("src/components/leads/lead-stage-section.tsx");
const HOOK = read("src/lib/use-lead-step-statements.ts");
const API = read("src/lib/api.ts");

describe("lead stage panel", () => {
  it("invalidates EVERY grain of the money, because a statement moves all of them", () => {
    // `featureRevenue` alone left the brand Overview, the offer money, the funnel walk
    // and the per-campaign rows on the pre-write figure — see write-invalidation.ts.
    expect(HOOK).toContain("invalidateLeadOutcome(queryClient)");
    expect(HOOK).not.toContain('queryKey: ["featureRevenue"]');
  });

  it("does not poll the statements", () => {
    // Nothing else writes them: a statement arrives because somebody in this session
    // made it, and the tracker's own arrivals ride the /revenue join the page polls.
    expect(HOOK).not.toContain("refetchInterval");
  });

  it("carries no em-dash in any user-facing string", () => {
    const strings = SECTION.match(/"[^"\n]{12,}"/g) ?? [];
    for (const s of strings) expect(s).not.toContain("—");
  });
});

describe("stating what a won deal was worth", () => {
  it("cannot submit the amount form until what was typed IS an amount", () => {
    expect(SECTION).toContain("saleValueCentsFrom(rawValue)");
    // `!disabled` joined the guard when the leads table's Close won column started asking
    // whose win the deal was before it asks what it was worth — one place a statement is
    // refused for being incomplete, rather than a second gate at each call site.
    expect(SECTION).toContain(
      "const ready = !disabled && costCents != null && (!needsValue || valueCents != null);",
    );
    expect(SECTION).toContain("disabled={!ready || busy}");
  });
});

describe("stating what the step cost the customer", () => {
  const STAGES = read("src/lib/lead-stages.ts");

  it("makes the cost REQUIRED on the write, so a caller has to ask", () => {
    expect(API).toContain("costCents: number;");
    expect(API).not.toContain("costCents?: number");
  });

  it("says whose money it is beside the field, not only inside a tooltip", () => {
    // A dollar box on a screen that also shows credits reads as something we are about
    // to charge, and nobody opens a tooltip to find out otherwise.
    expect(SECTION).toContain('const COST_CAPTION = "Your own spend. We never bill it.";');
    expect(SECTION).toContain('data-testid="lead-stage-cost-caption"');
    expect(SECTION).toContain("we never charge you for it");
  });

  it("never presents it as platform spend, credits or an invoice", () => {
    // The COPY only, not the comments around it: a comment explaining that a dollar box
    // must not read as credits legitimately writes the word.
    const copy = [
      SECTION.slice(SECTION.indexOf("const COST_TIP"), SECTION.indexOf("\n\n", SECTION.indexOf("const COST_TIP"))),
      SECTION.slice(SECTION.indexOf("const COST_CAPTION"), SECTION.indexOf(";", SECTION.indexOf("const COST_CAPTION"))),
    ].join(" ").toLowerCase();
    for (const forbidden of ["credit", "invoice", "billed to you", "we charge you", "balance"]) {
      expect(copy).not.toContain(forbidden);
    }
    // And it says the opposite, in the author's own terms.
    expect(copy).toContain("this is your money");
    expect(copy).toContain("we never charge you");
  });
});

/**
 * A reply we never RECEIVED is still a reply. A mailbox that drains to somebody's own
 * inbox, a webhook the provider stopped delivering, a prospect who answered on the
 * phone: somebody records it by hand, and the note they wrote is the only copy of that
 * exchange we hold.
 */
/**
 * A reply we never RECEIVED is still a reply, and a reply we CAN produce the words of
 * is a different fact from one somebody wrote down.
 *
 * That distinction moved to lead-service, which serves a `message` for the first and a
 * `reply_statement` for the second and never folds them together. The panel renders
 * what it is told and marks an asserted fact as asserted.
 */
describe("a hand-recorded reply is stated as one", () => {
  const TIMELINE = readFileSync(
    join(__dirname, "..", "src", "components", "audiences", "lead-history-timeline.tsx"),
    "utf8",
  );

  it("marks an asserted fact rather than letting it read like an observed one", () => {
    expect(TIMELINE).toContain('e.evidence === "asserted"');
    expect(TIMELINE).toContain("recorded by hand");
  });

  it("renders the recorded reply and what was written with it", () => {
    expect(TIMELINE).toContain('case "reply_statement":');
    expect(TIMELINE).toContain("Reply recorded");
    expect(TIMELINE).toContain("e.note ?? undefined");
  });
});
