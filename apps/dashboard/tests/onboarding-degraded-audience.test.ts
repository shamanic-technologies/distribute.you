import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * apollo-service grades every filter set it builds. When its refine loop judges no
 * candidate a good fit it returns the best attempt anyway, flagged `degraded`, so a
 * customer sees something they can judge and reject instead of an error screen. That
 * flag travels apollo-service -> human-service -> the api-service passthrough and
 * reaches the browser on each `/suggest` candidate.
 *
 * Nothing rendered it, so an audience the builder disowned on both axes looked
 * identical to one it was satisfied with. A production run reached 161 people where
 * the same request had reached 2,640 an hour earlier, and the card said nothing.
 *
 * Three invariants, and the second is the one that matters most: it is INFORMATION,
 * never a gate. A degraded audience is served, persisted and activatable exactly like
 * any other, and the customer decides. Nothing here hides, disables, filters or
 * de-prioritises it, and nothing INFERS degradation from counts or filter shapes —
 * the flag the backend sends is rendered, and nothing more.
 *
 * Source-substring guards: `onboarding.tsx` imports through the `@` alias, which
 * vitest does not resolve in this repo, so these read the source rather than calling
 * in. The card's slice is bound to the NEXT declaration rather than a measured
 * length, so it moves with the file instead of expiring on the next comment.
 */

const ONBOARDING = readFileSync(
  join(__dirname, "../src/components/onboarding/onboarding.tsx"),
  "utf8",
);
const API = readFileSync(join(__dirname, "../src/lib/api.ts"), "utf8");

const CARD = ONBOARDING.slice(
  ONBOARDING.indexOf("function AudienceCandidateCard("),
  ONBOARDING.indexOf("function BrandStepHeader("),
);

describe("degraded is read off the wire, optional", () => {
  it("declares degraded on the candidate type", () => {
    expect(API).toContain("degraded?: boolean;");
  });

  it("parses it as OPTIONAL — an older human-service deploy does not send it, and absent means not degraded", () => {
    expect(API).toContain("degraded: z.boolean().optional(),");
  });
});

describe("the audience card states it", () => {
  it("reads the served flag and never infers one", () => {
    expect(CARD).toContain("candidate.degraded === true");
    expect(CARD).not.toContain("degraded = candidate.count");
  });

  it("says in plain words that the audience deserves a look, and what to look at", () => {
    expect(CARD).toContain("Check this one");
    expect(CARD).toContain(
      "This may not match what you asked for. Read the filters before you pick it.",
    );
  });

  it("wears a tint that is remapped in dark, with a full-perimeter 1px border", () => {
    expect(CARD).toContain("border border-orange-200 bg-orange-50");
    expect(CARD).toContain("text-orange-700");
  });

  it("carries no coloured side or top border accent", () => {
    expect(CARD).not.toContain("border-l-");
    expect(CARD).not.toContain("border-r-");
    expect(CARD).not.toContain("border-t-");
  });

  it("adds no em-dash anywhere in the card, comments included", () => {
    // Deliberately file-wide rather than scoped to the strings: a comment that
    // spells the forbidden character is one find-and-replace away from becoming
    // copy, and this guard is cheaper to satisfy than to reason about.
    expect(CARD).not.toContain("\u2014");
  });
});

describe("it is information, never a gate", () => {
  it("keeps a degraded candidate selectable: the toggle is unconditional and the card is never disabled", () => {
    expect(CARD).toContain("onClick={onToggle}");
    expect(CARD).not.toContain("degraded ? undefined : onToggle");
    expect(CARD).not.toContain("disabled=");
  });

  it("does not filter, hide or sort candidates by it", () => {
    expect(ONBOARDING).not.toContain("filter((c) => !c.degraded");
    expect(ONBOARDING).not.toContain(".degraded ? 1 :");
  });
});
