import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  SALES_FUNNELS,
  funnelDraftFromBrand,
  funnelSummaryParts,
  salesFunnelByKey,
  shortUrl,
  validateBookingUrl,
  validateFunnelDraft,
  type FunnelDraft,
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

function draftFor(key: "reply_meeting" | "visit_signup" | "visit_form"): FunnelDraft {
  return funnelDraftFromBrand(salesFunnelByKey(key), ECONOMICS, "https://acme.com/pricing");
}

describe("SALES_FUNNELS definitions", () => {
  it("declares the three funnels, each with its own key", () => {
    expect(SALES_FUNNELS.map((f) => f.key)).toEqual([
      "reply_meeting",
      "visit_signup",
      "visit_form",
    ]);
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

  it("marks the two click-led funnels as needing a website, and the reply-led one as not", () => {
    expect(salesFunnelByKey("reply_meeting").requiresWebsite).toBe(false);
    expect(salesFunnelByKey("visit_signup").requiresWebsite).toBe(true);
    expect(salesFunnelByKey("visit_form").requiresWebsite).toBe(true);
  });

  it("sends a booking link only for the meeting funnel", () => {
    expect(salesFunnelByKey("reply_meeting").destination.kind).toBe("booking");
    expect(salesFunnelByKey("visit_signup").destination.kind).toBe("page");
    expect(salesFunnelByKey("visit_form").destination.kind).toBe("page");
  });

  it("names each rate exactly as brand-service stores it", () => {
    expect(salesFunnelByKey("reply_meeting").rates.map((r) => r.key)).toEqual([
      "replyToMeetingPct",
      "meetingToClosePct",
    ]);
    expect(salesFunnelByKey("visit_signup").rates.map((r) => r.key)).toEqual([
      "visitToSignupPct",
      "signupToPaidClientPct",
    ]);
    expect(salesFunnelByKey("visit_form").rates.map((r) => r.key)).toEqual([
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

  it("seeds a page destination from the brand's click destination", () => {
    expect(draftFor("visit_signup").destinationUrl).toBe("https://acme.com/pricing");
  });

  // No booking link is stored anywhere yet, so guessing one would put a URL on
  // screen the brand never gave us.
  it("leaves the booking link empty rather than inventing one", () => {
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

  it("rejects an empty link", () => {
    expect(validateBookingUrl("   ").ok).toBe(false);
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
  it("accepts a fully filled meeting funnel", () => {
    const draft = { ...draftFor("reply_meeting"), destinationUrl: "https://cal.com/acme/30min" };
    expect(validateFunnelDraft(salesFunnelByKey("reply_meeting"), draft, "acme.com")).toEqual({
      ok: true,
    });
  });

  it("names the missing rate", () => {
    const def = salesFunnelByKey("reply_meeting");
    const draft = {
      ...draftFor("reply_meeting"),
      destinationUrl: "https://cal.com/acme/30min",
      rates: { replyToMeetingPct: "", meetingToClosePct: "25" },
    };
    const result = validateFunnelDraft(def, draft, "acme.com");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Positive reply → meeting");
  });

  it("rejects a rate above 100", () => {
    const draft = {
      ...draftFor("reply_meeting"),
      destinationUrl: "https://cal.com/acme/30min",
      rates: { replyToMeetingPct: "140", meetingToClosePct: "25" },
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

  // A booking link is off-domain by nature, so a brand with no website can still
  // run the reply-led funnel.
  it("accepts the meeting funnel on a brand with no domain", () => {
    const draft = { ...draftFor("reply_meeting"), destinationUrl: "https://cal.com/acme/30min" };
    expect(validateFunnelDraft(salesFunnelByKey("reply_meeting"), draft, null)).toEqual({ ok: true });
  });
});

describe("summary line", () => {
  it("shortens a URL to something readable", () => {
    expect(shortUrl("https://www.acme.com/pricing/")).toBe("acme.com/pricing");
    expect(shortUrl("")).toBe("");
  });

  it("recaps both rates, the lifetime revenue and the destination", () => {
    const draft = { ...draftFor("visit_signup"), destinationUrl: "https://acme.com/signup" };
    const parts = funnelSummaryParts(salesFunnelByKey("visit_signup"), draft);
    expect(parts.map((p) => p.label)).toEqual([
      "Website visit → signup",
      "Signup → paid client",
      "Lifetime revenue",
      "Destination page",
    ]);
    expect(parts[0].value).toContain("%");
    expect(parts[2].value).toContain("$");
    expect(parts[3].value).toBe("acme.com/signup");
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

  it("gives each funnel its own icon", () => {
    const icons = ["ChatBubbleLeftRightIcon", "UserPlusIcon", "ClipboardDocumentCheckIcon"];
    for (const icon of icons) expect(src).toContain(`${icon},`);
    expect(new Set(icons).size).toBe(SALES_FUNNELS.length);
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
