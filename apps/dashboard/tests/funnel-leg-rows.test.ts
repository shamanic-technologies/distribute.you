import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildFunnelLegRows,
  campaignStepOutcomes,
  LEAD_FIELD_BY_STEP_KEY,
} from "../src/lib/funnel-leg-rows";
import { funnelLegs, campaignLegFor } from "../src/lib/campaign-leg";
import { SALES_FUNNELS, salesFunnelByKey } from "../src/lib/sales-funnels";
import type { FunnelStepRow } from "../src/lib/revenue-view";
import type { ChannelLeg } from "../src/lib/acquisition-channels";

const read = (rel: string) => readFileSync(join(__dirname, "..", "src", rel), "utf8");

const reply = salesFunnelByKey("reply_meeting");

/** The legs the deployed catalogue states for these channels, verbatim. */
const COLD_EMAIL: ChannelLeg[] = [
  { from: null, to: "conversation" },
  { from: null, to: "website_visit" },
];
const FOUNDER_LED_CLOSING: ChannelLeg[] = [{ from: "meeting_attended", to: "paid_client" }];

/** A rung as features-service serves it. */
const step = (over: Partial<FunnelStepRow> & { leadField: string }): FunnelStepRow => ({
  step: "Sales interest",
  recipientsReached: 40,
  costPerReachCents: 12_345,
  fromStep: "Contacted",
  fromRecipientsReached: 9_802,
  conversionFromPreviousPct: 0.4,
  ...over,
});

const legOf = (channel: ChannelLeg[]) => campaignLegFor(reply, channel)?.toIndex ?? null;

describe("funnelLegs — every arrow of the funnel, run by us or not", () => {
  it("states one leg per step, entry first", () => {
    expect(funnelLegs(reply).map((l) => l.label)).toEqual([
      "Sales interest",
      "Sales interest → Meeting booked",
      "Meeting booked → Meeting attended",
      "Meeting attended → Paid client",
    ]);
  });

  it("carries the producer's own tokens beside the customer's words", () => {
    const [entry, second] = funnelLegs(reply);
    expect(entry.fromKey).toBeNull();
    expect(entry.toKey).toBe("conversation");
    expect(second.fromKey).toBe("conversation");
    expect(second.toKey).toBe("meeting_booked");
  });

  it("gives every funnel we sell one leg per step", () => {
    for (const funnel of SALES_FUNNELS) {
      expect(funnelLegs(funnel).length, funnel.key).toBe(funnel.steps.length);
    }
  });

  it("answers nothing for no funnel rather than throwing", () => {
    expect(funnelLegs(null)).toEqual([]);
    expect(funnelLegs(undefined)).toEqual([]);
  });
});

