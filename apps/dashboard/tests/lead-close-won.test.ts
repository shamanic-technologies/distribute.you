import { describe, expect, it } from "vitest";

import {
  closeWonFunnelKey,
  dealCause,
  funnelSellsSale,
  leadCloseWonState,
  saleValuePrefillUsd,
  type CloseWonLead,
} from "../src/lib/lead-close-won";
import { SALES_FUNNELS } from "../src/lib/sales-funnels";

const FUNNEL = "sales_meetings_from_conversation";

function lead(over: Partial<CloseWonLead> = {}): CloseWonLead {
  return { standing: { funnelKey: FUNNEL }, ...over };
}

/** A closed deal, with whatever the customer said about who caused it. */
function deal(causedByOutreach: boolean | null): CloseWonLead["closedDeal"] {
  return { causedByOutreach };
}

describe("closeWonFunnelKey", () => {
  it("normalises both spellings of every catalogue funnel", () => {
    expect(closeWonFunnelKey(lead({ standing: { funnelKey: FUNNEL } }))).toBe("reply_meeting");
    expect(closeWonFunnelKey(lead({ standing: { funnelKey: "reply_meeting" } }))).toBe("reply_meeting");
    expect(closeWonFunnelKey(lead({ standing: { funnelKey: "website_purchases" } }))).toBe("visit_signup");
    expect(closeWonFunnelKey(lead({ standing: { funnelKey: "form_magnet" } }))).toBe("visit_form");
  });

  it("answers null rather than throwing on a funnel the catalogue does not carry", () => {
    // lead-service's funnel vocabulary is legitimately wider than this app's catalogue —
    // it serves ads-led funnels that have no entry here. A throw inside a table cell
    // would take the whole table down for every row of a campaign selling one.
    for (const wider of ["sales_from_conversation", "sales_meetings_from_ads", "lead_forms_from_ads"]) {
      expect(closeWonFunnelKey(lead({ standing: { funnelKey: wider } }))).toBeNull();
    }
  });

  it("answers null for an absent funnel and an absent standing", () => {
    expect(closeWonFunnelKey(lead({ standing: { funnelKey: null } }))).toBeNull();
    expect(closeWonFunnelKey(lead({ standing: null }))).toBeNull();
    expect(closeWonFunnelKey({})).toBeNull();
  });
});

describe("funnelSellsSale", () => {
  it("is true for every funnel in the catalogue", () => {
    // Every catalogue funnel ends on Paid client today, so this gate never fires on a
    // funnel we CAN place. It is the null branch that does the work — but the check is
    // read off `leadFunnelStages`, the same walk the lead panel renders, so a catalogue
    // funnel that ever stops ending in a sale withdraws the control on its own rather
    // than offering one the panel says has no such step.
    for (const def of SALES_FUNNELS) {
      expect(funnelSellsSale(def.key)).toBe(true);
    }
  });

  it("is false when the funnel could not be placed", () => {
    expect(funnelSellsSale(null)).toBe(false);
  });
});

describe("dealCause", () => {
  it("reads the customer's own two answers", () => {
    expect(dealCause(lead({ closedDeal: deal(true) }))).toBe("outreach");
    expect(dealCause(lead({ closedDeal: deal(false) }))).toBe("other");
  });

  it("reads an UNASKED deal as null, never as 'not ours'", () => {
    // Every deal stated before the question existed carries null, and so does every
    // tracker-reported one — a page-load tag cannot know why somebody bought. Reading
    // it as `other` would file all of them as revenue we did not cause.
    expect(dealCause(lead({ closedDeal: deal(null) }))).toBeNull();
  });

  it("reads no deal at all as null too", () => {
    expect(dealCause(lead())).toBeNull();
    expect(dealCause(lead({ closedDeal: null }))).toBeNull();
  });
});

describe("leadCloseWonState", () => {
  it("is WON once the customer has said whose win it was, either way", () => {
    expect(leadCloseWonState(lead({ closedDeal: deal(true) }))).toBe("won");
    expect(leadCloseWonState(lead({ closedDeal: deal(false) }))).toBe("won");
  });

  it("keeps an UNASKED deal in its own state", () => {
    // Its own state precisely so a surface can say "nobody was asked" rather than
    // borrowing either verdict. Nearly every deal in the system is in it today.
    expect(leadCloseWonState(lead({ closedDeal: deal(null) }))).toBe("won-unstated");
  });

  it("is OPEN when the producer states no deal", () => {
    expect(leadCloseWonState(lead())).toBe("open");
    expect(leadCloseWonState(lead({ closedDeal: null }))).toBe("open");
  });

  it("reads the deal off the producer, never off a standing word or an amount", () => {
    // `closedDeal` IS lead-service's answer to whether one was stated. A lead the
    // producer gives no deal for is open however far along it otherwise reads.
    const withStandingNoise = {
      standing: { funnelKey: FUNNEL, state: "customer", deepestStep: "sale" },
    } as unknown as CloseWonLead;
    expect(leadCloseWonState(withStandingNoise)).toBe("open");
  });

  it("is UNAVAILABLE when the funnel cannot be placed, whatever the deal says", () => {
    expect(leadCloseWonState(lead({ standing: { funnelKey: null } }))).toBe("unavailable");
    expect(leadCloseWonState(lead({ standing: { funnelKey: "sales_meetings_from_ads" } }))).toBe(
      "unavailable",
    );
    expect(leadCloseWonState(lead({ standing: null }))).toBe("unavailable");
    // Even a lead carrying a stated deal: with no funnel to place it on, the column has
    // no step to offer and states nothing rather than a control that cannot write.
    expect(
      leadCloseWonState({ standing: { funnelKey: null }, closedDeal: deal(true) }),
    ).toBe("unavailable");
  });
});

describe("saleValuePrefillUsd", () => {
  const funnels = [
    { funnelKey: "reply_meeting", lifetimeRevenueUsd: 4900 },
    { funnelKey: "visit_signup", lifetimeRevenueUsd: null },
    { funnelKey: "visit_form", lifetimeRevenueUsd: 0 },
  ];

  it("offers the brand's own stated lifetime revenue FOR THAT FUNNEL", () => {
    expect(saleValuePrefillUsd(funnels, "reply_meeting")).toBe(4900);
  });

  it("offers nothing for a funnel the brand never priced", () => {
    // An absent lifetime revenue and a stated one are different facts. Seeding a guess
    // is what every money figure downstream would then be built on.
    expect(saleValuePrefillUsd(funnels, "visit_signup")).toBeNull();
  });

  it("offers nothing when the brand priced the funnel at zero", () => {
    // Zero would submit as a deal worth nothing, which is the one reading somebody
    // confirming a prefilled field is least likely to check.
    expect(saleValuePrefillUsd(funnels, "visit_form")).toBeNull();
  });

  it("offers nothing for a funnel that is not in the set, or before the set has loaded", () => {
    expect(saleValuePrefillUsd(funnels, "visit_meeting")).toBeNull();
    expect(saleValuePrefillUsd(undefined, "reply_meeting")).toBeNull();
    expect(saleValuePrefillUsd(funnels, null)).toBeNull();
  });

  it("never borrows another funnel's figure", () => {
    // An offer is sold through several funnels at once and prices each one; the lead is
    // on exactly one of them.
    expect(saleValuePrefillUsd(funnels, "visit_meeting")).not.toBe(4900);
  });
});
