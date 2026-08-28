import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The Leads page counts PEOPLE; the brand Overview counts the email SEQUENCES sent to
 * them. Both were labelled "Outreach", so one brand read 9,915 on one page and 7,895 on
 * the other on the same afternoon — two correct numbers presenting as one broken one.
 *
 * The fix is the WORD, not the number: the Leads surface (its tab, its stat card and its
 * CSV columns) says "Contacted", the Overview keeps "Outreach" and its sequence count.
 */
describe("the Leads page names what it counts", () => {
  const leads = fs.readFileSync(
    path.join(__dirname, "../src/components/audiences/engaged-leads-page.tsx"),
    "utf-8",
  );
  const auto = fs.readFileSync(
    path.join(__dirname, "../src/components/revenue/outreach-stat-cards-auto.tsx"),
    "utf-8",
  );
  const overview = fs.readFileSync(
    path.join(
      __dirname,
      "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
    ),
    "utf-8",
  );
  const csv = fs.readFileSync(path.join(__dirname, "../src/lib/leads-csv.ts"), "utf-8");

  it("labels the base tab Contacted", () => {
    expect(leads).toContain('outreach: "Contacted"');
    expect(leads).not.toContain('outreach: "Outreach"');
  });

  it("gives its own contacted count to the card that names people", () => {
    // The page counts PEOPLE — its tabs bucket the same snapshot the table renders —
    // so that count is the `Leads contacted` card, and the ACTIONS beside it are read
    // off /revenue by the wrapper. A card and a tab counting the same rows under two
    // different words is the same contradiction one level down.
    expect(leads).toContain("contactedOverride={loading ? null : contactedCount}");
    expect(leads).not.toContain('outreachLabel="Contacted"');
  });

  it("passes the label through the wrapper, and names the actions card when both show", () => {
    expect(auto).toContain("outreachLabel?: string;");
    expect(auto).toContain("contactedOverride?: number | null;");
    // Two counts on screen means the second one has to say what it is.
    expect(auto).toContain('contactedOverride != null ? (outreachLabel ?? "Outreaches") : outreachLabel');
    // ...and the actions count comes off /revenue, never from the caller.
    expect(auto).toContain("revenueData?.sequences?.total ?? revenueData?.outreachContacted?.total");
  });

  it("leaves the brand Overview on Outreach", () => {
    // It states `sequences.total` — email sequences sent, undeduped by lead, which is
    // what tracks the spend charted beside it. Renaming it to Contacted would claim a
    // people count it does not hold.
    expect(overview).not.toContain("outreachLabel");
    expect(overview).toContain("data?.sequences ?? data?.outreachContacted");
  });

  it("exports the CSV in the page's own words", () => {
    expect(csv).toContain('{ label: "Contacted", value: (l) => yesNo(l.contacted) }');
    expect(csv).toContain(
      '{ label: "First contacted at", value: (l) => date(l.firstContactedAt) }',
    );
    expect(csv).not.toContain('label: "Outreach"');
    expect(csv).not.toContain('label: "First outreach at"');
  });
});
