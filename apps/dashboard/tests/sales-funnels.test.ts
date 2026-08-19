import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  FUNNEL_MIN_DAILY_BUDGET_USD,
  NOTHING_DECLARED,
  SALES_FUNNELS,
  buildFunnelPatch,
  funnelBudgetBelowMinimum,
  funnelBudgetFloorMessage,
  funnelBudgetTip,
  isGrandfatheredFunding,
  funnelDraftFromBrand,
  funnelDraftFromDeclared,
  funnelDestinationChips,
  funnelLegPct,
  funnelLifetimeLabel,
  funnelRateFields,
  funnelWriteErrorMessage,
  isEmptyFunnelPatch,
  isSeedableRateKey,
  partitionFunnelsBySelection,
  hostOf,
  salesFunnelByKey,
  shortUrl,
  validateBookingUrl,
  validateFunnelDraft,
  type DeclaredFunnelValues,
  type FunnelDraft,
  type SalesFunnelKey,
} from "../src/lib/sales-funnels";
import { parseLocaleNumberInput } from "../src/lib/format-number";
// Type-only, so nothing resolves the "@" alias inside api.ts at runtime.
import type { BrandSalesEconomics } from "../src/lib/api";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

const ECONOMICS: BrandSalesEconomics = {
  lifetimeRevenueUsd: 4000,
  replyToMeetingPct: 40,
  visitToMeetingPct: 20,
  meetingToClosePct: 25,
  visitToSignupPct: 25,
  signupToPaidClientPct: 20,
  visitToClosePct: 5,
  visitToPaidClientPct: 5,
  replyToPaidClientPct: 25,
  visitToFormSubmissionPct: 30,
  formSubmissionToPaidClientPct: 15,
  businessModel: null,
  optimizationGoal: "signups",
  updatedAt: "2026-07-30T00:00:00.000Z",
};

function draftFor(key: SalesFunnelKey): FunnelDraft {
  return funnelDraftFromBrand(salesFunnelByKey(key), ECONOMICS, "https://acme.com/pricing");
}

/**
 * Nothing seeds the show-up rate, so a meeting funnel is only complete once the
 * brand types it. This is what a filled-in meeting funnel looks like.
 */
function filledMeetingDraft(key: "reply_meeting" | "visit_meeting"): FunnelDraft {
  const base = draftFor(key);
  return { ...base, rates: { ...base.rates, meetingBookedToAttendedPct: "80" } };
}

describe("SALES_FUNNELS definitions", () => {
  it("declares the four funnels, each with its own key", () => {
    expect(SALES_FUNNELS.map((f) => f.key)).toEqual([
      "reply_meeting",
      "visit_meeting",
      "visit_signup",
      "visit_form",
    ]);
  });

  // The name is what the funnel IS; the chain under it is how it runs. A card
  // titled by its own chain has nothing left to say on its second line.
  it("names every funnel, distinctly, and never with its own chain", () => {
    expect(SALES_FUNNELS.map((f) => f.name)).toEqual([
      "Sales Meeting from Conversation",
      "Sales Meeting from Website",
      "Website Purchase",
      "Form Magnet",
    ]);
    expect(new Set(SALES_FUNNELS.map((f) => f.name)).size).toBe(SALES_FUNNELS.length);
    for (const funnel of SALES_FUNNELS) {
      expect(funnel.name).not.toContain("→");
    }
  });

  // One leg per arrow: a chain that declares fewer legs than arrows leaves an
  // arrow whose rate nobody decided on.
  it("declares one leg per arrow of the chain", () => {
    for (const funnel of SALES_FUNNELS) {
      expect(funnel.legs.length).toBe(funnel.steps.length - 1);
    }
  });

  // Booking a meeting and attending it are two different events, so the show-up
  // rate between them is its own leg.
  it("prices the meeting show-up leg on both meeting funnels", () => {
    expect(salesFunnelByKey("reply_meeting").legs).toEqual([
      "replyToMeetingPct",
      "meetingBookedToAttendedPct",
      "meetingToClosePct",
    ]);
    expect(salesFunnelByKey("visit_meeting").legs).toEqual([
      "visitToMeetingPct",
      "meetingBookedToAttendedPct",
      "meetingToClosePct",
    ]);
  });

  it("routes a lead through Meeting booked before the meeting is attended", () => {
    expect(salesFunnelByKey("reply_meeting").steps).toEqual([
      "Positive reply",
      "Meeting booked",
      "Meeting attended",
      "Paid client",
    ]);
    expect(salesFunnelByKey("visit_meeting").steps).toEqual([
      "Website visit",
      "Meeting booked",
      "Meeting attended",
      "Paid client",
    ]);
  });

  // brand-service stores every leg on the funnel. Only the show-up rate has
  // nothing to seed from, because no other table in the fleet measures it.
  it("marks the show-up rate as the one rate nothing can seed", () => {
    expect(isSeedableRateKey("meetingBookedToAttendedPct")).toBe(false);
    for (const funnel of SALES_FUNNELS) {
      for (const leg of funnel.legs) {
        if (leg === "meetingBookedToAttendedPct") continue;
        expect(isSeedableRateKey(leg)).toBe(true);
      }
    }
  });

  it("gives every funnel a distinct colour so the icons read apart", () => {
    const backgrounds = SALES_FUNNELS.map((f) => f.tone.iconBg);
    const foregrounds = SALES_FUNNELS.map((f) => f.tone.iconText);
    expect(new Set(backgrounds).size).toBe(SALES_FUNNELS.length);
    expect(new Set(foregrounds).size).toBe(SALES_FUNNELS.length);
  });

  // The dashboard reskins from one place: an accent tint only survives dark mode
  // when globals.css remaps it. A palette swap that skips the remap paints a
  // bright block on the dark surface, so pin every tone to an existing rule.
  it("only uses tints that globals.css remaps for dark mode", () => {
    const globals = read("../src/app/globals.css");
    for (const funnel of SALES_FUNNELS) {
      expect(globals).toContain(`html.dark .${funnel.tone.iconBg} {`);
    }
  });

  it("marks the click-led funnels as needing a website, and the reply-led one as not", () => {
    expect(salesFunnelByKey("reply_meeting").requiresWebsite).toBe(false);
    expect(salesFunnelByKey("visit_meeting").requiresWebsite).toBe(true);
    expect(salesFunnelByKey("visit_signup").requiresWebsite).toBe(true);
    expect(salesFunnelByKey("visit_form").requiresWebsite).toBe(true);
  });

  // A booking link is worth collecting wherever a meeting sits in the chain; a
  // page destination only where a click onto the site starts it.
  it("collects a booking link on the meeting funnels and a page on the click-led ones", () => {
    expect(salesFunnelByKey("reply_meeting").bookingLink).toBe(true);
    expect(salesFunnelByKey("reply_meeting").pageDestination).toBe(false);
    expect(salesFunnelByKey("visit_meeting").bookingLink).toBe(true);
    expect(salesFunnelByKey("visit_meeting").pageDestination).toBe(true);
    expect(salesFunnelByKey("visit_signup").bookingLink).toBe(false);
    expect(salesFunnelByKey("visit_form").bookingLink).toBe(false);
  });

  it("names each rate exactly as brand-service stores it", () => {
    const keysOf = (key: SalesFunnelKey) =>
      funnelRateFields(salesFunnelByKey(key)).map((r) => r.key);
    expect(keysOf("reply_meeting")).toEqual([
      "replyToMeetingPct",
      "meetingBookedToAttendedPct",
      "meetingToClosePct",
    ]);
    expect(keysOf("visit_meeting")).toEqual([
      "visitToMeetingPct",
      "meetingBookedToAttendedPct",
      "meetingToClosePct",
    ]);
    expect(keysOf("visit_signup")).toEqual(["visitToSignupPct", "signupToPaidClientPct"]);
    expect(keysOf("visit_form")).toEqual([
      "visitToFormSubmissionPct",
      "formSubmissionToPaidClientPct",
    ]);
  });

  it("throws on an unknown funnel rather than resolving to a default one", () => {
    expect(() => salesFunnelByKey("nope" as never)).toThrow();
  });
});

