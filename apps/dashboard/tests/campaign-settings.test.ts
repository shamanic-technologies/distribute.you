import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");
const exists = (rel: string) => fs.existsSync(path.join(SRC, rel));

const APP = "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]";
const CAMPAIGN = `${APP}/offers/[offerId]/campaigns/[id]`;

/**
 * These are source-substring guards, not unit tests: the card imports through the
 * `@` alias, which vitest does not resolve in this repo, so its exported helpers
 * cannot be called from here.
 */
describe("Campaign Settings — the daily budget, and only that", () => {
  const card = read("components/settings/campaign-settings-card.tsx");
  const page = read(`${CAMPAIGN}/settings/page.tsx`);
  const sidebar = read("components/context-sidebar.tsx");

  it("sits under the campaign, with its entry in the campaign sidebar", () => {
    expect(exists(`${CAMPAIGN}/settings/page.tsx`)).toBe(true);

    const campaignLevel = sidebar.slice(
      sidebar.indexOf("function CampaignLevelSidebar"),
      sidebar.indexOf("function OfferLevelSidebar"),
    );
    expect(campaignLevel).toContain('label: "Campaign Settings"');
    expect(campaignLevel).toContain("href: `${campaignBase}/settings`");
  });

  it("carries a daily budget and nothing else", () => {
    // What a campaign SAYS and who it says it to are statements about the offer,
    // which has its own Settings page. Four editable copies of the offer's answer
    // one click below the offer itself is what this screen used to be.
    expect(card).toContain("Daily budget");
    for (const gone of [
      "Click destination",
      "Services offered",
      "SourceChoice",
      "ChipList",
      "audienceSource",
      "servicesSource",
      "destinationSource",
      "listAudiences",
      "getBrandUserFields",
    ]) {
      expect(card).not.toContain(gone);
    }
    expect(page).toContain("may spend in a day");
  });

  it("edits BILLING's own row, never a campaign-service mirror of it", () => {
    // A campaign is (offer x funnel x channel) and billing keys a ceiling on
    // exactly that triple, so this is the campaign's own money — the same stored
    // row Offer Settings edits for every channel of the funnel at once.
    expect(card).toContain("saveBrandFunnelBudget(brandId, scope!.def.key, cents, scope!.featureSlug, offerId)");
    expect(card).toContain("getBrandFunnelBudgets");
    expect(card).not.toContain("updateCampaign");
    expect(card).not.toContain("maxBudgetDailyUsd");
  });

  it("dropped the per-campaign settings write rather than leaving it unrendered", () => {
    const api = read("lib/api.ts");
    expect(api).not.toContain("export type CampaignSettingsPatch");
    expect(api).not.toContain("export async function updateCampaign(");
  });

  it("reads the ONE narrowing every budget surface reads", () => {
    // A second copy of it is how this page, Offer Settings, the Campaigns table
    // and the campaign Overview would start disagreeing about one campaign's
    // money. The card holds no copy of its own: it imports the shared helpers.
    expect(card).toContain('from "@/lib/campaign-budget"');
    expect(card).toContain("campaignSavedCents");
    const lib = read("lib/funnel-channels.ts");
    expect(lib).toContain("export function offerScopedCents");
    expect(lib).toContain("savedCents: offerScopedCents(");
    const budget = read("lib/campaign-budget.ts");
    expect(budget).toContain("export function campaignSavedCents");
    expect(budget).toContain("return offerScopedCents(");
  });

  it("treats zero as the stop, and states what it means", () => {
    // Zero is an ordinary value: it is how a customer stops this campaign without
    // losing anything they told us about how it sells.
    expect(card).toContain('if (trimmed === "") return 0;');
    expect(card).toContain("Set it to zero to stop it");
    expect(card).toContain("not funded right now, so it is not sending");
  });

  it("binds the floor to the FUNNEL total, through the shared helpers", () => {
    // A customer splitting one funded funnel across two offers must not be
    // refused for each half being under a bar the whole clears. billing holds the
    // same rule and its 400 is what decides.
    expect(card).toContain("funnelBudgetBelowMinimum");
    expect(card).toContain("funnelBudgetFloorMessage");
    expect(card).toContain("export function projectedFunnelTotalUsd");
    expect(card).toContain("savedFunnelCents - savedOwnCents");
  });

  it("states a campaign that names no funnel or channel instead of guessing one", () => {
    // The pre-funnel campaigns predate the model, so they point at no ceiling.
    const budget = read("lib/campaign-budget.ts");
    expect(budget).toContain("export function campaignBudgetScope");
    expect(budget).toContain("if (!campaign.funnelKey || !campaign.featureSlug) return null;");
    expect(card).toContain("campaignBudgetScope(campaign)");
    expect(card).toContain("predates the sales funnels");
  });

  it("prints its own copy on a refusal, never the api client's message", () => {
    // `apiCall` puts the whole downstream body verbatim into `ApiError.message`.
    expect(card).toContain("export function campaignBudgetErrorMessage");
    expect(card).toContain("err instanceof ApiError");
    expect(card).not.toContain("error.message");
    expect(card).not.toContain("err.message");
  });

  it("uses the shared Save row and a LIVE dirty compare", () => {
    expect(card).toContain("<SettingsSaveRow");
    expect(card).not.toContain('{saving ? "Saving..." : "Save"}');
    expect(card).toContain("const dirty = value.trim() !== baseline;");
  });

  it("re-seeds the field from a fresher payload, never a once-per-mount latch", () => {
    // The local-first cache paints the on-disk snapshot FIRST, so a boolean
    // `hydrated` latch would pin the field to the previous visit's figure.
    expect(card).toContain("seededFrom.current === budgetData");
    expect(card).toContain("if (!touched) setValue(next);");
  });

  it("shows exactly what persisted, so it cannot claim a ceiling billing normalized", () => {
    expect(card).toContain('queryClient.setQueryData(["brandFunnelBudgets", brandId], set);');
    expect(card).toContain("const persisted = scope ? campaignSavedCents(scope, offerId, set) : 0;");
  });

  it("renders the budget in whole dollars, never cents", () => {
    // A daily budget is a configured ceiling; cents read wrong on one.
    expect(card).toContain("Math.round(savedCents / 100)");
    expect(card).toContain("/ day");
  });

  it("adds no unlisted query root", () => {
    const persist = read("lib/persist-cache.ts");
    for (const root of ["campaign", "campaigns", "brandFunnelBudgets"]) {
      expect(persist).toContain(`"${root}"`);
    }
  });
});

/**
 * The brand kept a Leads list when audiences moved down to the offer, because a
 * lead is a PERSON rather than a statement about a proposition.
 */
describe("the brand-level Leads page", () => {
  const page = read(`${APP}/leads/page.tsx`);

  it("lives at /leads, not under the offer's audiences segment", () => {
    expect(exists(`${APP}/leads/page.tsx`)).toBe(true);
    expect(exists(`${APP}/audiences/leads/page.tsx`)).toBe(false);
  });

  it("renders the SAME component unscoped, never a second page body", () => {
    expect(page).toContain("<EngagedLeadsPage");
    expect(page).not.toContain("campaignId=");
  });

  it("states what it returns rather than claiming to be the offers added up", () => {
    // It is very nearly every offer's leads summed, and it is not exactly that: a
    // campaign created before the offer level names no offer, so its leads are here
    // and under no offer at all.
    expect(page).toContain("scopeNote=");
    expect(page).toContain("whichever offer it was contacted for");
    expect(page).toContain("they appear under no offer");
    expect(page).not.toContain("every offer's leads put together");

    const leads = read("components/audiences/engaged-leads-page.tsx");
    expect(leads).toContain("scopeNote?: string;");
    expect(leads).toContain("{scopeNote && <p");
  });
});
