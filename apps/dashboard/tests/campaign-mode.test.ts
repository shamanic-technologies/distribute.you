import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { campaignModeFor, legCatalogueFromWire } from "../src/lib/legs";

// features-service v0.179.106 `GET /public/channels` (owner 2026-10-09): every leg is
// proactive or reactive, a reactive one names the trigger that asks for it.
const catalogue = legCatalogueFromWire({
  steps: [
    { key: "lead_found", label: "Lead found" },
    { key: "conversation", label: "Positive reply" },
    { key: "meeting_booked", label: "Meeting booked" },
  ],
  channels: [
    {
      slug: "sales-cold-email-outreach",
      stepTransitions: [{ legKey: "lead_found_to_conversation", from: { key: "lead_found" }, to: { key: "conversation" }, mode: "proactive", triggerId: null }],
    },
    {
      slug: "ai-meeting-booking",
      stepTransitions: [
        { legKey: "conversation_to_meeting_booked", from: { key: "conversation" }, to: { key: "meeting_booked" }, mode: "reactive", triggerId: "positive_reply_received" },
      ],
    },
    {
      slug: "sourcing-apollo-cold-filters",
      stepTransitions: [{ legKey: "start_to_lead_found", to: { key: "lead_found" }, mode: "reactive", triggerId: "lead_requested" }],
    },
    { slug: "older-producer", stepTransitions: [{ legKey: "start_to_lead_found", to: { key: "lead_found" } }] },
  ],
  triggers: [
    { id: "lead_requested", label: "Lead requested", description: "A campaign needs a new person to contact.", icon: "user-focus" },
    { id: "positive_reply_received", label: "Positive reply", description: "A prospect replied with interest.", icon: "thumbs-up" },
  ],
});

describe("campaignModeFor", () => {
  it("a proactive leg has no trigger", () => {
    expect(campaignModeFor(catalogue, "sales-cold-email-outreach", "lead_found_to_conversation")).toEqual({ mode: "proactive" });
  });
  it("finds an outbound leg under its legacy spelling too", () => {
    expect(campaignModeFor(catalogue, "sales-cold-email-outreach", "start_to_conversation")).toEqual({ mode: "proactive" });
  });
  it("a reactive leg carries its trigger, label and icon as served", () => {
    expect(campaignModeFor(catalogue, "ai-meeting-booking", "conversation_to_meeting_booked")).toEqual({
      mode: "reactive",
      trigger: { id: "positive_reply_received", label: "Positive reply", description: "A prospect replied with interest.", icon: "thumbs-up" },
    });
    const sourcing = campaignModeFor(catalogue, "sourcing-apollo-cold-filters", "start_to_lead_found");
    expect(sourcing?.mode === "reactive" && sourcing.trigger?.label).toBe("Lead requested");
  });
  it("no mode served = null (never guessed)", () => {
    expect(campaignModeFor(catalogue, "older-producer", "start_to_lead_found")).toBeNull();
    expect(campaignModeFor(catalogue, "unknown", "x")).toBeNull();
  });
});

describe("the campaign row reads its mode off the catalogue", () => {
  const read = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");
  it("the Type cell is the mode chip, fed the row's channel and leg", () => {
    expect(read("src/components/v2/offer-campaigns.tsx")).toContain(
      "<CampaignModeChip catalogue={catalogue} featureSlug={campaign.featureSlug} legKey={campaign.legKey} reactive={campaign.reactive} />",
    );
  });
  it("the chip keeps no trigger list: labels come from the catalogue, icons by served token", () => {
    const chip = read("src/components/v2/campaign-mode.tsx");
    expect(chip).toContain("campaignModeFor(catalogue, featureSlug, legKey)");
    expect(chip).not.toContain("positive_reply_received");
    expect(chip).not.toContain("lead_requested");
    expect(chip).toContain("TRIGGER_ICONS[trigger.icon]");
  });
});
