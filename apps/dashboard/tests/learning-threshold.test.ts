import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LEARNING_MIN_OUTCOMES,
  LEARNING_NOTE,
  isLearning,
} from "../src/lib/learning-threshold";

const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

describe("isLearning", () => {
  it("is learning below the bar", () => {
    expect(isLearning(0)).toBe(true);
    expect(isLearning(1)).toBe(true);
    expect(isLearning(LEARNING_MIN_OUTCOMES - 1)).toBe(true);
  });

  it("stops at the bar, so exactly ten states a number", () => {
    expect(isLearning(LEARNING_MIN_OUTCOMES)).toBe(false);
    expect(isLearning(50)).toBe(false);
  });

  it("treats an ABSENT count as learning, never as enough", () => {
    // "We have no count" is not evidence that we have enough of them — a producer that
    // does not measure this outcome must not get a stated price by omission.
    expect(isLearning(null)).toBe(true);
    expect(isLearning(undefined)).toBe(true);
  });

  it("says why, in the note, without quoting a dollar figure", () => {
    expect(LEARNING_NOTE).toContain(String(LEARNING_MIN_OUTCOMES));
    expect(LEARNING_NOTE).not.toContain("$");
    // No em-dash in user-facing copy.
    expect(LEARNING_NOTE).not.toContain("—");
  });
});

describe("LearningTag", () => {
  const src = read("components/learning-tag.tsx");

  it("wears the charter's SECONDARY, never a warning colour", () => {
    // Amber/orange reads as a warning about something the customer did wrong; this
    // is a waiting state. Purple is the charter's secondary (~44 degrees off the
    // primary blue), and all three classes are remapped in globals.css.
    for (const cls of ["bg-purple-50", "text-purple-700", "border-purple-200"]) {
      expect(src).toContain(cls);
    }
    expect(src).not.toMatch(/(bg|text|border)-(amber|orange|yellow|red)-/);
    expect(src).not.toMatch(/bg-(violet|sky|teal|rose|lime)-/);
  });

  it("does not rotate with a customer's brand hue", () => {
    // `.tone-tile` is the decorative categorical scale. This carries meaning.
    expect(src).not.toContain("tone-tile");
  });

  it("carries a full-perimeter border, never a side accent", () => {
    expect(src).toContain("border border-purple-200");
    expect(src).not.toMatch(/border-(left|right|top)|border-l-|border-r-|border-t-/);
  });

  it("explains itself through the shared InfoTooltip, never a native title", () => {
    expect(src).toContain("InfoTooltip");
    expect(src).not.toContain("title=");
  });
});

describe("the cost cards state Learning instead of a thin price", () => {
  const src = read("components/revenue/outreach-stat-cards.tsx");

  it("gates cost per website visit on the visit count the card beside it shows", () => {
    expect(src).toContain("costLearning: isLearning(clicks)");
  });

  it("gates both cost-per-positive-reply sites on the reply count", () => {
    // The terminal-reply outcome card and the mid-chain reply pair are two render
    // sites for one number; gating one leaves the row contradicting itself.
    const hits = src.match(/isLearning\(spend\?\.positiveRepliesCount\)/g) ?? [];
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it("gates the goal's own outcome cost too, so one row cannot state two rules", () => {
    expect(src).toContain("costLearning: isLearning(outcomeCount)");
  });

  it("keeps the tracker CTA ahead of the tag", () => {
    // A tracker that is not live is WHY the count is thin, so "set this up" is the
    // actionable answer; the tag only speaks when there is nothing to set up.
    expect(src).toContain("outcomeCard.showAction ? trackerButton : null");
  });

  it("swaps the tooltip to the reason rather than keeping the price copy", () => {
    expect(src).toContain("LEARNING_NOTE");
  });

  it("leaves the COUNT cards alone — the real number is never hidden", () => {
    expect(src).toContain('label={clickMetric.label}');
    expect(src).toContain("value={clickMetric.value}");
  });
});

describe("the Audiences table", () => {
  const src = read("components/audiences/customer-audiences-page.tsx");

  it("keys each gated cost on the outcome its own column divides by", () => {
    for (const pair of [
      "cppr: (s) => s.evidence.positiveReplies",
      "cpc: (s) => s.evidence.websiteClicks",
      "cps: (s) => s.evidence.signups",
      "cpfs: (s) => s.evidence.formSubmissions",
      "cpsale: (s) => s.evidence.sales",
    ]) {
      expect(src).toContain(pair);
    }
  });

  it("states the tag in every one of those cells, not just the reported one", () => {
    for (const col of ["cppr", "cpc", "cps", "cpfs", "cpsale"]) {
      expect(src).toContain(`costIsLearning("${col}", stats)`);
    }
  });

  it("treats an absent stats row as absent, never as learning", () => {
    // The table already prints "-" for a row features-service returned nothing for.
    // Calling that learning would replace one honest answer with a different one.
    expect(src).toContain("if (!read || !stats) return false;");
  });

  it("does not rank a row by a price it is not showing", () => {
    // Learning rows sink below every measured one and order among themselves by the
    // outcome count the column divides by — which is the column beside it, so the order
    // the reader sees is the order the numbers on screen state.
    expect(src).toContain("const learningRank = (a: AudienceWire): number | null =>");
    expect(src).toContain("if (al != null && bl != null) return bl - al;");
  });
});

describe("the Top-3 audiences card", () => {
  const src = read("components/revenue/top-audiences-card.tsx");

  it("computes the gate from the row's own outcome count, only where a metric exists", () => {
    expect(src).toContain("const rowLearning = isStats && !!metric && isLearning(outcomes)");
  });

  it("drops the cost subtitle entirely on a learning row", () => {
    expect(src).toContain("brandLevelMoney || !metric || rowLearning");
  });

  it("puts the tag in the value slot instead of the return", () => {
    expect(src).toContain("{rowLearning ? (");
    expect(src).toContain("<LearningTag withInfo={false} />");
  });

  it("explains the tag from the header (i), never from inside the row's Link", () => {
    expect(src).toContain("const anyLearning");
    expect(src).toContain("anyLearning ? `${baseTip} ${LEARNING_NOTE}` : baseTip");
  });
});
