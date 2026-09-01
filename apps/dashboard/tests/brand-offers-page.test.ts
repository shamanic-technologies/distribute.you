import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("the brand has an Offers page of its own", () => {
  it("has a route at the brand level, not under an offer", () => {
    expect(
      existsSync(
        join(
          process.cwd(),
          "src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/offers/page.tsx",
        ),
      ),
    ).toBe(true);
  });

  // It is to the brand what Campaigns is to an offer: the Overview carries the
  // table under its chart, this gives it a page. ONE component serves both, or a
  // row reads one way here and another one click over.
  it("renders the same table the Overview does, not a copy of it", () => {
    expect(read("src/components/offers/offers-page.tsx")).toContain("OffersTable");
    expect(
      read("src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx"),
    ).toContain("OffersTable");
  });

  it("sits directly under Overview in the brand sidebar", () => {
    const sidebar = read("src/components/context-sidebar.tsx");
    const body = sidebar.slice(sidebar.indexOf("function BrandLevelSidebar"), sidebar.indexOf("function BrandLevelSidebar") + 4500);
    const overviewAt = body.indexOf('id: "overview"');
    const offersAt = body.indexOf('id: "brand-offers"');
    const leadsAt = body.indexOf('id: "brand-leads"');
    expect(overviewAt).toBeGreaterThan(-1);
    expect(offersAt).toBeGreaterThan(overviewAt);
    expect(leadsAt).toBeGreaterThan(offersAt);
  });

  // The money a header tile would carry is already stated on the Overview this
  // page sits beside. Printing it twice invites the two to disagree.
  it("carries no money tile of its own", () => {
    const page = read("src/components/offers/offers-page.tsx");
    expect(page).not.toContain("getFeatureRevenue");
    expect(page).not.toContain("totalPipelineUsd");
  });
});

/**
 * On a phone the table answers the two questions a reader can act on: which offer,
 * and what it returns. The three columns behind them fold away rather than
 * scrolling sideways off the screen.
 *
 * The floor is the part that has to be breakpoint-gated: an unconditional
 * `min-w-[720px]` re-widens the row past the viewport even with every other column
 * hidden, which pushes the ones that survived off to the right and reads as missing
 * data (CLAUDE.md, the leads-table case).
 */
describe("the Offers table fits a phone", () => {
  const table = read("src/components/offers/offers-table.tsx");

  it("gates the width floor at the breakpoint the columns come back", () => {
    expect(table).toContain("md:min-w-[720px]");
    // The bare floor would apply at every width, which is the bug.
    expect(table).not.toMatch(/[^:]min-w-\[720px\]/);
  });

  // `truncate` alone does nothing in the default auto layout: the column grows to
  // its content, so one long offer name widens the whole row. Fixed layout plus an
  // explicit share per mobile column is what makes the truncation bite.
  it("lays the two mobile columns out fixed, ROI beside the name", () => {
    expect(table).toContain("table-fixed");
    expect(table).toContain("md:table-auto");
    expect(table).toContain('w-[30%] md:w-auto');
    expect(table).toContain('w-[70%] md:w-auto');
  });

  // The offer leads the row: it is what the line is about, and the numbers behind
  // it qualify it. The mark is the SHARED component the top bar and the tenant
  // switcher draw — a second icon definition is how two surfaces come to disagree
  // about what an offer looks like.
  it("leads with the offer, wearing the shared offer mark", () => {
    const head = table.indexOf("<thead>");
    expect(table.indexOf(">Offer</th>", head)).toBeLessThan(table.indexOf('label="ROI"', head));
    expect(table).toContain('import { OfferMark } from "@/components/marks/offer-mark"');
    expect(table).toContain('<OfferMark size="sm" />');
    // truncate only bites inside a fixed-layout cell when the flex wrapper can shrink
    expect(table).toContain("flex min-w-0 items-center");
  });

  // ROI and the offer name stay; the three money columns behind them fold. Each
  // column carries the class on BOTH its header and its cell, or the header row
  // and the body rows disagree about how many columns there are.
  it("folds % CAC, $ Revenue and $ Invested away below md", () => {
    expect((table.match(/hidden md:table-cell/g) ?? []).length).toBe(6);
    for (const label of ["% CAC", "$ Revenue", "$ Invested"]) {
      const at = table.indexOf(`label="${label}"`);
      expect(at).toBeGreaterThan(-1);
      // the header cell opening this label carries the fold
      expect(table.slice(table.lastIndexOf("<th", at), at)).toContain("hidden md:table-cell");
    }
  });
});

describe("an offer states Learning on its RATIOS while every campaign selling it is", () => {
  const table = read("src/components/offers/offers-table.tsx");
  const hook = read("src/lib/use-offer-learning.ts");

  it("gates ROI and % CAC on the offer's own learning flag", () => {
    // The two are one statement in two units — a return and its reciprocal — so showing
    // one beside a tag would let a reader trust the number we just said we could not
    // stand behind.
    expect(table).toContain("learning ? <LearningTag withInfo={false} paused={paused} /> : <RoiCell");
    expect(table).toContain(
      "learning ? <LearningTag withInfo={false} paused={paused} /> : fmtPct(revenue?.costOfAcquisitionPct)",
    );
  });

  it("never gates the two money TOTALS", () => {
    // `$ Revenue` grows with each outcome instead of being decided by whichever one
    // landed, and `$ Invested` is money already spent. Neither divides by a count.
    expect(table).toContain("{fmtUsd(revenue?.totalPipelineUsd)}");
    expect(table).toContain("{fmtUsd(revenue?.committedCostUsd)}");
    expect(table).not.toContain("learning ? <LearningTag withInfo={false} paused={paused} /> : fmtUsd");
  });

  it("sinks a learning row below the measured ones rather than ranking it on a hidden number", () => {
    const at = table.indexOf("const rows = useMemo<OfferRow[]>");
    const body = table.slice(at, at + 1200);
    expect(body).toContain("Number(a.learning) - Number(b.learning)");
    expect(body).toContain("if (a.learning) return 0;");
  });

  it("asks the question once for every offer, through the offer-scoped branch", () => {
    // Per offer is impossible (hooks are not loopable) and the brand-grain branch is
    // pinned to ONE channel, so an offer's measured campaign on a second channel would
    // be invisible and the row would read Learning for good.
    expect(hook).toContain("useCampaignRows(brandId, featureSlug, ALL_OFFERS)");
    expect(hook).toContain("scopeIsLearning(offerRows)");
    // The call site, not only the hook: a page that computes nothing renders nothing.
    expect(table).toContain("useOfferLearning(");
    expect(table).toContain("offerLearningFor(learningByOfferId, o.offerId, learningSettled)");
  });

  it("reads an offer with NO campaigns as unmeasured, never as learning", () => {
    // Nothing to have an opinion about, so the row reads exactly as it does today —
    // same default as `scopeIsLearning` on an empty list. An unsettled read likewise.
    const at = hook.indexOf("export function offerLearningFor");
    const body = hook.slice(at, at + 400);
    expect(body).toContain("if (!settled || !offerId) return false;");
    expect(body).toContain("map.get(offerId) ?? false");
  });

  it("keeps every offer's campaigns spanning the channels it is sold through", () => {
    const rows = read("src/components/campaigns/campaigns-table.tsx");
    expect(rows).toContain('export const ALL_OFFERS = "*";');
    expect(rows).toContain(
      "offerId === ALL_OFFERS ? c.offerId != null : c.offerId === offerId",
    );
  });
});
