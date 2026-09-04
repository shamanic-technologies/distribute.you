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

  it("labels the base tab Contacted", () => {
    expect(leads).toContain('outreach: "Contacted"');
    expect(leads).not.toContain('outreach: "Outreach"');
  });

  it("states the SERVED population, never the page of it the board fetched", () => {
    // The row used to count its two numbers off the board's own rows. That was correct
    // while the page held every lead and became a lie the moment that read gained a
    // bound: it printed LEAD_BOARD_CARD_CAP as if it were the population (a production
    // campaign read `Leads 200` under a heading correctly reading `2,052 leads`). So it
    // reads lead-service's own count — the SAME number the heading states.
    expect(leads).toContain("contactedOverride={reachableCount}");
    // The two derivations that made the truncation possible are DELETED, not merely
    // unused: a prop nobody passes is a branch nobody exercises, and re-adding either
    // brings the cap back as a population.
    expect(leads).not.toContain("boardPopulation");
    expect(leads).not.toContain("leadsOverride");
    expect(leads).not.toContain("salesInterestOverride");
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

  it("asks the producer for the export rather than building a second one", () => {
    // The file used to be assembled here purely to control its column headings, because
    // lead-service headed them with the API's own field names. It heads them in the
    // customer's words now (v0.70.0: "Contacted", "Website visit", "First contacted at"),
    // so the second implementation had nothing left to buy — and the walk it needed
    // carried a row ceiling and megabytes of transient traffic on a press.
    //
    // The words are consequently guarded THERE, where the file is produced. This repo can
    // no longer assert them, and pretending otherwise with a stale copy of the labels
    // would be a guard over something it does not own.
    expect(leads).toContain("fetchLeadsCsv(");
    expect(leads).not.toContain("buildLeadsCsv");
  });
});
