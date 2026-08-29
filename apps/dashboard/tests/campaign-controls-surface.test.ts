import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

const trigger = read("components/campaigns/campaign-controls-trigger.tsx");
const modal = read("components/campaigns/campaign-controls-modal.tsx");
const brandPage = read(
  "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
);
const campaignPage = read("components/campaigns/campaign-overview-page.tsx");
const funnelPage = read("components/funnels/funnel-overview-page.tsx");
const api = read("lib/api.ts");

/**
 * Is this running, and how hard — one modal, three entry points.
 *
 * The rows are always CAMPAIGNS whatever the grain. A brand and an offer are
 * SCOPES, not things billing or campaign-service fund, so an editable figure at
 * either grain would have to be split back across the campaigns and no split the
 * customer did not state is honest.
 */
describe("campaign controls — one modal, three grains", () => {
  it("is ONE modal component, mounted through ONE trigger", () => {
    // A second implementation is how a campaign comes to be controlled two ways.
    expect(trigger).toContain("CampaignControlsModal");
    for (const src of [brandPage, campaignPage, funnelPage]) {
      expect(src).toContain("CampaignControlsTrigger");
      expect(src).not.toContain("CampaignControlsModal");
    }
  });

  it("mounts at brand and offer grain from the ONE Overview component", () => {
    // The brand root and `offers/[offerId]` render the same page, so the offer
    // grain falls out of passing the route's own offerId.
    expect(brandPage).toContain("offerId={offerId}");
    expect(brandPage).toContain("<CampaignControlsTrigger");
  });

  it("mounts at campaign grain scoped to that one campaign", () => {
    expect(campaignPage).toContain("campaignId={campaign.id}");
  });

  it("rides the section heading rather than standing above it", () => {
    // A full-width line over the title reads as a second heading. This is an
    // attribute of what the heading names, so it goes in the slot the section
    // already has for exactly that, on the same row and to its right.
    const section = read("components/revenue/revenue-overview-section.tsx");
    expect(section).toContain("lg:justify-between");
    expect(section).toContain("{headerAction}");
    expect(brandPage).toContain("headerAction={ControlsLine}");
    expect(campaignPage).toContain("headerAction={CampaignStatusLine}");
    // ...and nowhere as a sibling of the section itself. The empty-state branch
    // is the one exception, and it sits one level deeper in its own return.
    expect(brandPage).not.toContain("\n      {ControlsLine}\n");
    expect(campaignPage).not.toContain("\n      {CampaignStatusLine}\n");
  });
});

describe("the trigger states money it READS", () => {
  it("states what may be spent TODAY at brand grain, not billing's status-blind total", () => {
    // billing keys a ceiling on (funnel x channel x offer) and stores NO status, so
    // its served brand total counts a paused campaign's money: one running at $50
    // beside one paused at $10 read `$60 / day`. Neither producer can answer this
    // alone, and the join is free — the trigger already holds both reads.
    expect(brandPage).not.toContain("totalCentsOverride");
    expect(brandPage).not.toContain("getBrandDailyBudget");
    expect(brandPage).toContain("<CampaignControlsTrigger brandId={brandId} offerId={offerId} />");
  });

  it("adds up only the RUNNING campaigns' ceilings, at every grain it sums", () => {
    expect(trigger).toContain("scopeTotalCents(rows)");
    const lib = read("lib/campaign-controls.ts");
    expect(lib).toContain("r.running && r.savedCents > 0");
  });

  it("counts one ceiling per campaign, because a row is an identity", () => {
    // campaign-service stores one campaign as many rows; the sum is honest only
    // because `buildControlRows` groups them onto the triple billing funds.
    const lib = read("lib/campaign-controls.ts");
    expect(lib).toContain("runningCampaignIds");
    expect(lib).toContain("pickRepresentative");
  });

  it("prints whole dollars through the one shared formatter", () => {
    expect(trigger).toContain("fmtDailyBudgetUsd");
    expect(trigger).not.toContain("toFixed");
  });
});

describe("the affordance survives a touch screen", () => {
  it('is a role="button" span, never a <button>', () => {
    // It renders inside clickable regions, and a nested button is invalid HTML —
    // the parser closes the outer one early and the surrounding card breaks.
    expect(trigger).toContain('role="button"');
    expect(trigger).toContain("tabIndex={0}");
    expect(trigger).toContain("onKeyDown");
    // Whole-file, deliberately: the trigger renders exactly one interactive
    // element and it is that span, so a `<button>` appearing anywhere in this
    // file is the nesting hazard. A slice would only move the goalposts.
    expect(trigger).not.toContain("<button");
  });

  it("shows its pencil without needing a hover", () => {
    // A hover-revealed control is discoverable only by accident on a mouse and
    // not at all on a finger. The glyph is always painted and only DARKENS on
    // hover, which is the same rule the copy-to-clipboard affordance follows.
    expect(trigger).toContain("group-hover:text-gray-500");
    expect(trigger).not.toContain("opacity-0 group-hover:opacity-100");
  });

  it("reads as a bottom sheet on a phone and a centred dialog above sm", () => {
    expect(modal).toContain("items-end");
    expect(modal).toContain("sm:items-center");
    // A DEFINITE height, never a floor: `min-h-*` lets the column grow past the
    // viewport, the inner region never scrolls, the page does instead, and the
    // Confirm row rides below the fold.
    expect(modal).toContain("max-h-[92vh]");
    expect(modal).toContain("min-h-0 flex-1 overflow-y-auto");
    expect(modal).not.toContain("min-h-[");
  });
});

