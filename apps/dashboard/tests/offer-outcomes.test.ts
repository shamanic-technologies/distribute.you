import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  legCampaignId,
  parseOfferOutcomes,
  pluralStepLabel,
  unmeasuredReasonWords,
  type CampaignRef,
} from "../src/lib/offer-outcomes";

const SRC = join(__dirname, "..", "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

/**
 * The PRODUCTION body verbatim (features-service v0.174.1, offer `d5ecba00`, brand
 * `75d7e3e8`, 2026-09-25). A fixture written from the producer's docs would pass
 * against a reader that had drifted from the wire; this one is what the wire carries,
 * including a `not_attributable` leg (a count with no price).
 */
const PROD = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "offer-outcomes-prod.json"), "utf8"),
);

describe("parseOfferOutcomes", () => {
  it("parses the production body", () => {
    const body = parseOfferOutcomes(PROD, "test");
    expect(body.outcomes.length).toBeGreaterThan(0);
    for (const row of body.outcomes) expect(row.legs.length).toBeGreaterThan(0);
  });

  it("carries a leg with a count and no price, and says why in words", () => {
    const body = parseOfferOutcomes(PROD, "test");
    const leg = body.outcomes.flatMap((o) => o.legs).find((l) => l.unmeasuredReason === "not_attributable");
    expect(leg).toBeDefined();
    expect(leg!.recipientsReached).toBeGreaterThan(0);
    expect(leg!.costPerOutcomeUsd).toBeNull();
    expect(leg!.roiMultiple).toBeNull();
    expect(unmeasuredReasonWords(leg!.unmeasuredReason)).toBe("Spend can't be tied to these results yet");
  });

  it("accepts a NULL figure the producer means to send", () => {
    const body = structuredClone(PROD);
    body.outcomes[0].roiMultiple = null;
    body.outcomes[0].costPerOutcomeUsd = null;
    body.outcomes[0].unmeasuredReason = "maturing";
    body.outcomes[0].legs[0].recipientsReached = null;
    expect(() => parseOfferOutcomes(body, "test")).not.toThrow();
  });

  it("reads the vocabularies as plain strings, so a new token parses", () => {
    const body = structuredClone(PROD);
    body.outcomes[0].step.key = "some_new_step";
    body.outcomes[0].unmeasuredReason = "a_reason_added_later";
    body.outcomes[0].legs[0].countBasis = "a_new_basis";
    body.outcomes[0].legs[0].legSource = "a_new_source";
    expect(() => parseOfferOutcomes(body, "test")).not.toThrow();
  });

  it("still throws on a body that is not the contract", () => {
    expect(() => parseOfferOutcomes({ outcomes: "nope" }, "test")).toThrow();
  });
});

describe("unmeasuredReasonWords", () => {
  it("states every known reason in words", () => {
    for (const r of [
      "maturing",
      "nothing_spent",
      "no_value_defined",
      "step_not_counted",
      "evidence_unreadable",
      "not_attributable",
    ]) {
      const words = unmeasuredReasonWords(r);
      expect(words).toBeTruthy();
      expect(words).not.toContain("_");
      expect(words).not.toContain("—");
    }
    expect(unmeasuredReasonWords("maturing")).toBe("Too early: results are still coming in");
  });

  it("says nothing when the figure is measured", () => {
    expect(unmeasuredReasonWords(null)).toBeNull();
  });

  it("still says it is unmeasured for a reason it does not know", () => {
    expect(unmeasuredReasonWords("a_reason_added_later")).toBe("Not measured yet");
  });
});

describe("pluralStepLabel", () => {
  it("pluralizes a step as the name of a count", () => {
    expect(pluralStepLabel("Positive reply")).toBe("Positive replies");
    expect(pluralStepLabel("Website visit")).toBe("Website visits");
    expect(pluralStepLabel("Meeting booked")).toBe("Meetings booked");
    expect(pluralStepLabel("Meeting attended")).toBe("Meetings attended");
    expect(pluralStepLabel("Form submitted")).toBe("Forms submitted");
    expect(pluralStepLabel("Signup")).toBe("Signups");
    expect(pluralStepLabel("Paid client")).toBe("Paid clients");
    expect(pluralStepLabel("Purchase")).toBe("Purchases");
  });
});

