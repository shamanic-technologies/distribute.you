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

  it("states its BOARD's own two numbers, not an undeduped action count", () => {
    // The page counts PEOPLE and partitions them into board columns, so its cards are
    // the population and the sales-interest column — off the very rows the board places,
    // so a card and a column cannot disagree about one screen. The people/actions pair
    // is gone from here: an action count is what the Overview states beside its spend.
    expect(leads).toContain("leadsOverride={loading ? null : boardPopulation.leads}");
    expect(leads).toContain(
      "salesInterestOverride={loading ? null : boardPopulation.salesInterest}",
    );
    expect(leads).not.toContain("contactedOverride=");
    expect(leads).not.toContain('outreachLabel="Contacted"');
  });

  it("counts the board population off the same placement the board renders", () => {
    // `leadBoardColumnFor(standing)` is lead-service's own funnel-aware answer, with the
    // same held latch the cards use, over the UNFILTERED population (the cards describe
    // the page, the board's columns thin out with the search box).
    const at = leads.indexOf("const boardPopulation = useMemo(");
    expect(at).toBeGreaterThan(-1);
    const body = leads.slice(at, leads.indexOf("}, [coveredLeads, statedReplyKinds]);", at));
    expect(body).toContain("for (const lead of coveredLeads)");
    expect(body).toContain("held?.column ?? leadBoardColumnFor(lead.standing)");
    expect(body).toContain('if (column === "sales_interest") salesInterest += 1;');
    // Never the reply-signal aggregate: on a funnel entered by a website visit that
    // count sees none of the people the board places in Sales interest.
    expect(body).not.toContain("positiveRepliesCount");
    // No population means nothing to divide by — never a fabricated 0%.
    expect(body).toContain("leads > 0 ? (salesInterest / leads) * 100 : null");
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
