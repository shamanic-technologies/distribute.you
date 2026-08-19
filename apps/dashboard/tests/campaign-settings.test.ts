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
describe("Campaign Settings", () => {
  const card = read("components/settings/campaign-settings-card.tsx");
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

  it("edits ONLY the four fields campaign-service stores per campaign", () => {
    const api = read("lib/api.ts");
    const patch = api.slice(
      api.indexOf("export type CampaignSettingsPatch"),
      api.indexOf("export type CampaignSettingsPatch") + 260,
    );
    for (const field of ["name", "audienceIds", "servicesOffered", "clickDestinationUrl"]) {
      expect(patch).toContain(field);
    }
    // The budget is a MIRROR of the (funnel x channel) ceiling funded on Offer
    // Settings, not an independent knob — a second editable figure would diverge
    // from the one billing charges. The offer / funnel / channel / feature are what
    // the campaign IS, so changing one makes it a different campaign. `goal` is
    // legacy and read-only.
    for (const banned of [
      "maxBudgetDailyUsd",
      "dailyBudgetCents",
      "funnelKey",
      "offerId",
      "featureSlug",
      "goal",
    ]) {
      expect(patch).not.toContain(banned);
    }
  });

  it("sends the DIFF, so an untouched field is omitted and a cleared one is null", () => {
    // campaign-service leaves an omitted key untouched and clears an explicit null,
    // which is the only reason "inherit" is expressible at all.
    expect(card).toContain("export function buildCampaignPatch");
    expect(card).toContain('draft.audienceSource === "own" ? draft.audienceIds : null');
    expect(card).toContain('draft.servicesSource === "own" ? draft.services : null');
    expect(card).toContain('draft.destinationSource === "own" ? draft.destination.trim() : null');
  });

  it("states whether a field is inherited, and never leaves it to a blank box", () => {
    // The whole point of the screen: a blank input cannot tell "this campaign sends
    // people nowhere" from "this campaign uses the brand's destination", and those
    // are opposite meanings. Every inheritable field is a stated CHOICE plus, only
    // under the second option, the input.
    expect(card).toContain('type Source = "inherit" | "own"');
    expect(card).toContain("function SourceChoice");
    for (const field of ["audienceSource", "servicesSource", "destinationSource"]) {
      expect(card).toContain(`${field}: Source`);
      expect(card).toContain(`draft.${field} === "own" && (`);
    }
    // And it shows what inheriting resolves to, so "inherit" is not a promise the
    // reader has to go and verify.
    expect(card).toContain("inheritedValue");
  });

  it("refuses an emptied override instead of persisting a third state", () => {
    // The wire has no empty state (`minItems: 1` / `minLength: 1`), so an emptied
    // override is an unfinished edit — and the refusal names the two real options.
    expect(card).toContain("export function campaignSettingsBlocker");
    expect(card).toContain("or switch it back to inheriting the brand's.");
    expect(card).toContain("disabled={blocker !== null}");
  });

  it("prints its own copy on a refusal, never the api client's message", () => {
    // `apiCall` puts the whole downstream body verbatim into `ApiError.message`.
    expect(card).toContain("export function campaignSettingsErrorMessage");
    expect(card).toContain("err instanceof ApiError");
    expect(card).not.toContain("error.message");
    expect(card).not.toContain("err.message");
  });

  it("uses the shared Save row and a LIVE dirty compare", () => {
    // Not a fifth hand-rolled copy, and not a sticky edited latch — typing a value
    // and undoing it has to disarm the button.
    expect(card).toContain("<SettingsSaveRow");
    expect(card).not.toContain('{saving ? "Saving..." : "Save"}');
    expect(card).toContain("const patch = buildCampaignPatch(draft, baseline);");
    expect(card).toContain("const dirty = Object.keys(patch).length > 0;");
  });

  it("re-seeds the form from a fresher payload, never a once-per-mount latch", () => {
    // The local-first cache paints the on-disk snapshot FIRST, so a boolean
    // `hydrated` latch would pin the form to the previous visit's copy and ignore
    // the server answer that lands a moment later.
    expect(card).toContain("seededFrom.current === campaign");
    expect(card).toContain("if (!touched) setDraft(next);");
  });

  it("writes the response into the cache, then invalidates the list", () => {
    expect(card).toContain('queryClient.setQueryData(["campaign", campaignId], res);');
    expect(card).toContain('queryClient.invalidateQueries({ queryKey: ["campaigns"] });');
  });

  it("adds no unlisted query root", () => {
    // Every read it makes is a key the rest of the app already persists, so the page
    // paints from disk instead of cold-skeletoning on every visit.
    const persist = read("lib/persist-cache.ts");
    for (const root of ["campaign", "campaigns", "audiences", "brand", "brandUserFields"]) {
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
