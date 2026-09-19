import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FUNNEL_STEP_MARKS,
  STEP_KEY_FOR_LEAD_STAGE,
  funnelStepMarkFor,
  funnelStepMarkForLeadStage,
} from "../src/lib/funnel-step-marks";
import { FUNNEL_LEG_MARKS, funnelLegMarkKey } from "../src/lib/funnel-leg-marks";
import { SALES_FUNNELS } from "../src/lib/sales-funnels";

const read = (rel: string) => readFileSync(join(__dirname, "..", "src", rel), "utf8");

/** Every step production publishes on `GET /public/channels` (2026-09-18, features-service
 *  v0.169.3: ONE form step), in order. */
const PROD_STEPS = [
  "conversation",
  "website_visit",
  "meeting_booked",
  "meeting_attended",
  "signup",
  "form_submitted",
  "paid_client",
];

/** Steps DRAWN ahead of the wire, with why. A step the producer never ships draws a
 *  mark nothing asks for, which costs nothing; a step offered on a screen with no mark
 *  is a blank square. `purchase` is an outcome `/start` offers today and the producer
 *  is publishing as the middle rung of the website-purchase funnel. */
const AHEAD_OF_WIRE = ["purchase"];

describe("funnel step marks — one tile per step, the same product-wide", () => {
  it("draws every step the producer publishes", () => {
    for (const key of PROD_STEPS) expect(funnelStepMarkFor(key), key).not.toBeNull();
    expect(Object.keys(FUNNEL_STEP_MARKS).sort()).toEqual(
      [...PROD_STEPS, ...AHEAD_OF_WIRE].sort(),
    );
    for (const key of AHEAD_OF_WIRE) expect(funnelStepMarkFor(key), key).not.toBeNull();
  });

  it("reads the two retired form spellings as the one form step", () => {
    // A body written before 2026-09-18 still draws the tile; a lead-service stage does too.
    expect(funnelStepMarkFor("form_filled")).toEqual(funnelStepMarkFor("form_submitted"));
    expect(funnelStepMarkFor("lead_form_submitted")).toEqual(funnelStepMarkFor("form_submitted"));
    expect(funnelStepMarkFor("form_submitted")).not.toBeNull();
    expect(Object.keys(FUNNEL_STEP_MARKS)).not.toContain("form_filled");
    expect(Object.keys(FUNNEL_STEP_MARKS)).not.toContain("lead_form_submitted");
  });

  it("draws every rung of every funnel this app sells", () => {
    for (const f of SALES_FUNNELS) {
      for (const key of f.stepKeys) expect(funnelStepMarkFor(key), `${f.key}/${key}`).not.toBeNull();
    }
  });

  it("gives each step its own glyph", () => {
    const glyphs = Object.values(FUNNEL_STEP_MARKS).map((m) => m.glyph);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it("keeps the entry leg's glyph for a step that has one, so the outcome screen is unchanged", () => {
    for (const key of [...PROD_STEPS, ...AHEAD_OF_WIRE]) {
      const entry = FUNNEL_LEG_MARKS[funnelLegMarkKey(null, key)];
      if (entry) expect(FUNNEL_STEP_MARKS[key].glyph).toBe(entry.glyph);
    }
  });

  it("never reuses an INTERNAL leg's, a channel's or a funnel's glyph", () => {
    const taken = new Set([
      ...Object.entries(FUNNEL_LEG_MARKS)
        .filter(([k]) => !k.startsWith("->"))
        .map(([, m]) => m.glyph as string),
      "envelope", "chat-circle", "chat-teardrop",
      "chats-circle", "calendar-check", "shopping-cart", "magnet", "coins", "megaphone", "list-checks", "basket",
    ]);
    for (const m of Object.values(FUNNEL_STEP_MARKS)) expect(taken.has(m.glyph), m.glyph).toBe(false);
  });

  it("maps every lead-panel stage onto a drawn step", () => {
    const stages = ["positive_reply", "website_visit", "meeting_booked", "meeting_attended", "signup", "form_submission", "sale"];
    expect(Object.keys(STEP_KEY_FOR_LEAD_STAGE).sort()).toEqual([...stages].sort());
    for (const s of stages) expect(funnelStepMarkForLeadStage(s), s).not.toBeNull();
    expect(funnelStepMarkForLeadStage(null)).toBeNull();
    expect(funnelStepMarkFor("not_a_step")).toBeNull();
  });

  it("is what every surface naming a step draws", () => {
    expect(read("components/start/start-picks.tsx")).toContain("<FunnelStepMark stepKey={o.key}");
    expect(read("components/start/start-picks.tsx")).toContain("mark: <FunnelStepMark stepKey={step.key}");
    expect(read("components/leads/lead-funnel-stage-section.tsx")).toContain("<FunnelStepMark stageKey={stage.key}");
    expect(read("components/funnels/funnel-leg-board.tsx")).toContain("<FunnelStepMark stageKey={column.stage}");
  });
});