describe("funnelDraftFromBrand", () => {
  it("seeds each funnel's own rates and lifetime revenue from the saved economics", () => {
    const draft = draftFor("visit_form");
    expect(parseLocaleNumberInput(draft.rates.visitToFormSubmissionPct ?? "")).toBe(30);
    expect(parseLocaleNumberInput(draft.rates.formSubmissionToPaidClientPct ?? "")).toBe(15);
    expect(parseLocaleNumberInput(draft.lifetimeRevenueUsd)).toBe(4000);
  });

  it("seeds the website-led meeting funnel from its own visit→meeting rate", () => {
    expect(parseLocaleNumberInput(draftFor("visit_meeting").rates.visitToMeetingPct ?? "")).toBe(20);
  });

  // Nothing stores a show-up rate, so borrowing any number for it would be a
  // claim about a conversion nobody measured.
  it("leaves the show-up rate blank on every brand", () => {
    expect(draftFor("reply_meeting").rates.meetingBookedToAttendedPct).toBe("");
    expect(draftFor("visit_meeting").rates.meetingBookedToAttendedPct).toBe("");
  });

  it("seeds a page destination from the brand's click destination", () => {
    expect(draftFor("visit_signup").destinationUrl).toBe("https://acme.com/pricing");
  });

  // No booking link is stored anywhere yet, so guessing one would put a URL on
  // screen the brand never gave us.
  it("leaves the booking link empty rather than inventing one", () => {
    expect(draftFor("reply_meeting").bookingUrl).toBe("");
    expect(draftFor("visit_meeting").bookingUrl).toBe("");
  });

  // The reply-led funnel has no website step, so there is no click to land.
  it("leaves the reply-led funnel without a page destination", () => {
    expect(draftFor("reply_meeting").destinationUrl).toBe("");
  });

  it("leaves every field blank when the brand saved no economics", () => {
    const draft = funnelDraftFromBrand(salesFunnelByKey("visit_signup"), null, null);
    expect(draft.lifetimeRevenueUsd).toBe("");
    expect(draft.rates.visitToSignupPct).toBe("");
    expect(draft.destinationUrl).toBe("");
  });

  it("blanks a rate the wire serves as null instead of showing a zero", () => {
    const draft = funnelDraftFromBrand(
      salesFunnelByKey("visit_form"),
      { ...ECONOMICS, visitToFormSubmissionPct: null },
      null,
    );
    expect(draft.rates.visitToFormSubmissionPct).toBe("");
  });
});

/**
 * A brand configured on a goal the catalogue prices under a longer chain. Its
 * one end-to-end rate is still true of that whole chain, so it lands on the leg
 * ending on a paid client and every leg above it passes everyone through: the
 * product multiplies back to exactly the number the brand gave us.
 *
 * The alternative is reading each leg by name, which cannot work here —
 * brand-service stores every blended rate NOT NULL with a server default, so a
 * leg this brand's goal never configured reads back a plausible number it never
 * stated.
 */
describe("a goal the catalogue carries no funnel of its own for", () => {
  const seed = (goal: BrandSalesEconomics["optimizationGoal"], key: SalesFunnelKey) =>
    funnelDraftFromBrand(salesFunnelByKey(key), { ...ECONOMICS, optimizationGoal: goal }, null);

  const pct = (draft: FunnelDraft, key: string) =>
    parseLocaleNumberInput(draft.rates[key as keyof FunnelDraft["rates"]] ?? "");

  it("maps a positive-replies brand onto the reply-led meeting chain", () => {
    const draft = seed("positive_replies", "reply_meeting");
    expect(pct(draft, "replyToMeetingPct")).toBe(100);
    expect(pct(draft, "meetingBookedToAttendedPct")).toBe(100);
    // The brand's own reply → paid client rate, on the leg that lands there.
    expect(pct(draft, "meetingToClosePct")).toBe(25);
  });

  it("maps a website-visits brand onto the website-purchase chain", () => {
    const draft = seed("website_visits", "visit_signup");
    expect(pct(draft, "visitToSignupPct")).toBe(100);
    expect(pct(draft, "signupToPaidClientPct")).toBe(5);
  });

  // A paid client won through EITHER path, so both chains seed, each from the
  // rate that describes its own first signal.
  it("maps a sales brand onto both chains at once", () => {
    expect(pct(seed("sales", "reply_meeting"), "meetingToClosePct")).toBe(25);
    expect(pct(seed("sales", "visit_signup"), "signupToPaidClientPct")).toBe(5);
  });

  // The chain has to multiply back to what the brand actually told us, or the
  // prefill quietly restates its economics as a different number.
  it("keeps the product across the chain equal to the rate the brand gave us", () => {
    const draft = seed("positive_replies", "reply_meeting");
    const legs = ["replyToMeetingPct", "meetingBookedToAttendedPct", "meetingToClosePct"];
    const product = legs.reduce((acc, leg) => acc * ((pct(draft, leg) ?? 0) / 100), 1);
    expect(product).toBeCloseTo(0.25, 10);
  });

  // A goal a funnel already prices leg by leg needs no translation, and a funnel
  // outside the mapping keeps reading its own named rates.
  it("leaves a natively-priced goal alone", () => {
    const draft = seed("signups", "visit_signup");
    expect(pct(draft, "visitToSignupPct")).toBe(25);
    expect(pct(draft, "signupToPaidClientPct")).toBe(20);
    // website_visits maps onto visit_signup, never onto the form funnel.
    expect(pct(seed("website_visits", "visit_form"), "visitToFormSubmissionPct")).toBe(30);
  });

  // The wire types this rate non-null, so this is the older-producer case: a
  // payload that simply does not carry it. Without an end-to-end number there is
  // no chain to spread, so the funnel reads its own named legs again rather than
  // seeding a chain of 100s that would multiply back to nothing.
  it("falls back to the named legs when the end-to-end rate is absent", () => {
    const draft = funnelDraftFromBrand(
      salesFunnelByKey("reply_meeting"),
      {
        ...ECONOMICS,
        optimizationGoal: "positive_replies",
        replyToPaidClientPct: undefined as unknown as number,
      },
      null,
    );
    expect(pct(draft, "replyToMeetingPct")).toBe(40);
    expect(draft.rates.meetingBookedToAttendedPct).toBe("");
  });
});