describe("status and budget stay two independent answers", () => {
  it("stops a campaign through its STATUS, never by zeroing its ceiling", () => {
    // Zero throws the amount away, and billing's per-funnel floor only lets a
    // funnel funded under its minimum be KEPT or RAISED — so a grandfathered
    // campaign stopped that way could never be restarted where it was.
    expect(api).toContain("export async function setCampaignStatus");
    expect(modal).toContain("setCampaignStatus");
    expect(modal).toContain("saveBrandFunnelBudget");
  });

  it("sends the identity headers campaign-service validates before an activate", () => {
    const fn = api.slice(api.indexOf("export async function setCampaignStatus"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    expect(body).toContain('"x-brand-id"');
    expect(body).toContain('"x-feature-slug"');
  });

  it("says that restarting spends now, not at the next tick", () => {
    // `activate` fires the workflow immediately, so the summary above the button
    // that does it states so rather than reporting it afterwards.
    expect(modal).toContain("Restarting sends right away");
  });

  it("states the diff before Confirm commits it", () => {
    expect(modal).toContain("diffSummary");
    expect(modal).toContain("hasChanges(diff)");
  });
});

describe("a fan-out reports itself honestly", () => {
  it("keeps the modal open and names the row when a write fails", () => {
    expect(modal).toContain("setFailures(nextFailures)");
    // The early return is what stops it closing on a partial success.
    const confirm = modal.slice(modal.indexOf("async function confirm()"));
    expect(confirm.slice(0, confirm.indexOf("\n  }"))).toContain("return;");
  });

  it("renders OUR copy branched on the status, never the downstream body", () => {
    // `apiCall` puts the whole downstream response body verbatim into the thrown
    // Error's message, and the api-service PATCH-campaign proxy flattens
    // campaign-service's body into an `error` string on top of that.
    expect(modal).toContain("controlWriteErrorMessage");
    expect(modal).not.toContain("err.message");
    expect(modal).not.toContain("error.message");
  });

  it("writes only what the form CHANGED", () => {
    expect(modal).toContain("controlsDiff(rows, drafts)");
    expect(modal).not.toContain("rows.map((row) => saveBrandFunnelBudget");
  });
});

describe("no aggregate is editable anywhere", () => {
  it("offers a field per campaign and none for a scope", () => {
    // One `<input>` in the whole modal, inside the row loop.
    expect(modal.match(/<input/g)?.length ?? 0).toBe(1);
    expect(trigger).not.toContain("<input");
  });

  it("re-seeds the form from the payload rather than latching once per mount", () => {
    // A once-per-mount latch pins the form to the on-disk snapshot the
    // local-first cache paints first and ignores the fresher answer behind it.
    expect(modal).toContain("seededFrom");
    expect(modal).toContain("touched.has(row.rowId)");
  });
});

describe("the funnel grain states the same two answers as its offer", () => {
  it("mounts the shared trigger, narrowed to this funnel of this offer", () => {
    // Narrowed by BOTH: billing keys a ceiling on (funnel x channel x offer), so a
    // bare funnel spans every offer selling it and would list a sibling offer's
    // campaigns under this one's name.
    const at = funnelPage.indexOf("<CampaignControlsTrigger");
    expect(at).toBeGreaterThan(-1);
    const call = funnelPage.slice(at, funnelPage.indexOf("/>", at));
    expect(call).toContain("offerId={offerId}");
    expect(call).toContain("funnelKey={rawKey || null}");
  });

  it("states the SERVED running figure the cost card below already divides by", () => {
    // One number on one screen: summing the trigger's own rows here would let the
    // header and the card disagree about what this funnel may spend today.
    const at = funnelPage.indexOf("<CampaignControlsTrigger");
    const call = funnelPage.slice(at, funnelPage.indexOf("/>", at));
    expect(call).toContain("totalCentsOverride={funnelDailyBudgetCents}");
    expect(funnelPage).toContain("dailyBudgetCents={funnelDailyBudgetCents}");
  });

  it("rides the section heading rather than standing as a band above it", () => {
    expect(funnelPage).toContain("headerAction={");
  });
});

describe("the modal files each campaign under its sales funnel", () => {
  it("groups the rows through the ONE derivation, never a second grouping", () => {
    expect(modal).toContain("groupControlRowsByFunnel(rows)");
    expect(modal).toContain("<FunnelHeading");
  });

  it("suppresses the heading when the modal is ALREADY scoped to one funnel", () => {
    // That page names the funnel above the control that opened this, and saying it
    // twice on one screen is chrome rather than clarity.
    expect(modal).toContain("const showFunnelHeadings = !funnelKey;");
  });

  it("states the funnel's figures from the DRAFTS, and writes neither", () => {
    // The daily budget is read-only at funnel grain: billing keys a ceiling on
    // (funnel x channel x offer), so the only fundable thing is a campaign and a
    // funnel-level field would have to split its figure back across them.
    const at = modal.indexOf("function FunnelHeading(");
    expect(at).toBeGreaterThan(-1);
    const body = modal.slice(at, modal.indexOf("\n}\n", at));
    expect(body).toContain("groupHeadingState(group.rows, drafts)");
    expect(body).not.toContain("<input");
    // The switch DOES write — a status is per campaign, so flipping the heading
    // sets every campaign under it.
    expect(body).toContain('role="switch"');
    expect(modal).toContain("function setGroupRunning(");
  });
});