describe("buildFunnelLegRows — the funnel walked, with who performs each arrow", () => {
  const steps: FunnelStepRow[] = [
    step({ leadField: "repliedPositive", step: "Sales interest", recipientsReached: 41 }),
    step({
      leadField: "meetingBooked",
      step: "Meeting booked",
      recipientsReached: 12,
      fromStep: "Sales interest",
      fromRecipientsReached: 41,
      conversionFromPreviousPct: 29.3,
    }),
    step({
      leadField: "meetingAttended",
      step: "Meeting attended",
      recipientsReached: 9,
      fromStep: "Meeting booked",
      fromRecipientsReached: 12,
      conversionFromPreviousPct: 75,
    }),
    step({
      leadField: "purchased",
      step: "Paid client",
      recipientsReached: 2,
      fromStep: "Meeting attended",
      fromRecipientsReached: 9,
      conversionFromPreviousPct: 22.2,
    }),
  ];

  it("lists EVERY arrow, including the ones no campaign of ours performs", () => {
    const { rows } = buildFunnelLegRows({
      legs: funnelLegs(reply),
      steps,
      campaigns: [{ toIndex: legOf(COLD_EMAIL), campaign: "cold-email" }],
    });
    expect(rows.map((r) => r.leg.label)).toEqual([
      "Sales interest",
      "Sales interest → Meeting booked",
      "Meeting booked → Meeting attended",
      "Meeting attended → Paid client",
    ]);
    // Cold email does the entry arrow; the brand works the other three itself, and
    // those rows exist with no campaign rather than being dropped.
    expect(rows.map((r) => r.campaign)).toEqual(["cold-email", null, null, null]);
  });

  it("joins each arrow to its rung by the producer's leadField, never by position", () => {
    const { rows } = buildFunnelLegRows({
      // The producer states its rungs in the funnel's order; a reversed payload must
      // still land each rung on its own arrow rather than shifting the table by one.
      legs: funnelLegs(reply),
      steps: [...steps].reverse(),
      campaigns: [],
    });
    expect(rows.map((r) => r.step?.recipientsReached)).toEqual([41, 12, 9, 2]);
    expect(rows[3].step?.conversionFromPreviousPct).toBe(22.2);
  });

  it("puts a customer-operated arrow's own figures on its row", () => {
    // The closing arrow is worked at the brand's side, and its outcomes are still
    // measured — a manual row is a row with numbers, not an empty one.
    const { rows } = buildFunnelLegRows({
      legs: funnelLegs(reply),
      steps,
      campaigns: [{ toIndex: legOf(FOUNDER_LED_CLOSING), campaign: "founder-led" }],
    });
    expect(rows[3].campaign).toBe("founder-led");
    expect(rows[3].step?.recipientsReached).toBe(2);
    expect(rows[2].campaign).toBeNull();
    expect(rows[2].step?.recipientsReached).toBe(9);
  });

  it("states an arrow with NO served rung rather than hiding it", () => {
    const { rows } = buildFunnelLegRows({ legs: funnelLegs(reply), steps: null, campaigns: [] });
    expect(rows.length).toBe(4);
    expect(rows.every((r) => r.step === null)).toBe(true);
  });

  it("hands back a campaign this funnel has no arrow for instead of filing it wrongly", () => {
    const { rows, extra } = buildFunnelLegRows({
      legs: funnelLegs(reply),
      steps,
      campaigns: [{ toIndex: null, campaign: "unplaceable" }],
    });
    expect(rows.every((r) => r.campaign === null)).toBe(true);
    expect(extra).toEqual(["unplaceable"]);
  });

  it("gives an arrow several campaigns a row EACH, on that arrow", () => {
    // A brand can fund two channels onto the same step. Giving the arrow to the first
    // and dumping the second at the bottom read as a campaign the funnel has no place
    // for — it performs that arrow as much as the other one does.
    const { rows, extra } = buildFunnelLegRows({
      legs: funnelLegs(reply),
      steps,
      campaigns: [
        { toIndex: 0, campaign: "cold-email" },
        { toIndex: 0, campaign: "cold-sms" },
      ],
    });
    expect(rows.filter((r) => r.leg.toIndex === 0).map((r) => r.campaign)).toEqual([
      "cold-email",
      "cold-sms",
    ]);
    expect(rows.length).toBe(5);
    expect(extra).toEqual([]);
  });

  it("orders the rows by funnel step, then by cost per outcome", () => {
    // Step order is what makes the table a funnel — a reader follows it the way a lead
    // moves through it — and the price only ever breaks a tie WITHIN one step.
    const { rows } = buildFunnelLegRows({
      legs: funnelLegs(reply),
      steps,
      campaigns: [{ toIndex: 2, campaign: "closer" }, { toIndex: 0, campaign: "cold-email" }],
    });
    expect(rows.map((r) => r.leg.toIndex)).toEqual([0, 1, 2, 3]);
    expect(rows[0].campaign).toBe("cold-email");
    expect(rows[2].campaign).toBe("closer");
  });

  it("sinks a row whose cost is unstated below one that states it", () => {
    // An absent figure is not a low one.
    const priced = [
      step({ leadField: "repliedPositive", recipientsReached: 41, costPerReachCents: 500 }),
    ];
    const { rows } = buildFunnelLegRows({
      legs: funnelLegs(reply),
      steps: priced,
      campaigns: [],
    });
    // Only the first rung is priced; the three unpriced ones keep their step order
    // behind it rather than jumping ahead of it.
    expect(rows.map((r) => r.leg.toIndex)).toEqual([0, 1, 2, 3]);
    expect(rows[0].step?.costPerReachCents).toBe(500);
    expect(rows.slice(1).every((r) => r.step === null)).toBe(true);
  });

  it("maps every step of every funnel we sell to a producer leadField", () => {
    for (const funnel of SALES_FUNNELS) {
      for (const key of funnel.stepKeys) {
        expect(LEAD_FIELD_BY_STEP_KEY[key], `${funnel.key}: ${key}`).toBeTruthy();
      }
    }
  });

  it("flags an arrow two campaigns share, and only that arrow", () => {
    const { rows } = buildFunnelLegRows({
      legs: funnelLegs(reply),
      steps,
      campaigns: [
        { toIndex: 0, campaign: "cold-email" },
        { toIndex: 0, campaign: "feedback-request" },
        { toIndex: 3, campaign: "closer" },
      ],
    });
    expect(rows.filter((r) => r.leg.toIndex === 0).every((r) => r.sharesArrow)).toBe(true);
    expect(rows.filter((r) => r.leg.toIndex !== 0).some((r) => r.sharesArrow)).toBe(false);
  });

  it("keeps the row builder alias-free so it carries real unit tests", () => {
    const src = read("lib/funnel-leg-rows.ts");
    expect(src).not.toMatch(/^import (?!type ).*from "@\//m);
  });

  it("divides NOTHING — every figure on a row is a served rung", () => {
    const src = read("lib/funnel-leg-rows.ts");
    // A browser-computed ratio drifts from the producer the moment either side changes
    // scope, and it is the compute-a-stat-in-the-browser bug.
    expect(src).not.toMatch(/recipientsReached\s*\//);
    expect(src).not.toMatch(/\/\s*fromRecipientsReached/);
    expect(src).not.toContain("* 100");
  });
});

describe("campaignStepOutcomes — a campaign's OWN count for a step", () => {
  // Measured in prod on the brand that reported this: two campaigns feed the reply
  // funnel's first step, cold email with 18 sales interests and a feedback-request
  // campaign with 0. The funnel's rung says 18 for the step, so a row reading the rung
  // lends one campaign the other's evidence.
  const coldEmail = { positiveReplies: 18, websiteClicks: 53 };
  const feedback = { positiveReplies: 0, websiteClicks: 0 };

  it("reads the field the producer answers for that step", () => {
    expect(campaignStepOutcomes(coldEmail, "conversation")).toBe(18);
    expect(campaignStepOutcomes(feedback, "conversation")).toBe(0);
    expect(campaignStepOutcomes(coldEmail, "website_visit")).toBe(53);
  });

  it("answers undefined — not zero — for a step it has no count for", () => {
    // "we cannot tell" and "nobody got there" are different statements, and the second
    // one would print a confident 0 under a step the producer never measured per
    // campaign.
    expect(campaignStepOutcomes(coldEmail, "meeting_attended")).toBeUndefined();
    expect(campaignStepOutcomes(coldEmail, "paid_client")).toBeUndefined();
    expect(campaignStepOutcomes(null, "conversation")).toBeUndefined();
    expect(campaignStepOutcomes(undefined, "conversation")).toBeUndefined();
  });

  it("keeps a real ZERO, which is the whole point", () => {
    expect(campaignStepOutcomes(feedback, "conversation")).not.toBeUndefined();
    expect(campaignStepOutcomes(feedback, "conversation")).toBe(0);
  });
});

/**
 * A shared arrow states its figures ONCE.
 *
 * The rung's cost and rate are the arrow's on every row — the `$ / Outcome` tooltip says
 * so outright — so two campaigns feeding one step does not make them unstateable, only
 * repeatable. `arrowLead` marks the row that says them.
 */
describe("arrowLead", () => {
  const funnel = reply!;
  const legs = funnelLegs(funnel);
  const entry = legs[0];

  const on = (id: string, legDef: ChannelLeg[]) => ({
    toIndex: campaignLegFor(funnel, legDef)?.toIndex ?? null,
    campaign: id,
  });

  it("leads every arrow, shared or not", () => {
    const { rows } = buildFunnelLegRows<string>({ legs, steps: [], campaigns: [] });
    // Every arrow is unclaimed here, so each is alone and each leads itself.
    expect(rows.every((r) => r.arrowLead)).toBe(true);
    expect(rows).toHaveLength(legs.length);
  });

  it("marks exactly one lead per arrow when two campaigns feed it", () => {
    const { rows } = buildFunnelLegRows<string>({
      legs,
      steps: [],
      campaigns: [on("cold-email", COLD_EMAIL), on("feedback", COLD_EMAIL)],
    });
    const shared = rows.filter((r) => r.leg.toIndex === entry.toIndex);
    expect(shared).toHaveLength(2);
    expect(shared.filter((r) => r.arrowLead)).toHaveLength(1);
    expect(shared[0].arrowLead).toBe(true);
    expect(shared[1].arrowLead).toBe(false);
    expect(shared.every((r) => r.sharesArrow)).toBe(true);
  });

  it("marks the lead AFTER the sort, so it is the row that ends up on top", () => {
    // The sort orders campaigns within an arrow by cost, so the lead cannot be decided
    // while the rows are still being emitted.
    const { rows } = buildFunnelLegRows<string>({
      legs,
      steps: [],
      campaigns: [
        on("a", COLD_EMAIL),
        on("b", COLD_EMAIL),
        on("closer", FOUNDER_LED_CLOSING),
      ],
    });
    const leads = rows.filter((r) => r.arrowLead);
    // One lead per arrow, and never two in a row on the same arrow.
    expect(leads).toHaveLength(legs.length);
    for (let i = 1; i < rows.length; i += 1) {
      if (rows[i].leg.toIndex === rows[i - 1].leg.toIndex) expect(rows[i].arrowLead).toBe(false);
      else expect(rows[i].arrowLead).toBe(true);
    }
  });

  it("leads an arrow nobody of ours performs", () => {
    const { rows } = buildFunnelLegRows<string>({
      legs,
      steps: [],
      campaigns: [on("closer", FOUNDER_LED_CLOSING)],
    });
    // An unclaimed arrow is alone on itself, so it states the rung it has.
    const unclaimed = rows.filter((r) => r.campaign === null);
    expect(unclaimed.length).toBeGreaterThan(0);
    expect(unclaimed.every((r) => r.arrowLead && !r.sharesArrow)).toBe(true);
  });
});
