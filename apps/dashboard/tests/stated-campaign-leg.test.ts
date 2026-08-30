import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  funnelLegIndexFromWire,
  statedCampaignLeg,
  type PublicChannelLegsWire,
} from "../src/lib/stated-campaign-leg";
import { campaignLegFor } from "../src/lib/campaign-leg";
import { salesFunnelByKey } from "../src/lib/sales-funnels";
import type { ChannelLeg } from "../src/lib/acquisition-channels";

const reply = salesFunnelByKey("reply_meeting");
const visitMeeting = salesFunnelByKey("visit_meeting");

/** The catalogue as features-service publishes it, verbatim in shape: every leg carries
 *  its own minted `legKey` and the two steps it connects as data beside it. */
const CHANNELS: PublicChannelLegsWire[] = [
  {
    stepTransitions: [
      { legKey: "start_to_conversation", from: null, to: { key: "conversation" } },
      { legKey: "start_to_website_visit", from: null, to: { key: "website_visit" } },
    ],
  },
  {
    stepTransitions: [
      { legKey: "conversation_to_meeting_booked", from: { key: "conversation" }, to: { key: "meeting_booked" } },
      { legKey: "website_visit_to_meeting_booked", from: { key: "website_visit" }, to: { key: "meeting_booked" } },
    ],
  },
  {
    stepTransitions: [
      { legKey: "meeting_attended_to_paid_client", from: { key: "meeting_attended" }, to: { key: "paid_client" } },
    ],
  },
];

const INDEX = funnelLegIndexFromWire(CHANNELS);

describe("funnelLegIndexFromWire — the lookup is built from what the producer serves", () => {
  it("keys every published leg on its own legKey", () => {
    expect(INDEX.get("conversation_to_meeting_booked")).toEqual({
      fromKey: "conversation",
      toKey: "meeting_booked",
    });
  });

  it("reads an entry leg's absent `from` as null rather than dropping the leg", () => {
    expect(INDEX.get("start_to_conversation")).toEqual({ fromKey: null, toKey: "conversation" });
  });

  it("skips a malformed row instead of throwing — a lookup table degrades, it does not fail", () => {
    const index = funnelLegIndexFromWire([
      { stepTransitions: [{ legKey: "", to: { key: "conversation" } }] },
      { stepTransitions: [{ legKey: "x_to_y", to: null }] },
      { stepTransitions: null },
      {},
    ]);
    expect(index.size).toBe(0);
  });

  it("answers an empty index for an absent catalogue", () => {
    expect(funnelLegIndexFromWire(null).size).toBe(0);
    expect(funnelLegIndexFromWire(undefined).size).toBe(0);
  });
});

