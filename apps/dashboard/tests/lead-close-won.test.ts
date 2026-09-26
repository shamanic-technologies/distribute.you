import { describe, expect, it } from "vitest";

import {
  dealCause,
  leadCloseWonState,
  saleValuePrefillUsd,
  type CloseWonLead,
} from "../src/lib/lead-close-won";

function lead(over: Partial<CloseWonLead> = {}): CloseWonLead {
  return { standing: { state: "engaged" }, ...over };
}

/** A closed deal, with whatever the customer said about who caused it. */
function deal(causedByOutreach: boolean | null): CloseWonLead["closedDeal"] {
  return { causedByOutreach };
}

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
      standing: { state: "customer", deepestStep: "sale" },
    } as unknown as CloseWonLead;
    expect(leadCloseWonState(withStandingNoise)).toBe("open");
  });

  it("is UNAVAILABLE when the lead carries no standing, whatever the deal says", () => {
    expect(leadCloseWonState(lead({ standing: null }))).toBe("unavailable");
    expect(leadCloseWonState({})).toBe("unavailable");
    // Even a lead carrying a stated deal: with no campaign to state it against, the
    // column states nothing rather than a control that cannot write.
    expect(leadCloseWonState({ standing: null, closedDeal: deal(true) })).toBe("unavailable");
  });
});

describe("saleValuePrefillUsd", () => {
  it("offers the offer's own stated lifetime revenue", () => {
    expect(saleValuePrefillUsd(4900)).toBe(4900);
  });

  it("offers nothing for an offer the brand never priced", () => {
    // An absent lifetime revenue and a stated one are different facts. Seeding a guess
    // is what every money figure downstream would then be built on.
    expect(saleValuePrefillUsd(null)).toBeNull();
    expect(saleValuePrefillUsd(undefined)).toBeNull();
  });

  it("offers nothing when the offer is priced at zero", () => {
    // Zero would submit as a deal worth nothing, which is the one reading somebody
    // confirming a prefilled field is least likely to check.
    expect(saleValuePrefillUsd(0)).toBeNull();
  });
});
