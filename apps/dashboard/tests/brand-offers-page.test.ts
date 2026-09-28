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
    // The offer's own generated image rides the shared mark; the glyph is its fallback.
    expect(table).toContain('<OfferMark size="sm" imageUrl={offer.imageUrl} />');
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

describe("an offer states Learning on its RATIOS where features-service says it is not mature", () => {
  const table = read("src/components/offers/offers-table.tsx");

  it("reads the MATURE half of the offer's served economics pair", () => {
    // features-service#1196: the offer group carries {flash, mature, isMature} for its
    // ratios; the customer reads the mature half and the tag rides the served verdict.
    expect(table).toContain("revenue?.economicsMaturity");
    expect(table).toContain('shownFigure(pair, (h) => h.roiMultiple, "mature")');
    expect(table).toContain('shownFigure(pair, (h) => h.costOfAcquisitionPct, "mature")');
    // No browser-side threshold, no campaign fan-out deciding it.
    expect(table).not.toContain("useOfferLearning");
    expect(table).not.toContain("learning-threshold");
    expect(existsSync(join(process.cwd(), "src/lib/use-offer-learning.ts"))).toBe(false);
  });

  it("gates ROI and % CAC on that verdict, each on its own figure", () => {
    expect(table).toContain(
      "roi.learning ? <LearningTag withInfo={false} paused={paused} /> : <RoiCell multiple={roi.value} />",
    );
    expect(table).toContain(
      "cacPct.learning ? <LearningTag withInfo={false} paused={paused} /> : fmtPct(cacPct.value)",
    );
  });

  it("never gates the two money TOTALS", () => {
    // `$ Revenue` grows with each outcome instead of being decided by whichever one
    // landed, and `$ Invested` is money already spent. Neither divides by a count.
    expect(table).toContain("{fmtUsd(revenue?.totalPipelineUsd)}");
    expect(table).toContain("{fmtUsd(revenue?.committedCostUsd)}");
    expect(table).not.toContain("<LearningTag withInfo={false} paused={paused} /> : fmtUsd");
  });

  it("sinks a learning row below the measured ones rather than ranking it on a hidden number", () => {
    const at = table.indexOf("const rows = useMemo<OfferRow[]>");
    const body = table.slice(at, table.indexOf("// Reveal on SETTLE", at));
    expect(body).toContain("Number(a.roi.learning) - Number(b.roi.learning)");
    expect(body).toContain("if (a.roi.learning) return 0;");
  });

  it("keeps every offer's campaigns spanning the channels it is sold through", () => {
    const rows = read("src/components/campaigns/campaigns-table.tsx");
    expect(rows).toContain('export const ALL_OFFERS = "*";');
    expect(rows).toContain(
      "offerId === ALL_OFFERS ? c.offerId != null : c.offerId === offerId",
    );
  });
});
