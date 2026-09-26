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
describe("Campaign Settings — is it running, and what may it spend", () => {
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
    // A campaign is (offer x leg x channel) and billing keys a ceiling on exactly
    // that address, so this is the campaign's own money — the same stored row Offer
    // Settings edits.
    expect(card).toContain("saveCampaignBudget(");
    expect(card).toContain(
      "{ offerId, legKey: scope.legKey, featureSlug: scope.featureSlug },",
    );
    expect(card).toContain("getBrandCampaignBudgets");
    expect(card).not.toContain("saveBrandFunnelBudget");
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
    expect(card).toContain("campaignSavedCents(scope, budgetData)");
    expect(exists("lib/funnel-channels.ts")).toBe(false);
    const budget = read("lib/campaign-budget.ts");
    expect(budget).toContain("export function campaignSavedCents");
    expect(card).not.toContain("function findCeiling");
  });

  it("stops a campaign by PAUSING it, and says why zero is not the same thing", () => {
    // Zero PAUSES it too — a campaign funded at nothing is held on the funding gate
    // every tick and never sends, so leaving the status at `ongoing` claims something
    // that is not happening. What still differs is the AMOUNT: a pause keeps it,
    // while zero throws it away, and billing's floor only lets a funnel funded under
    // its minimum be kept or raised — so a grandfathered campaign stopped that way
    // could never be restarted at the figure it was running. The copy says both.
    expect(card).toContain('if (trimmed === "") return 0;');
    expect(card).toContain("Setting it");
    expect(card).toContain("to zero pauses the campaign");
    expect(card).toContain("prefer the switch above");
    expect(card).toContain("pausing keeps the");
    expect(card).not.toContain("Set it to zero to stop it");
  });

  it("derives whether it runs through the ONE zero-pauses rule, and writes that", () => {
    // The heading, the switch and the Save read one expression. Two copies is how
    // the card comes to show a campaign as running while the Save pauses it.
    expect(card).toContain('runningAfterBudget,');
    expect(card).toContain("const effectiveRunning = runningAfterBudget({");
    expect(card).toContain("const zeroed = running && !effectiveRunning;");
    expect(card).toContain("const statusDirty = effectiveRunning !== savedRunning;");
    expect(card).toContain("nextRunning: statusDirty ? effectiveRunning : null,");
    expect(card).toContain('aria-checked={effectiveRunning}');
  });

  it("no longer FOOTNOTES the gap it now closes", () => {
    // The card used to say "not sending whatever its status says" under a funded-at-
    // zero campaign, which is a documented limitation standing in for a fix. It says
    // Paused now.
    expect(card).not.toContain("not sending whatever its status says");
  });

  it("flips campaign-service's own status, through the SAME running-word set", () => {
    // A second list of running-words is how the Campaigns table's pill and this
    // page come to disagree about whether one campaign is live.
    expect(card).toContain("setCampaignStatus(campaignId,");
    expect(card).toContain("isRunningStatus(campaign.status)");
    expect(card).toContain('from "@/lib/campaign-controls"');
    expect(card).toContain('role="switch"');
    // campaign-service validates the workflow's tracking headers before it flips
    // the row, so a campaign naming no channel cannot be restarted from here — and
    // neither can one the form has just taken to zero, which is what `zeroed` adds.
    expect(card).toContain("disabled={!campaign.featureSlug || zeroed}");
  });

  it("commits BOTH answers with one Save, and states what it is about to do", () => {
    // A toggle that writes instantly beside a field that does not reads as two
    // rules on one card. Restarting fires the workflow immediately, so it says so.
    expect(card).toContain("const dirty = budgetDirty || statusDirty;");
    expect(card).toContain("starts sending immediately, not at the next daily tick");
    expect(card).toContain("Its daily budget is kept");
    expect(card).toContain("{summary && <p");
  });

  it("puts a figure under the channel's floor BACK to the smallest one allowed", () => {
    // Refusing it and leaving the typed value on screen makes the customer guess
    // what is allowed; naming the floor alone makes them do the subtraction the
    // channel's other ceilings imply. On BLUR, never per keystroke: typing `1` on
    // the way to `10` must not jump to the floor under the cursor.
    expect(card).toContain("onBlur={clampToMinimum}");
    expect(card).toContain("minimumChannelBudgetUsd(minimumCents, savedChannelCents, savedCents)");
    expect(card).toContain("export function budgetClampMessage");
    expect(card).toContain("Pause the campaign instead if you want it to stop for now");
    // Zero is left alone — defunding is an ordinary state, not a refusal.
    expect(card).toContain("typed === null || typed <= 0) return typed;");
    // The clamped figure is RETURNED as well as set: `setValue` does not land
    // before the tick ends, so a Save reading `value` back would write the
    // figure we just refused.
    expect(card).toContain("const nextTyped = clampToMinimum();");
  });

  it("reads the floor off the CHANNEL's published terms, on the channel's total", () => {
    // The floor is a property of the acquisition channel — cold email costs what
    // cold email costs, whatever leg it performs — and it is read from that
    // channel's own published operating cost rather than a table here. billing
    // judges it on the channel's total across the brand, so a customer splitting a
    // funded channel in two is never refused for each half being under a bar the
    // whole clears. Its 400 is what decides.
    expect(card).toContain("channelMinimumCents(minimums, scope?.featureSlug)");
    expect(card).toContain("channelTotalCents(scope.featureSlug, budgetData)");
    expect(card).toContain("channelBudgetBelowMinimum(minimumCents, projected, savedChannelCents)");
    expect(card).not.toContain("FUNNEL_MIN_DAILY_BUDGET_USD");
    // The projection and the clamp read ONE rule, in the alias-free lib, so they
    // carry real unit tests and can never disagree about the same bar.
    const floors = read("lib/channel-minimums.ts");
    expect(floors).toContain("export function projectedChannelTotalUsd");
    expect(floors).toContain("export function minimumChannelBudgetUsd");
    expect(floors).toContain("savedChannelCents - savedOwnCents");
    expect(card).not.toContain("export function projectedChannelTotalUsd");
  });

  it("states a campaign that names no leg or channel instead of guessing one", () => {
    // A campaign naming no leg points at no ceiling.
    const budget = read("lib/campaign-budget.ts");
    expect(budget).toContain("export function campaignBudgetScope");
    expect(budget).toContain("if (!campaign.legKey || !campaign.featureSlug) return null;");
    expect(card).toContain("campaignBudgetScope(campaign, channels)");
    expect(card).toContain("This campaign names no leg, so it has no budget of its own yet.");
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
    expect(card).toContain("value.trim() !== baseline");
  });

  it("re-seeds the field from a fresher payload, never a once-per-mount latch", () => {
    // The local-first cache paints the on-disk snapshot FIRST, so a boolean
    // `hydrated` latch would pin the field to the previous visit's figure.
    expect(card).toContain("seededFrom.current === budgetData");
    expect(card).toContain("if (!touched) setValue(next);");
  });

  it("shows exactly what persisted, so it cannot claim a ceiling billing normalized", () => {
    // billing answers the write with the ONE row it stored; the field shows that,
    // and the brand-wide set is re-read rather than patched.
    expect(card).toContain("const persisted = row.dailyBudgetCents ?? 0;");
    expect(card).toContain("invalidateCampaignMoney(queryClient);");
  });

  it("renders the budget in whole dollars, never cents", () => {
    // A daily budget is a configured ceiling; cents read wrong on one.
    expect(card).toContain("Math.round(savedCents / 100)");
    expect(card).toContain("/ day");
  });

  it("adds no unlisted query root", () => {
    const persist = read("lib/persist-cache.ts");
    for (const root of ["campaign", "campaigns", "brandCampaignBudgets"]) {
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
