import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  STEP_MARKS,
  STEP_KEY_FOR_LEAD_STAGE,
  stepMarkFor,
  stepMarkForLeadStage,
} from "../src/lib/step-marks";
import { LEG_MARKS, legMarkKey } from "../src/lib/leg-marks";

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
 *  is publishing as a step of its own. */
const AHEAD_OF_WIRE = ["purchase"];

describe("step marks — one tile per step, the same product-wide", () => {
  it("draws every step the producer publishes", () => {
    for (const key of PROD_STEPS) expect(stepMarkFor(key), key).not.toBeNull();
    expect(Object.keys(STEP_MARKS).sort()).toEqual(
      [...PROD_STEPS, ...AHEAD_OF_WIRE].sort(),
    );
    for (const key of AHEAD_OF_WIRE) expect(stepMarkFor(key), key).not.toBeNull();
  });

  it("reads the two retired form spellings as the one form step", () => {
    // A body written before 2026-09-18 still draws the tile; a lead-service stage does too.
    expect(stepMarkFor("form_filled")).toEqual(stepMarkFor("form_submitted"));
    expect(stepMarkFor("lead_form_submitted")).toEqual(stepMarkFor("form_submitted"));
    expect(stepMarkFor("form_submitted")).not.toBeNull();
    expect(Object.keys(STEP_MARKS)).not.toContain("form_filled");
    expect(Object.keys(STEP_MARKS)).not.toContain("lead_form_submitted");
  });

  it("gives each step its own glyph", () => {
    const glyphs = Object.values(STEP_MARKS).map((m) => m.glyph);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it("keeps the entry leg's glyph for a step that has one, so the outcome screen is unchanged", () => {
    for (const key of [...PROD_STEPS, ...AHEAD_OF_WIRE]) {
      const entry = LEG_MARKS[legMarkKey(null, key)];
      if (entry) expect(STEP_MARKS[key].glyph).toBe(entry.glyph);
    }
  });

  it("never reuses an INTERNAL leg's or a channel's glyph", () => {
    const taken = new Set([
      ...Object.entries(LEG_MARKS)
        .filter(([k]) => !k.startsWith("->"))
        .map(([, m]) => m.glyph as string),
      "envelope", "chat-circle", "chat-teardrop",
    ]);
    for (const m of Object.values(STEP_MARKS)) expect(taken.has(m.glyph), m.glyph).toBe(false);
  });

  it("maps every lead-panel stage onto a drawn step", () => {
    const stages = ["positive_reply", "website_visit", "meeting_booked", "meeting_attended", "signup", "form_submission", "sale"];
    expect(Object.keys(STEP_KEY_FOR_LEAD_STAGE).sort()).toEqual([...stages].sort());
    for (const s of stages) expect(stepMarkForLeadStage(s), s).not.toBeNull();
    expect(stepMarkForLeadStage(null)).toBeNull();
    expect(stepMarkFor("not_a_step")).toBeNull();
  });

  it("is what every surface naming a step draws", () => {
    expect(read("components/start/start-picks.tsx")).toContain("<StepMark stepKey={o.key}");
    expect(read("components/offers/offer-outcomes-table.tsx")).toContain("<StepMark stepKey={row.step.key}");
    expect(read("components/leads/lead-stage-section.tsx")).toContain("<StepMark stageKey={stage.key}");
  });
});
