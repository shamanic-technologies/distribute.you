import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const helperPath = path.resolve(__dirname, "../src/lib/outlet-csv.ts");

const outletPages = {
  brand: path.resolve(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/outlets/page.tsx",
  ),
  feature: path.resolve(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/outlets/page.tsx",
  ),
  campaign: path.resolve(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/campaigns/[id]/outlets/page.tsx",
  ),
};

describe("buildOutletCsv helper", () => {
  const src = fs.readFileSync(helperPath, "utf-8");

  it("exports buildOutletCsv built on the shared toCsv infra", () => {
    expect(src).toContain("export function buildOutletCsv");
    expect(src).toContain('from "@/components/report/csv"');
    expect(src).toContain("return toCsv(rows, columns);");
  });

  it("ships the card-mirroring columns, including DR and purchase price", () => {
    for (const label of [
      '"Outlet"',
      '"Domain"',
      '"URL"',
      '"Status"',
      '"DR"',
      '"Purchase Price"',
      '"Relevance %"',
      '"Why Relevant"',
      '"Campaigns"',
      '"Discovered"',
      '"Cost (USD)"',
    ]) {
      expect(src).toContain(label);
    }
  });

  it("renders Status via statusLabel(displayStatusFor) so the CSV matches the card badge", () => {
    expect(src).toContain("statusLabel(displayStatusFor(o))");
  });

  it("renders DR and purchase price through page-scoped resolvers", () => {
    expect(src).toContain("drFor(o)");
    expect(src).toContain("purchasePriceFor(o)");
  });

  it("renders the best-score campaign why relevant note on the outlet row", () => {
    expect(src).toContain("whyRelevantForBestRelevanceCampaign(outlet.campaigns)");
    expect(src).not.toContain('join(" | ")');
    expect(src).toContain("whyRelevantFor(o)");
  });

  it("sorts by relevance desc (most relevant first)", () => {
    expect(src).toContain("b.relevanceScore - a.relevanceScore");
  });
});

describe("outlet pages wire the Download CSV button", () => {
  for (const [level, p] of Object.entries(outletPages)) {
    const content = fs.readFileSync(p, "utf-8");

    it(`${level} page imports and renders CsvDownloadButton`, () => {
      expect(content).toContain('from "@/components/report/csv-button"');
      expect(content).toContain('from "@/lib/outlet-csv"');
      expect(content).toContain("<CsvDownloadButton");
    });

    it(`${level} page exports the FULL list (outlets), not the tab/search-filtered subset`, () => {
      expect(content).toMatch(/buildOutletCsv\(\s*outlets/);
      expect(content).not.toMatch(/buildOutletCsv\(\s*(filteredOutlets|displayedOutlets)/);
    });

    it(`${level} page wires cached DR and purchase price into cards and CSV`, () => {
      expect(content).toContain("getDomainDrStatuses");
      expect(content).toContain('"outletDomainDrStatuses"');
      expect(content).toContain("domainRating=");
      expect(content).toContain("formatPurchasePrice(o)");
      expect(content).toContain("Purchase Price");
    });

    it(`${level} page renders only a paginated slice of the filtered outlet list`, () => {
      expect(content).toContain('from "@/components/table-pagination"');
      expect(content).toContain("usePaginated(filteredOutlets)");
      expect(content).toContain("paginatedOutlets.pageItems.map");
      expect(content).toContain("<TablePager");
      expect(content).not.toContain("filteredOutlets.map((outlet)");
    });

    it(`${level} page can fetch missing DR from the detail panel`, () => {
      expect(content).toContain("computeDomainDr");
      expect(content).toContain("useMutation");
      expect(content).toContain("queryClient.setQueryData<DomainDrStatus[]>");
      expect(content).toContain("Fetch DR");
      expect(content).toContain("No DR found");
    });
  }
});
