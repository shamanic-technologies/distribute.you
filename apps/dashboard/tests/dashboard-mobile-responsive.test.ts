import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Dashboard mobile responsiveness", () => {
  const dashboardLayout = fs.readFileSync(
    path.join(__dirname, "../src/app/(authed)/(dashboard)/layout.tsx"),
    "utf-8",
  );
  const contextSidebar = fs.readFileSync(
    path.join(__dirname, "../src/components/context-sidebar.tsx"),
    "utf-8",
  );
  const leadsPage = fs.readFileSync(
    path.join(__dirname, "../src/components/audiences/engaged-leads-page.tsx"),
    "utf-8",
  );
  // The company mark moved to its own module when the leads BOARD started drawing it
  // too — one implementation, so a card and a row cannot disagree about a company.
  const companyLogo = fs.readFileSync(
    path.join(__dirname, "../src/components/company-logo.tsx"),
    "utf-8",
  );
  const billingPage = fs.readFileSync(
    path.join(__dirname, "../src/app/(authed)/(dashboard)/orgs/[orgId]/billing/page.tsx"),
    "utf-8",
  );
  // The offer card left brand Settings for Offer Settings: what a proposition
  // promises belongs to the offer, not to the brand's identity.
  const offerSettingsPage = fs.readFileSync(
    path.join(
      __dirname,
      "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/offers/[offerId]/settings/page.tsx",
    ),
    "utf-8",
  );

  it("keeps the dashboard shell from horizontal overflow", () => {
    // L-shaped shell: the sidebar is a full-height column and the header + main
    // are the column beside it, so the row wrapper is the shell root itself.
    expect(dashboardLayout).toContain("h-screen flex bg-gray-50 overflow-hidden");
    expect(dashboardLayout).toContain("flex min-w-0 flex-1 flex-col overflow-hidden");
    expect(dashboardLayout).toContain("min-w-0 flex-1 overflow-y-auto");
    expect(contextSidebar).toContain("max-w-[85vw]");
    expect(contextSidebar).toContain("min-w-0 flex-1 truncate");
  });

  // The leads table is the dashboard's one dense table. Below `md` it narrows to two
  // columns — Company and Status — and the Contact / Audience / Date columns fold into
  // them, so a phone gets the whole row inside the viewport instead of a sideways
  // scroll. The 720px floor only applies once every column is back.
  const leadsTable = () => {
    const at = leadsPage.indexOf("function LeadsTable(");
    expect(at).toBeGreaterThan(-1);
    // The function measures ~7.6k; the headroom is for the next comment added
    // inside it, which would otherwise silently push the last assertion's target
    // out of the haystack and read as "the code is missing".
    return leadsPage.slice(at, at + 12000);
  };

  it("fits the leads table in a phone viewport instead of scrolling sideways", () => {
    const table = leadsTable();
    expect(table).toContain("overflow-x-auto");
    expect(table).toContain('className="w-full table-fixed text-sm md:table-auto md:min-w-[720px]"');
    // The old unconditional floor forced 720px at every width, so the card scrolled
    // sideways on a phone even though four columns were already hidden.
    expect(table).not.toContain("w-full min-w-[720px] text-sm");
    // `table-fixed` is load-bearing, not decoration: in the default auto layout a
    // column grows to its content, so a long audience/company name overflowed the row
    // however many `truncate`s it carried (measured 649px in a 360px viewport).
    expect(table).toContain('w-[62%] md:w-auto');
    expect(table).toContain('w-[38%] md:w-auto');
  });

  it("keeps Company and Status as the two mobile columns", () => {
    const table = leadsTable();
    // Status was hidden below `sm`, which is why a phone never showed the tag.
    expect(table).toContain('className="px-4 py-3 w-[38%] md:w-auto">Status</th>');
    expect(table).toContain('hidden md:table-cell">Contact</th>');
    // The company leads the cell at every width, so the header needs no variant.
    expect(table).toContain('className="px-4 py-3 w-[62%] md:w-auto">Company</th>');
  });

  it("folds the audience under the company name and the date under the tag", () => {
    const table = leadsTable();
    // One large company mark, then company name over audience name.
    expect(table).toContain('className="md:hidden flex items-center gap-3"');
    expect(table).toContain("size={40}");
    expect(table).toContain('<p className="truncate font-medium text-gray-800">{companyName}</p>');
    expect(table).toContain('{audience && <p className="truncate text-xs text-gray-500">{audience.name}</p>}');
    expect(table).toContain('className="mt-1 md:hidden">{dateNode}');
    // Complementary, never both at once: each folded column stays `hidden md:table-cell`.
    expect(table).toContain('hidden md:table-cell">Audience</th>');
    expect(table).toContain('hidden md:table-cell">Date</th>');
  });

  it("sizes the company mark by style, since a class cannot be built from a prop", () => {
    const at = companyLogo.indexOf("function CompanyLogo(");
    expect(at).toBeGreaterThan(-1);
    const logo = companyLogo.slice(at, at + 1200);
    expect(logo).toContain("size = 24");
    expect(logo).toContain("style={box}");
    // Twice the rendered size so the mark stays crisp on a retina screen.
    expect(logo).toContain("size=${size * 2}");
    // The sibling name truncates, so the mark must not be allowed to shrink.
    expect(logo).toContain("shrink-0 rounded");
    expect(logo).not.toContain("w-6 h-6");
  });

  it("truncates the free-text audience name so a long one cannot widen the row", () => {
    const at = leadsPage.indexOf("function AudienceCell(");
    expect(at).toBeGreaterThan(-1);
    const cell = leadsPage.slice(at, at + 1200);
    expect(cell).toContain("flex min-w-0 items-center gap-2");
    expect(cell).toContain('<span className="truncate text-gray-700">{audience.name}</span>');
  });

  it("reads each folded value once and renders it in both places", () => {
    const table = leadsTable();
    expect(table).toContain("const dateNode =");
    // One read of the outcome date, rendered by the stacked line AND the column.
    expect(table.match(/outcomeDates\?\.get\(lead\.id\)/g)?.length).toBe(1);
  });

  it("stacks billing controls instead of squeezing two-column forms", () => {
    expect(billingPage).toContain("flex max-w-2xl flex-col gap-3 sm:flex-row");
    // Add-credits presets wrap on narrow screens (no fixed multi-column grid to squeeze).
    expect(billingPage).toContain("flex flex-wrap gap-2 mb-4");
    expect(billingPage).toContain("w-full rounded-lg bg-brand-600");
  });

  it("keeps the offer's settings actions usable on narrow screens", () => {
    // The Brand Info page went with the flag-gated cluster (it rendered for nobody in
    // this app); what a proposition promises is edited on Offer Settings.
    expect(offerSettingsPage).toContain("BrandOfferCard");
  });
});