describe("statedCampaignLeg — the campaign's own statement wins over the derivation", () => {
  it("resolves the arrow the campaign states, in the funnel's own words", () => {
    const leg = statedCampaignLeg(reply, "conversation_to_meeting_booked", INDEX);
    expect(leg).not.toBeNull();
    expect(leg?.fromKey).toBe("conversation");
    expect(leg?.toKey).toBe("meeting_booked");
    expect(leg?.label).toBe(`${reply!.steps[0]} → ${reply!.steps[1]}`);
  });

  it("resolves an ENTRY leg as onto-the-funnel-from-nothing, not as index 0's predecessor", () => {
    const leg = statedCampaignLeg(reply, "start_to_conversation", INDEX);
    expect(leg?.fromIndex).toBeNull();
    expect(leg?.toIndex).toBe(0);
    expect(leg?.fromKey).toBeNull();
    expect(leg?.label).toBe(reply!.steps[0]);
  });

  it("OVERRIDES what the channel's own legs would have derived", () => {
    // Cold email performs two entry legs; against the reply funnel the derivation picks
    // the conversation one. A campaign that states it is bought for the website visit is
    // on the visit funnel's entry leg, and the statement is what decides.
    const COLD_EMAIL: ChannelLeg[] = [
      { from: null, to: "conversation" },
      { from: null, to: "website_visit" },
    ];
    expect(campaignLegFor(visitMeeting, COLD_EMAIL)?.toKey).toBe("website_visit");
    const stated = statedCampaignLeg(visitMeeting, "start_to_website_visit", INDEX);
    expect(stated?.toKey).toBe("website_visit");
  });

  it("states nothing when the campaign states nothing — the derivation is untouched", () => {
    expect(statedCampaignLeg(reply, null, INDEX)).toBeNull();
    expect(statedCampaignLeg(reply, undefined, INDEX)).toBeNull();
    expect(statedCampaignLeg(reply, "", INDEX)).toBeNull();
  });

  it("states nothing for a key the catalogue does not know — never a fabricated leg", () => {
    expect(statedCampaignLeg(reply, "some_to_thing", INDEX)).toBeNull();
  });

  it("states nothing when the stated leg is not an arrow of THIS funnel", () => {
    // The reply funnel has no meeting_attended → paid_client arrow adjacency issue: it
    // does, so use a leg that genuinely belongs to no position of it.
    expect(statedCampaignLeg(reply, "website_visit_to_meeting_booked", INDEX)).toBeNull();
    expect(statedCampaignLeg(reply, "start_to_website_visit", INDEX)).toBeNull();
  });

  it("states nothing without a funnel or without a catalogue", () => {
    expect(statedCampaignLeg(null, "conversation_to_meeting_booked", INDEX)).toBeNull();
    expect(statedCampaignLeg(reply, "conversation_to_meeting_booked", null)).toBeNull();
  });
});

describe("the legKey is opaque", () => {
  const srcFiles: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry)) srcFiles.push(full);
    }
  };
  walk(join(__dirname, "..", "src"));

  it("is never split, sliced or regexed apart anywhere in src", () => {
    const offenders = srcFiles.filter((f) => {
      const src = readFileSync(f, "utf8");
      return /_to_/.test(src) && /legKey[^\n]*\.(split|match|replace|slice|indexOf)\(/.test(src);
    });
    expect(offenders).toEqual([]);
  });

  it("is never minted from two steps on the consumer side", () => {
    const offenders = srcFiles.filter((f) => /`\$\{[^`]*\}_to_\$\{/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("the call sites read the campaign's own statement", () => {
  const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");
  const sliceAt = (src: string, marker: string, len: number) => {
    const at = src.indexOf(marker);
    expect(at).toBeGreaterThan(-1);
    return src.slice(at, at + len);
  };

  it("resolves the stated leg in ONE place, ahead of the derivation and behind an explicit leg", () => {
    const src = read("components/campaigns/campaign-identity.tsx");
    expect(src).toContain(
      "legOverride ?? statedCampaignLeg(funnel, legKey, legIndex) ?? campaignLegFor(funnel, channel?.def?.legs)",
    );
    // The inline layout applies the SAME precedence, or one campaign reads as one leg
    // in the table and another in the bar above it.
    expect(src).toContain("statedCampaignLeg(funnel, legKey, legIndex) ?? campaignLegFor(funnel, channel?.def?.legs)");
  });

  it("is PASSED by every surface that names a campaign — pinned at the call site, not only the component", () => {
    expect(sliceAt(read("components/campaigns/campaigns-table.tsx"), "<CampaignIdentity", 260)).toContain(
      "legKey={campaign.legKey}",
    );
    expect(sliceAt(read("components/campaigns/campaign-title.tsx"), "<CampaignIdentityInline", 260)).toContain(
      "legKey={campaign.legKey}",
    );
    expect(sliceAt(read("components/campaigns/campaign-controls-modal.tsx"), "<CampaignIdentity", 260)).toContain(
      "legKey={row.legKey}",
    );
  });

  it("is read by the lead panel's funnel walk, ahead of its own derivation", () => {
    const src = read("components/audiences/engaged-leads-page.tsx");
    expect(src).toContain("statedCampaignLeg(panelFunnel, scopedCampaign?.legKey, legIndex)");
  });

  it("is persisted, so the platform catalogue paints from disk like every other root", () => {
    expect(read("lib/persist-cache.ts")).toContain('"publicChannelLegs"');
  });
});