describe("legCampaignId", () => {
  const active = (s: string) => s === "ongoing";
  const row = (over: Partial<CampaignRef>): CampaignRef => ({
    id: "x",
    offerId: "o1",
    funnelKey: "f1",
    featureSlug: "cold",
    status: "stopped",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...over,
  });

  it("opens the LIVE row when many stored rows are one campaign", () => {
    const campaigns = [
      row({ id: "a", updatedAt: "2026-09-10T00:00:00.000Z" }),
      row({ id: "b", status: "ongoing", updatedAt: "2026-08-01T00:00:00.000Z" }),
      row({ id: "c", updatedAt: "2026-09-20T00:00:00.000Z" }),
    ];
    expect(legCampaignId(["a", "b", "c"], campaigns, active)).toBe("b");
  });

  it("opens the latest when none of them runs", () => {
    const campaigns = [
      row({ id: "a", updatedAt: "2026-09-10T00:00:00.000Z" }),
      row({ id: "c", updatedAt: "2026-09-20T00:00:00.000Z" }),
    ];
    expect(legCampaignId(["a", "c"], campaigns, active)).toBe("c");
  });

  it("links NOTHING when the ids are two different campaigns", () => {
    const campaigns = [row({ id: "a" }), row({ id: "b", funnelKey: "f2" })];
    expect(legCampaignId(["a", "b"], campaigns, active)).toBeNull();
  });

  it("trusts a single id before the campaigns read lands, and nothing more", () => {
    expect(legCampaignId(["a"], undefined, active)).toBe("a");
    expect(legCampaignId(["a", "b"], undefined, active)).toBeNull();
    expect(legCampaignId([], [], active)).toBeNull();
  });
});

describe("the offer Overview surface", () => {
  const table = read("components/offers/offer-outcomes-table.tsx");
  const page = read("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx");
  const api = read("lib/api.ts");

  it("mounts the outcome table at offer grain, not the retired funnels table", () => {
    expect(page).toContain("<OfferOutcomesTable brandId={brandId} offerId={offerId} basePath={basePath} />");
    expect(page).not.toContain("OfferFunnelsPage");
  });

  it("asks the gateway route on the NET basis", () => {
    const block = api.slice(api.indexOf("export async function getOfferOutcomes("));
    expect(block).toContain("`/offers/${offerId}/outcomes?${query.toString()}`");
    expect(block.slice(0, 600)).toContain('query.set("pricing", "net")');
  });

  it("divides nothing, sums nothing and prints no total row", () => {
    expect(table).not.toMatch(/\.reduce\(/);
    expect(table).not.toMatch(/\bTotal\b/);
    expect(table).not.toMatch(/spentUsd\s*\//);
  });

  it("states the producer's reason for a null figure in words", () => {
    expect(table).toContain("unmeasuredReasonWords(reason)");
  });

  it("reveals on settle, so a failed read states it rather than skeletoning forever", () => {
    expect(table).toContain("outcomesQ.isPending && !outcomesQ.isError");
    expect(table).toContain("Couldn&apos;t read this offer&apos;s outcomes");
  });

  it("wears no opacity-modified tint, which escapes the dark remap", () => {
    expect(table).not.toMatch(/bg-[a-z]+-\d+\/\d+/);
  });

  it("carries no em-dash in its copy", () => {
    const copy = table.slice(table.indexOf("return (\n    <div"));
    const stripped = copy.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    // The `—` that stands for "no figure" is a value, not copy; it lives outside JSX text.
    expect(stripped.replace(/"—"/g, "")).not.toMatch(/>[^<{]*—[^<]*</);
  });
});

describe("the funnel level is gone", () => {
  it("has no funnel route under the offer", () => {
    expect(
      existsSync(join(SRC, "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/offers/[offerId]/funnels")),
    ).toBe(false);
  });

  it("the offer sidebar lists Campaigns, not Sales funnels", () => {
    const sidebar = read("components/context-sidebar.tsx");
    expect(sidebar).toContain('href: `${basePath}/campaigns`');
    expect(sidebar).not.toContain("/funnels");
    expect(sidebar).not.toContain("FunnelLevelSidebar");
  });

  it("the offer's Campaigns list is a route of its own", () => {
    expect(
      existsSync(
        join(SRC, "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/offers/[offerId]/campaigns/page.tsx"),
      ),
    ).toBe(true);
  });

  it("the header names no funnel crumb", () => {
    expect(read("components/header-page-context.tsx")).not.toContain("funnel");
  });
});
