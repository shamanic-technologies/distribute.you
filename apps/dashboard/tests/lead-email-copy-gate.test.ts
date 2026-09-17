import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The lead panel states WHAT HAPPENED to a person in GA and withholds the WORDS until
 * that person has produced a positive reply.
 *
 * The rule used to cover the unsent draft alone: a message we had really sent, and the
 * prospect's own reply, rendered open to everyone on the reasoning that a real message
 * is the customer's own conversation. That left a GA row reading `Email we wrote` with
 * an empty body and a beta badge beside it — a row announcing a thing nobody could
 * open — while every sent body was GA regardless of whether the lead ever converted.
 *
 * One gate now, over every body: ours drafted, ours as it went out, and theirs. A
 * website visit or a positive reply earns the copy; beta earns it too.
 */
const TIMELINE = readFileSync(
  join(__dirname, "../src/components/audiences/lead-history-timeline.tsx"),
  "utf8",
);
const PAGE = readFileSync(
  join(__dirname, "../src/components/audiences/engaged-leads-page.tsx"),
  "utf8",
);

describe("the timeline gates every body behind one flag", () => {
  it("renders no body of any kind without the flag", () => {
    // The old form (`e.type !== "generated_email" || canReadDraftCopy`) let a sent
    // message and an inbound reply through unconditionally. A body is rendered behind
    // `canReadEmailCopy` and nothing else.
    expect(TIMELINE).toContain("hasReadableBody(e) && canReadEmailCopy &&");
    expect(TIMELINE).not.toContain("canReadDraftCopy");
    expect(TIMELINE).not.toContain('e.type !== "generated_email" ||');
  });

  it("drops the draft ROW when its words are withheld, and keeps every other row", () => {
    // A draft row IS its body; without the words it is a heading over an empty box.
    // A send, a reply and a visit are things that happened, which is the GA job.
    expect(TIMELINE).toContain(
      '(e) => canReadEmailCopy || e.type !== "generated_email",',
    );
  });

  it("filters BEFORE the map, so the rail and the gap read visible neighbours", () => {
    // Filtering inside the map would measure a `+Nd` gap from a row nobody can see and
    // hang a connector off the last visible one.
    const filterAt = TIMELINE.indexOf("const visible = history.events.filter(");
    const mapAt = TIMELINE.indexOf("visible.map((e, i) =>");
    expect(filterAt).toBeGreaterThan(-1);
    expect(mapAt).toBeGreaterThan(filterAt);
    expect(TIMELINE).toContain("const prev = i > 0 ? visible[i - 1] : null;");
    expect(TIMELINE).toContain("{i < visible.length - 1 &&");
    // The empty-state check reads the visible rows, or a person whose only event is a
    // withheld draft renders an empty card instead of nothing.
    expect(TIMELINE).toContain("if (visible.length === 0 && !note) return null;");
  });

  it("badges the copy a BETA reader sees, never an empty row", () => {
    // The badge used to stand IN PLACE of a withheld body. It rides readable copy now,
    // and only on the beta-only branch: copy a positive reply earned is GA, so badging
    // it beta would name the wrong reason.
    expect(TIMELINE).toContain("{betaOnlyCopy && hasReadableBody(e) && (");
    expect(TIMELINE).not.toContain("!canReadEmailCopy && (\n                  <span");
  });

  it("explains a body it could not read only to a reader who would have seen it", () => {
    expect(TIMELINE).toContain('{canReadEmailCopy && e.bodyStatus === "unavailable" && (');
  });
});

describe("the page resolves the gate once and threads it to every timeline", () => {
  it("reads the shared sales-interest rule rather than re-deriving it", () => {
    // A second copy of "what counts as an interest" is how this surface and the stat
    // cards come to disagree about one lead.
    expect(PAGE).toContain('import { hasSalesInterest } from "@/lib/lead-sales-interest";');
    expect(PAGE).toContain("const salesInterest = hasSalesInterest(selectedLead);");
    expect(PAGE).toContain("const canReadEmailCopy = isBetaUserForPanel || salesInterest;");
    expect(PAGE).toContain("const betaOnlyCopy = isBetaUserForPanel && !salesInterest;");
  });

  it("threads BOTH flags to all three timelines", () => {
    // A component perfectly able to gate its copy is the feature entirely absent if a
    // call site never passes the flag.
    const copy = PAGE.match(/canReadEmailCopy=\{canReadEmailCopy\}/g) ?? [];
    const beta = PAGE.match(/betaOnlyCopy=\{betaOnlyCopy\}/g) ?? [];
    expect(copy).toHaveLength(3);
    expect(beta).toHaveLength(3);
    expect(PAGE).not.toContain("canReadDraftCopy");
  });
});