describe("validateBookingUrl", () => {
  it("accepts a scheduling page on any domain", () => {
    expect(validateBookingUrl("https://cal.com/acme/30min")).toEqual({ ok: true });
    expect(validateBookingUrl("calendly.com/acme")).toEqual({ ok: true });
  });

  // A brand that books over email still runs the funnel.
  it("accepts an empty link", () => {
    expect(validateBookingUrl("   ")).toEqual({ ok: true });
  });

  it("rejects a value that is not a URL", () => {
    expect(validateBookingUrl("book a call with me").ok).toBe(false);
    expect(validateBookingUrl("notadomain").ok).toBe(false);
  });

  it("rejects a non-http protocol", () => {
    expect(validateBookingUrl("ftp://files.acme.com").ok).toBe(false);
  });
});

describe("validateFunnelDraft", () => {
  it("accepts a meeting funnel with no booking link at all", () => {
    expect(
      validateFunnelDraft(salesFunnelByKey("reply_meeting"), filledMeetingDraft("reply_meeting"), "acme.com"),
    ).toEqual({ ok: true });
  });

  it("still rejects a malformed booking link", () => {
    const draft = { ...filledMeetingDraft("reply_meeting"), bookingUrl: "book me" };
    expect(validateFunnelDraft(salesFunnelByKey("reply_meeting"), draft, "acme.com").ok).toBe(false);
  });

  // brand-service leaves an omitted field as stored and clears an explicit null,
  // so a brand must be able to declare a funnel before it has priced every leg.
  // A blank field is a value to clear, never a form to block.
  it("accepts a funnel that has priced nothing yet", () => {
    const def = salesFunnelByKey("reply_meeting");
    const blank: FunnelDraft = {
      rates: {},
      lifetimeRevenueUsd: "",
      destinationUrl: "",
      bookingUrl: "",
    };
    expect(validateFunnelDraft(def, blank, "acme.com")).toEqual({ ok: true });
  });

  it("accepts a meeting funnel whose show-up rate is still blank", () => {
    expect(
      validateFunnelDraft(salesFunnelByKey("reply_meeting"), draftFor("reply_meeting"), "acme.com"),
    ).toEqual({ ok: true });
  });

  it("lets a brand clear a rate it had filled", () => {
    const def = salesFunnelByKey("visit_signup");
    const cleared = { ...draftFor("visit_signup"), rates: { visitToSignupPct: "" } };
    expect(validateFunnelDraft(def, cleared, "acme.com")).toEqual({ ok: true });
  });

  it("rejects a rate above 100", () => {
    const draft = {
      ...filledMeetingDraft("reply_meeting"),
      rates: { replyToMeetingPct: "140", meetingBookedToAttendedPct: "80", meetingToClosePct: "25" },
    };
    expect(validateFunnelDraft(salesFunnelByKey("reply_meeting"), draft, "acme.com").ok).toBe(false);
  });

  it("rejects a zero lifetime revenue but accepts an empty one", () => {
    const def = salesFunnelByKey("visit_signup");
    const base = draftFor("visit_signup");
    expect(validateFunnelDraft(def, { ...base, lifetimeRevenueUsd: "" }, "acme.com")).toEqual({
      ok: true,
    });
    expect(validateFunnelDraft(def, { ...base, lifetimeRevenueUsd: "0" }, "acme.com").ok).toBe(
      false,
    );
  });

  it("keeps a page destination on the brand domain", () => {
    const def = salesFunnelByKey("visit_signup");
    const offDomain = { ...draftFor("visit_signup"), destinationUrl: "https://competitor.com/x" };
    expect(validateFunnelDraft(def, offDomain, "acme.com").ok).toBe(false);

    const subdomain = { ...draftFor("visit_signup"), destinationUrl: "https://app.acme.com/signup" };
    expect(validateFunnelDraft(def, subdomain, "acme.com")).toEqual({ ok: true });
  });

  // An empty destination is one to clear, not the homepage: substituting the
  // homepage would write a page the brand never named.
  it("accepts an empty page destination without inventing one", () => {
    const def = salesFunnelByKey("visit_signup");
    const draft = { ...draftFor("visit_signup"), destinationUrl: "" };
    expect(validateFunnelDraft(def, draft, "acme.com")).toEqual({ ok: true });
    expect(buildFunnelPatch(def, draft, NOTHING_DECLARED).destinationUrl).toBeUndefined();
  });

  it("blocks a typed page destination until the brand has a domain", () => {
    const def = salesFunnelByKey("visit_form");
    const draft = { ...draftFor("visit_form"), destinationUrl: "https://acme.com/lead-magnet" };
    const result = validateFunnelDraft(def, draft, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("brand domain");
  });

  // The reply-led funnel lands no click, so a brand with no website runs it.
  it("accepts the reply-led funnel on a brand with no domain", () => {
    expect(
      validateFunnelDraft(salesFunnelByKey("reply_meeting"), filledMeetingDraft("reply_meeting"), null),
    ).toEqual({ ok: true });
  });
});

describe("funnelDraftFromDeclared", () => {
  const SAVED: DeclaredFunnelValues = {
    rates: { visitToSignupPct: 3.5, signupToPaidClientPct: null },
    lifetimeRevenueUsd: 1200,
    destinationUrl: "https://acme.com/pricing",
    bookingUrl: null,
  };

  it("shows exactly what the brand declared for that funnel", () => {
    const draft = funnelDraftFromDeclared(salesFunnelByKey("visit_signup"), SAVED);
    expect(parseLocaleNumberInput(draft.rates.visitToSignupPct ?? "")).toBe(3.5);
    expect(parseLocaleNumberInput(draft.lifetimeRevenueUsd)).toBe(1200);
    expect(draft.destinationUrl).toBe("https://acme.com/pricing");
  });

  // A leg the brand never gave us reads null upstream, and null never means 0.
  it("leaves an undeclared leg blank rather than showing a zero", () => {
    const draft = funnelDraftFromDeclared(salesFunnelByKey("visit_signup"), SAVED);
    expect(draft.rates.signupToPaidClientPct).toBe("");
  });

  it("never borrows the brand's blended economics for a declared funnel", () => {
    const draft = funnelDraftFromDeclared(salesFunnelByKey("visit_form"), NOTHING_DECLARED);
    expect(draft.rates.visitToFormSubmissionPct).toBe("");
    expect(draft.lifetimeRevenueUsd).toBe("");
    expect(draft.destinationUrl).toBe("");
  });
});

describe("buildFunnelPatch", () => {
  const def = salesFunnelByKey("visit_signup");
  const saved: DeclaredFunnelValues = {
    rates: { visitToSignupPct: 4, signupToPaidClientPct: 10 },
    lifetimeRevenueUsd: 900,
    destinationUrl: "https://acme.com/pricing",
    bookingUrl: null,
  };
  const savedDraft = funnelDraftFromDeclared(def, saved);

  it("sends nothing when nothing changed", () => {
    expect(isEmptyFunnelPatch(buildFunnelPatch(def, savedDraft, saved))).toBe(true);
  });

  // Restating a field from a possibly-stale copy is how a value confirmed
  // elsewhere gets overwritten, so only the edited one travels.
  it("sends only the field that changed", () => {
    const draft = { ...savedDraft, rates: { ...savedDraft.rates, visitToSignupPct: "6" } };
    expect(buildFunnelPatch(def, draft, saved)).toEqual({ rates: { visitToSignupPct: 6 } });
  });

  // A user removing a number must be able to remove it, not be forced to invent
  // a replacement — an explicit null is what clears it upstream.
  it("sends an explicit null for a value the user emptied", () => {
    const draft = {
      ...savedDraft,
      rates: { ...savedDraft.rates, signupToPaidClientPct: "" },
      lifetimeRevenueUsd: "",
    };
    expect(buildFunnelPatch(def, draft, saved)).toEqual({
      rates: { signupToPaidClientPct: null },
      lifetimeRevenueUsd: null,
    });
  });

  // brand-service normalizes a stored URL, so a raw compare would re-send an
  // unchanged destination on every save.
  it("treats a bare host and its normalized URL as the same destination", () => {
    const draft = { ...savedDraft, destinationUrl: "acme.com/pricing" };
    expect(isEmptyFunnelPatch(buildFunnelPatch(def, draft, saved))).toBe(true);
  });

  it("clears a destination the user emptied", () => {
    const draft = { ...savedDraft, destinationUrl: "" };
    expect(buildFunnelPatch(def, draft, saved)).toEqual({ destinationUrl: null });
  });

  // The prefill is a guess for a person to confirm. Against an undeclared funnel
  // a blank field equals what is stored, so nothing nobody confirmed is written.
  it("writes the prefill a user confirmed and omits the blanks it left", () => {
    const patch = buildFunnelPatch(
      salesFunnelByKey("reply_meeting"),
      draftFor("reply_meeting"),
      NOTHING_DECLARED,
    );
    expect(patch.rates).toEqual({ replyToMeetingPct: 40, meetingToClosePct: 25 });
    expect(patch.rates).not.toHaveProperty("meetingBookedToAttendedPct");
  });

  it("declares a funnel with an empty patch when the brand priced nothing", () => {
    const blank: FunnelDraft = {
      rates: {},
      lifetimeRevenueUsd: "",
      destinationUrl: "",
      bookingUrl: "",
    };
    expect(isEmptyFunnelPatch(buildFunnelPatch(def, blank, NOTHING_DECLARED))).toBe(true);
  });

  // brand-service 400s on a rate outside the chain and on a destination the
  // funnel has no use for, so a patch must never be able to carry either.
  it("never carries a rate outside the funnel's own chain", () => {
    const draft = {
      ...savedDraft,
      rates: { ...savedDraft.rates, replyToMeetingPct: "50" },
    } as FunnelDraft;
    const patch = buildFunnelPatch(def, draft, saved);
    expect(patch.rates ?? {}).not.toHaveProperty("replyToMeetingPct");
  });

  it("never carries a destination the funnel has no use for", () => {
    const reply = salesFunnelByKey("reply_meeting");
    const draft = { ...draftFor("reply_meeting"), destinationUrl: "https://acme.com/x" };
    expect(buildFunnelPatch(reply, draft, NOTHING_DECLARED)).not.toHaveProperty("destinationUrl");

    const signup = { ...savedDraft, bookingUrl: "https://cal.com/acme" };
    expect(buildFunnelPatch(def, signup, saved)).not.toHaveProperty("bookingUrl");
  });

  it("rounds the lifetime revenue to the whole dollars brand-service stores", () => {
    const draft = { ...savedDraft, lifetimeRevenueUsd: "1200.6" };
    expect(buildFunnelPatch(def, draft, saved).lifetimeRevenueUsd).toBe(1201);
  });
});

describe("funnelWriteErrorMessage", () => {
  // brand-service says exactly what was wrong with the funnel it was asked to
  // store, in a sentence written for a person. A rejection is shown, not swallowed.
  it("shows what the server refused", () => {
    const err = {
      status: 400,
      body: { error: 'Funnel "visit_signup" starts with a click onto the brand\'s website.' },
    };
    expect(funnelWriteErrorMessage(err)).toContain("starts with a click");
  });

  it("names an ownership or missing-brand failure in its own words", () => {
    expect(funnelWriteErrorMessage({ status: 403, body: {} })).toContain("organization");
    expect(funnelWriteErrorMessage({ status: 404, body: {} })).toContain("no longer exists");
  });

  // apiCall sets `message` to the whole downstream body verbatim, so a 500 must
  // never leak it onto the screen.
  it("falls back to one line rather than leaking a body", () => {
    const err = { status: 500, body: { error: null }, message: '{"error":"boom","stack":"..."}' };
    expect(funnelWriteErrorMessage(err)).toBe("Could not save this funnel. Try again.");
    expect(funnelWriteErrorMessage(new Error("nope"))).toBe(
      "Could not save this funnel. Try again.",
    );
    expect(funnelWriteErrorMessage(null)).toBe("Could not save this funnel. Try again.");
  });
});

describe("funnelLegPct", () => {
  it("prints the rate that sits on each arrow", () => {
    const def = salesFunnelByKey("visit_signup");
    const draft = draftFor("visit_signup");
    expect(funnelLegPct(def, draft, 0)).toBe("25%");
    expect(funnelLegPct(def, draft, 1)).toBe("20%");
  });

  it("prints the show-up rate once the brand has typed it", () => {
    const def = salesFunnelByKey("reply_meeting");
    const draft = filledMeetingDraft("reply_meeting");
    expect(funnelLegPct(def, draft, 0)).toBe("40%");
    expect(funnelLegPct(def, draft, 1)).toBe("80%");
    expect(funnelLegPct(def, draft, 2)).toBe("25%");
  });

  // "Not filled in" and "converts at 0%" are different statements.
  it("prints nothing for a rate the brand has not filled", () => {
    const def = salesFunnelByKey("visit_form");
    const draft = { ...draftFor("visit_form"), rates: { visitToFormSubmissionPct: "" } };
    expect(funnelLegPct(def, draft, 0)).toBe(null);
    // The show-up rate is the one nothing seeds, so it starts out unprinted.
    expect(funnelLegPct(salesFunnelByKey("reply_meeting"), draftFor("reply_meeting"), 1)).toBe(null);
  });
});

describe("funnelLifetimeLabel", () => {
  // A lifetime revenue is what the last step of the chain is worth, so it reads
  // at the end of that chain rather than on a line of its own.
  it("closes the chain with what a client is worth", () => {
    expect(funnelLifetimeLabel(draftFor("visit_signup"))).toBe("$4,000 lifetime revenue");
  });

  it("prints nothing when the brand has given no lifetime revenue", () => {
    expect(funnelLifetimeLabel({ ...draftFor("visit_signup"), lifetimeRevenueUsd: "" })).toBe(null);
    expect(funnelLifetimeLabel({ ...draftFor("visit_signup"), lifetimeRevenueUsd: "0" })).toBe(null);
  });
});

describe("destination chips", () => {
  it("shortens a URL to something readable", () => {
    expect(shortUrl("https://www.acme.com/pricing/")).toBe("acme.com/pricing");
    expect(shortUrl("")).toBe("");
  });

  // A real click destination carries a UTM tail long enough to fill the row on
  // its own, and none of it identifies the page.
  it("drops the query string and the fragment, keeping the path", () => {
    expect(
      shortUrl(
        "https://opsfolio.com/lp/cmmc/level-1-free-assessment/?utm_source=landing_page&utm_medium=email&utm_campaign=cmmc_level1",
      ),
    ).toBe("opsfolio.com/lp/cmmc/level-1-free-assessment");
    expect(shortUrl("https://acme.com/pricing#plans")).toBe("acme.com/pricing");
  });

  it("resolves the host a logo lookup needs", () => {
    expect(hostOf("https://www.cal.com/acme/30min")).toBe("cal.com");
    expect(hostOf("acme.com/pricing")).toBe("acme.com");
    expect(hostOf("")).toBe(null);
    expect(hostOf("not a url")).toBe(null);
  });

  it("lists every destination the funnel has", () => {
    const def = salesFunnelByKey("visit_meeting");
    const draft = {
      ...draftFor("visit_meeting"),
      destinationUrl: "https://acme.com/demo",
      bookingUrl: "https://cal.com/acme/30min",
    };
    expect(funnelDestinationChips(def, draft)).toEqual([
      { kind: "page", label: "acme.com/demo", host: "acme.com" },
      { kind: "booking", label: "cal.com/acme/30min", host: "cal.com" },
    ]);
  });

  // A destination the brand never gave us is dropped, not printed empty.
  it("drops a destination the brand has not set", () => {
    expect(funnelDestinationChips(salesFunnelByKey("reply_meeting"), draftFor("reply_meeting"))).toEqual([]);
  });

  // The lifetime revenue now closes the chain, so it is not a chip.
  it("carries no lifetime revenue", () => {
    const chips = funnelDestinationChips(salesFunnelByKey("visit_form"), draftFor("visit_form"));
    for (const chip of chips) expect(chip.kind).not.toBe("ltr");
  });
});

describe("no goal-to-funnel resolver", () => {
  // `meetingBooked` is the goal of TWO funnels, so a goal cannot name a chain on
  // its own. A surface naming what something buys reads the funnel a campaign or
  // a brand actually stated — campaign-service persists it on every campaign —
  // never one derived from the retired goal vocabulary.
  it("is not exported by the catalogue", async () => {
    const mod = await import("../src/lib/sales-funnels");
    expect("primaryFunnelForGoal" in mod).toBe(false);
  });

  it("still has two funnels sharing one meeting goal", () => {
    const meetings = SALES_FUNNELS.filter((f) => f.goal === "sales_meetings");
    expect(meetings.length).toBeGreaterThan(1);
  });
});

describe("partitionFunnelsBySelection", () => {
  // Two funnels a brand runs and two it does not are two different kinds of row.
  it("puts the chosen funnels first, in their declared order", () => {
    const chosen = new Set<SalesFunnelKey>(["visit_form", "reply_meeting"]);
    const { selected, unselected } = partitionFunnelsBySelection((key) => chosen.has(key));
    expect(selected.map((f) => f.key)).toEqual(["reply_meeting", "visit_form"]);
    expect(unselected.map((f) => f.key)).toEqual(["visit_meeting", "visit_signup"]);
  });

  it("leaves every funnel unselected when the brand has chosen none", () => {
    const { selected, unselected } = partitionFunnelsBySelection(() => false);
    expect(selected).toEqual([]);
    expect(unselected).toHaveLength(SALES_FUNNELS.length);
  });
});

describe("Sales Funnels card", () => {
  const src = read("../src/components/settings/brand-sales-funnels-card.tsx");
  const mark = read("../src/components/marks/sales-funnel-mark.tsx");

  // GA: this is the one place a brand states how it sells, so every customer
  // reads it. No gate, no badge.
  it("renders its own heading for everyone", () => {
    expect(src).toContain("Sales Funnels");
    expect(src).not.toContain("useIsBetaUser");
    expect(src).not.toContain("MaturityBadge");
  });

  // brand-service stores the declared set and each funnel's own economics PER
  // OFFER, so the card persists what the offer states. The brand-scoped routes
  // resolve to whichever offer the service picks and 409 SEVERAL_OFFERS once a
  // brand has two, so a page that names one offer must never reach for them.
  it("persists a funnel through the OFFER funnel routes, never the brand ones", () => {
    expect(src).toContain("getOfferSalesFunnels(brandId, offerId)");
    expect(src).toContain("declareOfferSalesFunnel(brandId, offerId, vars.def.key, vars.patch)");
    expect(src).toContain("undeclareOfferSalesFunnel(brandId, offerId, vars.def.key)");
    expect(src).not.toContain("declareBrandSalesFunnel");
    expect(src).not.toContain("undeclareBrandSalesFunnel");
    expect(src).not.toContain("getBrandSalesFunnels");
    expect(src).not.toContain("Preview only");
  });

  // Two propositions of one brand sell through different funnels at different
  // rates. Sharing a cache entry would paint the sibling offer's funnels here.
  it("carries the offer in every funnel query key", () => {
    expect(src).toContain('["offerSalesFunnels", brandId, offerId]');
    expect(src).not.toContain('["brandSalesFunnels", brandId]');
  });

  // The brand-level writers hold ONE lifetime revenue and ONE destination for
  // the whole brand, so wiring them here would take four funnels' values and
  // persist one of each — the per-funnel model collapsing back into the old one.
  it("never writes a funnel through the brand-level economics or destination", () => {
    expect(src).not.toContain("saveBrandSalesEconomics");
    expect(src).not.toContain("saveBrandClickDestination");
  });

  // Only the fields whose value actually changed travel, so editing one rate
  // cannot overwrite the others and emptying a field really clears it.
  it("writes a partial patch diffed against what is stored", () => {
    expect(src).toContain("buildFunnelPatch(def, state.draft, state.saved)");
    expect(src).toContain("isEmptyFunnelPatch(body)");
  });

  // A prefill is a guess for a person to confirm. A declared funnel shows its
  // own stored values instead, so a confirmed number is never re-guessed.
  it("seeds a declared funnel from what it declared, not from the brand blend", () => {
    expect(src).toContain("funnelDraftFromDeclared(def, saved)");
    // Optional-chained since the card hydrates on SETTLE: an errored economics
    // read still lets the other three seed what they know.
    expect(src).toContain("funnelDraftFromBrand(");
    expect(src).toContain("econData?.salesEconomics ?? null");
  });

  // A set we could not read is a set we must not write over: every field would
  // look changed and a prefill nobody confirmed would land on declared values.
  it("refuses to write while the stored set is unknown", () => {
    // The budgets ride the same refusal: the ceiling write is also a diff, so a
    // set we could not read is one we must not write over either.
    expect(src).toContain("if (funnelData === undefined || budgetData === undefined) {");
    expect(src).toContain("Could not load your funnels.");
  });

  // A refusal is the server's answer and belongs on screen; `err.message` is the
  // whole downstream body verbatim and never does.
  it("shows the server's rejection rather than swallowing it", () => {
    expect(src).toContain("funnelWriteErrorMessage(err)");
    expect(src).not.toContain("err.message");
    expect(src).toContain("{state.error}");
  });

  // Having stated a set and having said nothing are different answers.
  it("renders a switched-off funnel as OFF, never as still selected", () => {
    // The set lists switched-off funnels too, keeping every number on them so the
    // form can show what the user entered. A consumer that ignores `active` puts a
    // green tag on a funnel the brand told us it no longer sells through.
    expect(src).toContain("saved !== undefined && saved.active !== false");
  });

  it("keeps the numbers when a funnel is switched off", () => {
    // Switching off is not forgetting: turning it back on returns what the user
    // entered instead of an empty form they would have to retype.
    expect(src).toContain("const kept = set.funnels.find((f) => f.funnelKey === vars.def.key)");
    expect(src).toContain("funnelDraftFromDeclared(vars.def, kept)");
  });

  it("does not read a brand that has said nothing as one that switched everything off", () => {
    // Two different states, and the `declared` flag that used to tell them apart is
    // retired: brand-service refuses to switch off the LAST active funnel, so an
    // empty list can only mean "never answered".
    expect(src).toContain("hasStoredFunnels");
    expect(src).not.toContain("funnelData?.declared === true");
    expect(src).toContain("Every path is switched off");
  });

  it("explains its fields with InfoTooltip rather than a native title", () => {
    expect(src).toContain("InfoTooltip");
    expect(src).not.toContain("title=");
  });

  it("reuses the query keys the sibling settings cards already read", () => {
    expect(src).toContain('["brandSalesEconomics", brandId]');
    expect(src).toContain('["brand", brandId]');
  });

  // An unlisted root is default-OFF, so the card would cold-skeleton on every
  // visit instead of painting from disk like the rest of the page.
  it("persists its own query root", () => {
    expect(src).toContain('["offerSalesFunnels", brandId, offerId]');
    const persist = read("../src/lib/persist-cache.ts");
    expect(persist).toContain('"offerSalesFunnels"');
    // The brand-scoped root went with the card's last brand-scoped read. A root
    // no query writes is dead weight the persister still sweeps.
    expect(persist).not.toContain('"brandSalesFunnels"');
  });

  // Several funnels run at once and none outranks another; ordering them is a
  // campaign concern, not a settings one.
  it("carries no primary funnel", () => {
    expect(src).not.toContain("primary");
    expect(src).not.toContain("Primary");
    expect(src).not.toContain("StarIcon");
  });

  // Choosing how a brand sells is not one tap on a checkbox. The card is opened
  // by clicking it anywhere, and the choice is a named button inside.
  it("has no checkbox, and opens on a click anywhere on the card", () => {
    expect(src).not.toContain('type="checkbox"');
    expect(src).toContain('role="button"');
    expect(src).toContain("onClick={() => openCard(def, locked)}");
    expect(src).toContain('if (e.key !== "Enter" && e.key !== " ") return;');
  });

  // Dropping a funnel is its own labelled button, never a toggle.
  it("removes a funnel through a named button", () => {
    expect(src).toContain("Remove this funnel");
    expect(src).toContain("onClick={() => removeFunnel(def)}");
  });

  // On desktop the actions sit at the end of the row; they stack on mobile.
  it("puts the actions on the right on desktop", () => {
    expect(src).toContain("sm:flex-row sm:items-center sm:justify-end");
  });

  // A funnel the brand has not chosen shows what it IS, and nothing else: its
  // numbers are seeded defaults until someone confirms them.
  it("shows no numbers on a funnel that is neither chosen nor open", () => {
    expect(src).toContain("const showNumbers = state.declared || isOpen;");
    expect(src).toContain("showNumbers ? funnelDestinationChips(def, state.draft) : []");
    expect(src).toContain("showNumbers ? funnelLifetimeLabel(state.draft) : null");
    expect(src).toContain("i > 0 && showNumbers ? funnelLegPct(def, state.draft, i - 1) : null");
  });

  // The chosen funnels come first with a green tag; the rest sit below, greyed.
  it("groups the chosen funnels above the rest", () => {
    expect(src).toContain("partitionFunnelsBySelection((key) => states[key].declared)");
    expect(src).toContain("Not selected");
    expect(src).toContain("bg-green-50");
    expect(src).toContain('"border-gray-200 bg-gray-50"');
  });

  // The lifetime revenue closes the chain, where the last step earns it.
  it("closes the chain with the lifetime revenue", () => {
    expect(src).toContain("{lifetime}");
  });

  // The chain is what the funnel does, not what it is called.
  it("titles each card with the funnel name and keeps the chain under it", () => {
    expect(src).toContain("{def.name}");
    expect(src).toContain("def.steps.map((step, i)");
    expect(src).toContain("funnelLegPct(def, state.draft, i - 1)");
  });

  // A tile that only covers the title reads as decoration next to a two-line
  // block; this one runs alongside the name AND the chain. The tile itself lives
  // in the shared mark so the Campaigns table draws a funnel the same way.
  it("runs the shared icon tile alongside both lines", () => {
    expect(src).toContain("<SalesFunnelMark def={def}");
    expect(mark).toContain("h-11 w-11");
    expect(mark).toContain('weight="duotone"');
  });

  it("gives each funnel its own icon, declared once", () => {
    const icons = [
      "ChatsCircleIcon",
      "CalendarCheckIcon",
      "ShoppingCartSimpleIcon",
      "MagnetIcon",
    ];
    for (const icon of icons) expect(mark).toContain(`${icon},`);
    expect(new Set(icons).size).toBe(SALES_FUNNELS.length);
    // Two copies of the icon map is how two surfaces end up disagreeing about
    // what a funnel looks like.
    expect(src).not.toContain("FUNNEL_ICONS");
  });

  // A long destination reads as its own favicon plus a shortened host rather
  // than a raw link running off the row.
  it("renders a destination with its logo instead of the raw URL", () => {
    expect(src).toContain("funnelDestinationChips(def, state.draft)");
    expect(src).toContain("<BrandLogo");
    expect(src).toContain("truncate");
  });

  // "Confirm funnel" named a step of the form; the button is what the user does
  // to the funnel itself.
  it("labels the button OK the first time and Update afterwards", () => {
    expect(src).toContain('state.declared ? "Update" : "OK"');
    expect(src).not.toContain("Confirm funnel");
  });

  // Fading the very word that signals work reads as a dead button.
  it("keeps the in-flight label at full opacity", () => {
    expect(src).toContain('saving ? "Saving…"');
    expect(src).toContain('saving ? "cursor-wait" : ""');
  });

  // It REPLACED the two flat sections rather than sitting under them: a funnel
  // owns the rates, the lifetime revenue and the landing page they held one set
  // at a time for the whole brand. And it sits on OFFER Settings now, because
  // what a funnel is worth is a fact about the proposition, not the identity.
  it("is the offer settings page's only sales-economics surface", () => {
    const page = read(
      "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/offers/[offerId]/settings/page.tsx",
    );
    expect(page).toContain("<BrandSalesFunnelsCard brandId={brandId} offerId={offerId} />");
    expect(page).toContain("<BrandOfferCard brandId={brandId} offerId={offerId} />");
    expect(page).not.toContain("BrandSalesEconomicsCard");
    expect(page).not.toContain("BrandClickDestinationCard");
    expect(page).not.toContain("Sales Economics");
  });

  // Brand Settings holds identity only: the domain and the conversion-tracking
  // snippet. Everything about what the brand SELLS moved down a level.
  it("is gone from brand Settings, which keeps identity only", () => {
    const page = read(
      "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx",
    );
    expect(page).not.toContain("BrandSalesFunnelsCard");
    expect(page).not.toContain("BrandOfferCard");
    expect(page).not.toContain("BrandAcquisitionChannelsCard");
    expect(page).toContain("<BrandDomainCard brandId={brandId} />");
    expect(page).toContain("<BrandConversionTrackingCard brandId={brandId} />");
  });

  // The offer sidebar is the only way in, so a page with no entry is a page
  // nobody reaches.
  it("is reachable from the offer sidebar", () => {
    const sidebar = read("../src/components/context-sidebar.tsx");
    expect(sidebar).toContain('id: "offer-settings"');
    expect(sidebar).toContain('label: "Offer Settings"');
  });
});

describe("per-funnel daily minimums", () => {
  it("prices a meeting funnel far above a purchase funnel", () => {
    // A sales meeting costs an order of magnitude more than a website purchase,
    // so one dollar a day would buy a meeting funnel nothing at all.
    expect(FUNNEL_MIN_DAILY_BUDGET_USD.reply_meeting).toBe(24);
    expect(FUNNEL_MIN_DAILY_BUDGET_USD.visit_meeting).toBe(24);
    expect(FUNNEL_MIN_DAILY_BUDGET_USD.visit_signup).toBe(1);
    expect(FUNNEL_MIN_DAILY_BUDGET_USD.visit_form).toBe(1);
  });

  it("carries a floor for every funnel in the catalogue", () => {
    for (const def of SALES_FUNNELS) {
      expect(FUNNEL_MIN_DAILY_BUDGET_USD[def.key], `no minimum for ${def.key}`).toBeGreaterThan(0);
    }
  });

  it("treats zero as an ordinary value, never a violation", () => {
    // Defunding a funnel is how a brand pauses it. Refusing zero would make a
    // pause impossible without deleting what the brand said about how it sells.
    for (const def of SALES_FUNNELS) {
      expect(funnelBudgetBelowMinimum(def.key, 0, 0)).toBe(false);
      // Even a funnel funded under its floor may be put down.
      expect(funnelBudgetBelowMinimum(def.key, 0, 50)).toBe(false);
    }
  });

  it("refuses a funded funnel under its own floor", () => {
    expect(funnelBudgetBelowMinimum("reply_meeting", 23, 0)).toBe(true);
    expect(funnelBudgetBelowMinimum("reply_meeting", 24, 0)).toBe(false);
    expect(funnelBudgetBelowMinimum("visit_signup", 0.5, 0)).toBe(true);
    expect(funnelBudgetBelowMinimum("visit_signup", 1, 0)).toBe(false);
  });

  it("grandfathers a funnel billing already funds under the floor", () => {
    // The floor governs what a brand may NEWLY state. Per-funnel ceilings
    // shipped after the money, and the attribution sweep carried each figure
    // over verbatim, so live brands sit under their funnel's floor today.
    // Prod case: $8 a day on a reply-to-meeting funnel whose floor is $24.
    expect(funnelBudgetBelowMinimum("reply_meeting", 8, 800)).toBe(false);
    // Raising it is the direction we want, even short of the floor.
    expect(funnelBudgetBelowMinimum("reply_meeting", 10, 800)).toBe(false);
    // Lowering it to another funded figure under the floor is still refused.
    expect(funnelBudgetBelowMinimum("reply_meeting", 5, 800)).toBe(true);
    // Reaching the floor spends the grandfather: a later write back down is
    // refused by the ordinary rule, with no branch of its own.
    expect(funnelBudgetBelowMinimum("reply_meeting", 8, 2400)).toBe(true);
    expect(funnelBudgetBelowMinimum("reply_meeting", 8, 3000)).toBe(true);
  });

  it("names what a grandfathered funnel may actually do", () => {
    const fresh = funnelBudgetFloorMessage("reply_meeting", 0);
    expect(fresh).toContain("starts at $24");

    const carried = funnelBudgetFloorMessage("reply_meeting", 800);
    expect(carried).toContain("$8 a day");
    expect(carried).toContain("raise it");
    // Never tell someone their live ceiling is where they must start.
    expect(carried).not.toContain("starts at");

    // Same split on the tip beside the field.
    expect(funnelBudgetTip("reply_meeting", 0)).toContain("From $24 a day");
    expect(funnelBudgetTip("reply_meeting", 800)).toContain("funded at $8 a day");
    expect(funnelBudgetTip("reply_meeting", 800)).not.toContain("From $24");
  });

  it("reads a grandfather off the stored ceiling and nothing else", () => {
    expect(isGrandfatheredFunding("reply_meeting", 800)).toBe(true);
    expect(isGrandfatheredFunding("reply_meeting", 2400)).toBe(false);
    expect(isGrandfatheredFunding("reply_meeting", 0)).toBe(false);
    // A purchase funnel's floor is a dollar, so the same 800 clears it.
    expect(isGrandfatheredFunding("visit_signup", 800)).toBe(false);
    expect(isGrandfatheredFunding("visit_signup", 50)).toBe(true);
  });
});

describe("the Sales Funnels card funds each funnel", () => {
  const src = read("../src/components/settings/brand-sales-funnels-card.tsx");
  const lib = read("../src/lib/sales-funnels.ts");
  /** Slice forward from an anchor; lengths measured against the real file. */
  const sliceFrom = (haystack: string, anchor: string, length: number) => {
    const at = haystack.indexOf(anchor);
    expect(at, `anchor not found: ${anchor}`).toBeGreaterThan(-1);
    return haystack.slice(at, at + length);
  };

  it("reads the ceilings from billing, not from the funnel declaration", () => {
    // Two services own two halves of one funnel: brand-service says how it
    // sells, billing says how much it is funded. The card composes both.
    expect(src).toContain('["brandFunnelBudgets", brandId]');
    expect(src).toContain("getBrandFunnelBudgets(brandId)");
  });

  // billing keys a ceiling on (org, brand, funnel, acquisition channel) and has
  // no offer dimension. The funnel DECLARATION moved to the offer; the money did
  // not, and an offer-scoped budget route invented here would write nowhere.
  it("keeps the money brand-scoped while the declaration is offer-scoped", () => {
    expect(src).toContain("saveBrandFunnelBudget(");
    expect(src).not.toContain("saveOfferFunnelBudget");
    expect(src).not.toContain("getOfferFunnelBudgets");
    // Still one write per channel that MOVED, in sequence, so funding one
    // channel never re-states its sibling's ceiling.
    expect(src).toContain("move.featureSlug");
    expect(src).toContain("(m) => m.cents !== (state.savedCentsByChannel[m.featureSlug] ?? 0)");
  });

  it("keeps the ceiling OUT of the funnel patch", () => {
    // `draft` is exactly what brand-service's partial patch reads. Putting money
    // in it would send billing's field to a service that has no column for it.
    // Measured: the block is 1316 chars, its last field at 1264. Give it room.
    const state = sliceFrom(src, "type FunnelState = {", 1400);
    // The money is PER CHANNEL: the same funnel is worked through several offers
    // at once, each its own campaign, so one figure could not say how it splits.
    expect(state).toContain("budgetUsdByChannel: Record<string, string>");
    expect(state).toContain("savedCentsByChannel: Record<string, number>");
    // The funnel total stays too: the product minimum binds it, not one channel.
    expect(state).toContain("savedBudgetCents: number");
    const draft = sliceFrom(lib, "export type FunnelDraft = {", 400);
    expect(draft).not.toContain("budget");
  });

  it("funds each channel of a funnel separately, and never re-adds the total", () => {
    // billing serves the per-funnel figure as the SUM of its channels, so the
    // card renders that served number. A client-side sum is the compute-a-stat-
    // in-the-browser bug, and it would drift from what billing charges.
    const lib2 = read("../src/lib/funnel-channels.ts");
    expect(lib2).toContain("export function channelsForFunnel");
    expect(lib2).toContain("export function funnelChannelBudgets");
    // Which channel may sell which funnel is features-service's statement.
    expect(lib2).not.toContain("reply_meeting:");
    expect(src).toContain("channelsForFunnel(def.key, features)");
    // The write names the channel: billing 409s a slug-less write on a funnel
    // split across several, because guessing which offer the money was for
    // would move it onto the wrong campaign.
    expect(src).toContain("move.featureSlug");
  });

  it("writes the ceiling only when it moved, and before the nothing-changed exit", () => {
    // A budget edit alone is a real change even when the economics are
    // untouched — so the early return for an empty patch must not swallow it.
    // Measured: the block is 3015 chars and the exit sits at 2770.
    const confirm = sliceFrom(src, "function confirm(def: SalesFunnelDef) {", 3100);
    const write = confirm.indexOf("budgetMutation.mutate");
    const exit = confirm.indexOf("isEmptyFunnelPatch(body)");
    expect(write).toBeGreaterThan(-1);
    expect(exit).toBeGreaterThan(write);
    // Only the channels that MOVED are written, so funding one offer never
    // re-states its sibling's ceiling.
    expect(confirm).toContain("state.savedCentsByChannel[m.featureSlug]");
  });

  it("refuses a funded funnel under its floor, reading what it is funded at now", () => {
    // The stored ceiling is part of the question: a funnel carried under its
    // floor keeps that figure, so the gate cannot decide on the typed value
    // alone. Without it, editing a rate on such a funnel was impossible.
    const confirm = sliceFrom(src, "function confirm(def: SalesFunnelDef) {", 2800);
    expect(confirm).toContain(
      "funnelBudgetBelowMinimum(def.key, budgetUsd, state.savedBudgetCents)",
    );
    expect(confirm).toContain("funnelBudgetFloorMessage(def.key, state.savedBudgetCents)");
    // The copy lives once, in the alias-free lib.
    expect(confirm).not.toContain("starts at $");
  });

  it("re-seeds the form when a fresher payload lands, not once per mount", () => {
    // The reads settle from the on-disk cache first, so a once-only seed takes
    // the LAST VISIT's copy and ignores the server payload that lands a moment
    // later. That is how a rate the brand had already saved kept rendering
    // blank, which reads as the save having been dropped.
    // Measured: the touched/open guard sits at +1643 from the anchor.
    const effect = sliceFrom(src, "  useEffect(() => {\n    const econSettled", 2200);
    expect(effect).toContain("seededFrom.current.funnels === funnelData");
    expect(effect).toContain("seededFrom.current.budgets === budgetData");
    expect(effect).toContain("seededFrom.current = { funnels: funnelData, budgets: budgetData }");
    // A bare latch is exactly what could not see the fresher payload.
    expect(effect).not.toContain("if (hydrated.current ||");
  });

  it("never rewrites a form the user is typing in or has open", () => {
    // Measured: the touched/open guard sits at +1643 from the anchor.
    const effect = sliceFrom(src, "  useEffect(() => {\n    const econSettled", 2200);
    expect(effect).toContain("next[def.key].touched || openKey === def.key");
  });

  it("tips the budget field from the same one place", () => {
    expect(src).toContain("funnelBudgetTip(def.key, state.savedBudgetCents)");
    expect(src).not.toContain("FUNNEL_MIN_DAILY_BUDGET_USD");
  });

  it("states the funded ceiling on the tag, and says so when there is none", () => {
    // The money IS the selection now. A declared funnel at zero is one the brand
    // described but is not paying for, so a green tag claiming it runs would be
    // a statement about spend that is not happening.
    expect(src).toContain("state.savedBudgetCents > 0");
    expect(src).toContain("Not funded");
  });

  it("renders the ceiling in whole dollars, never cents", () => {
    // A daily budget is a configured ceiling, not a charge.
    expect(src).toContain('Math.round(state.savedBudgetCents / 100).toLocaleString("en-US")');
  });
});

describe("the card hydrates on SETTLE, never on success alone", () => {
  const src = read("../src/components/settings/brand-sales-funnels-card.tsx");

  it("waits for each of the four reads to resolve OR error", () => {
    // Gated on `data !== undefined` alone, ONE failing read left every funnel at
    // its initial blank state forever — no rate, no lifetime revenue, `$0/day`,
    // and `OK` where the card should have said `Update`. That is what a brand
    // which has told us nothing looks like, so it reads as deleted data rather
    // than as a failed read. It is how the retired-goal parse throw on
    // `brandSalesEconomics` took this card down for the whole fleet.
    for (const settled of [
      "econData !== undefined || econError",
      "brandData !== undefined || brandError",
      "funnelData !== undefined || funnelError",
      "budgetData !== undefined || budgetError",
    ]) {
      expect(src).toContain(settled);
    }
    expect(src).not.toContain("econData === undefined ||");
  });

  it("reads through an errored payload rather than dereferencing it", () => {
    // A read that errored contributes what it knows, which is nothing; the
    // others still show what the brand stated.
    expect(src).toContain("funnelData?.funnels ?? []");
    expect(src).toContain("budgetData?.funnels ?? []");
    expect(src).toContain("econData?.salesEconomics ?? null");
  });
});
