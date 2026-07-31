import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  SALES_FUNNELS,
  funnelDraftFromBrand,
  funnelDestinationChips,
  funnelLegPct,
  funnelLifetimeLabel,
  funnelRateFields,
  isStoredRateKey,
  partitionFunnelsBySelection,
  hostOf,
  salesFunnelByKey,
  shortUrl,
  validateBookingUrl,
  validateFunnelDraft,
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

  // Only the show-up rate has no column; every other leg reads a real field.
  it("marks the show-up rate as the one rate nothing stores", () => {
    expect(isStoredRateKey("meetingBookedToAttendedPct")).toBe(false);
    for (const funnel of SALES_FUNNELS) {
      for (const leg of funnel.legs) {
        if (leg === "meetingBookedToAttendedPct") continue;
        expect(isStoredRateKey(leg)).toBe(true);
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

  // Nothing seeds it, so a meeting funnel cannot be confirmed until the brand
  // states how many booked meetings actually happen.
  it("holds a meeting funnel until the show-up rate is filled", () => {
    const result = validateFunnelDraft(
      salesFunnelByKey("reply_meeting"),
      draftFor("reply_meeting"),
      "acme.com",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Meeting booked → meeting attended");
  });

  it("names the missing rate", () => {
    const def = salesFunnelByKey("reply_meeting");
    const draft = {
      ...filledMeetingDraft("reply_meeting"),
      rates: { replyToMeetingPct: "", meetingBookedToAttendedPct: "80", meetingToClosePct: "25" },
    };
    const result = validateFunnelDraft(def, draft, "acme.com");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Positive reply → meeting booked");
  });

  it("rejects a rate above 100", () => {
    const draft = {
      ...filledMeetingDraft("reply_meeting"),
      rates: { replyToMeetingPct: "140", meetingBookedToAttendedPct: "80", meetingToClosePct: "25" },
    };
    expect(validateFunnelDraft(salesFunnelByKey("reply_meeting"), draft, "acme.com").ok).toBe(false);
  });

  it("rejects a missing or zero lifetime revenue", () => {
    const def = salesFunnelByKey("visit_signup");
    const base = draftFor("visit_signup");
    expect(validateFunnelDraft(def, { ...base, lifetimeRevenueUsd: "" }, "acme.com").ok).toBe(false);
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

  it("treats an empty page destination as the brand homepage", () => {
    const def = salesFunnelByKey("visit_signup");
    const draft = { ...draftFor("visit_signup"), destinationUrl: "" };
    expect(validateFunnelDraft(def, draft, "acme.com")).toEqual({ ok: true });
  });

  it("blocks a page destination until the brand has a domain", () => {
    const def = salesFunnelByKey("visit_form");
    const result = validateFunnelDraft(def, draftFor("visit_form"), null);
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

  it("is beta gated and carries the badge next to its own heading", () => {
    expect(src).toContain("useIsBetaUser");
    expect(src).toContain("if (!isBeta) return null;");
    expect(src).toContain('<MaturityBadge level="beta" />');
  });

  // Nothing persists yet: brand-service stores one lifetime revenue and one
  // destination per brand and has no booking-link field, so a Save here would
  // silently drop what the user typed.
  it("writes nothing to the backend and says so", () => {
    expect(src).not.toContain("useMutation");
    expect(src).not.toContain("saveBrandSalesEconomics");
    expect(src).not.toContain("saveBrandClickDestination");
    expect(src).toContain("Preview only. Nothing here is saved yet.");
  });

  it("explains its fields with InfoTooltip rather than a native title", () => {
    expect(src).toContain("InfoTooltip");
    expect(src).not.toContain("title=");
  });

  it("reuses the query keys the sibling settings cards already read", () => {
    expect(src).toContain('["brandSalesEconomics", brandId]');
    expect(src).toContain('["brand", brandId]');
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
    expect(src).toContain("const showNumbers = state.selected || isOpen;");
    expect(src).toContain("showNumbers ? funnelDestinationChips(def, state.draft) : []");
    expect(src).toContain("showNumbers ? funnelLifetimeLabel(state.draft) : null");
    expect(src).toContain("i > 0 && showNumbers ? funnelLegPct(def, state.draft, i - 1) : null");
  });

  // The chosen funnels come first with a green tag; the rest sit below, greyed.
  it("groups the chosen funnels above the rest", () => {
    expect(src).toContain("partitionFunnelsBySelection((key) => states[key].selected)");
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
  // block; this one runs alongside the name AND the chain.
  it("runs the icon tile alongside both lines", () => {
    expect(src).toContain("h-11 w-11");
    expect(src).toContain('weight="duotone"');
  });

  it("gives each funnel its own icon", () => {
    const icons = [
      "ChatsCircleIcon",
      "CalendarCheckIcon",
      "ShoppingCartSimpleIcon",
      "MagnetIcon",
    ];
    for (const icon of icons) expect(src).toContain(`${icon},`);
    expect(new Set(icons).size).toBe(SALES_FUNNELS.length);
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
    expect(src).toContain('state.everConfirmed ? "Update" : "OK"');
    expect(src).not.toContain("Confirm funnel");
  });

  it("is rendered on the brand settings page below Sales Economics", () => {
    const page = read(
      "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx",
    );
    expect(page).toContain("<BrandSalesFunnelsCard brandId={brandId} />");
    expect(page.indexOf("BrandSalesFunnelsCard brandId")).toBeGreaterThan(
      page.indexOf("BrandSalesEconomicsCard brandId"),
    );
  });
});
