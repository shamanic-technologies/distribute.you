import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GhlBookingLine, ghlScopeLabel, type GhlBooking } from "../src/components/settings/ghl-booking-line";

// GHL-CANBOOK-CARD-1103: the GoHighLevel row says whether our AI can book meetings on the
// brand's calendar, read off crm-service's `booking.canBook`, and how to allow it.

const SCOPES = ["contacts.write", "calendars/events.write"];
const noop = () => {};
const render = (booking: GhlBooking | null, extra: Partial<{ checking: boolean; checkFailed: boolean; stillMissing: boolean }> = {}) =>
  renderToStaticMarkup(
    createElement(GhlBookingLine, {
      booking,
      checking: false,
      checkFailed: false,
      stillMissing: false,
      onCheck: noop,
      ...extra,
    }),
  );
const read = (...p: string[]) => readFileSync(join(__dirname, "..", "src", ...p), "utf8");

describe("GoHighLevel booking line", () => {
  it("can book: says so, no steps, no button", () => {
    const html = render({ canBook: true, requiredScopes: SCOPES });
    expect(html).toContain('data-state="can-book"');
    expect(html).toContain("Books meetings for you");
    expect(html).not.toContain("Private Integrations");
    expect(html).not.toContain("ghl-booking-check");
  });

  it("cannot book: the steps in GoHighLevel's own permission names, and Check again", () => {
    const html = render({ canBook: false, requiredScopes: SCOPES });
    expect(html).toContain('data-state="cannot-book"');
    expect(html).toContain("Can&#x27;t book meetings yet");
    expect(html).toContain("Settings, then Private Integrations");
    expect(html).toContain("Edit Contacts");
    expect(html).toContain("Edit Calendar Events");
    expect(html).toContain("Check again");
  });

  it("not known yet: neutral, never red or amber", () => {
    for (const booking of [null, { canBook: null, requiredScopes: SCOPES }]) {
      const html = render(booking);
      expect(html).toContain('data-state="unknown"');
      expect(html).toContain("Checking");
      expect(html).not.toMatch(/red-|amber-/);
    }
  });

  it("a check in flight, a failed one and a still-missing answer each say so", () => {
    expect(render({ canBook: false, requiredScopes: SCOPES }, { checking: true })).toContain("Checking...");
    expect(render({ canBook: false, requiredScopes: SCOPES }, { checkFailed: true })).toContain("could not check just now");
    expect(render({ canBook: false, requiredScopes: SCOPES }, { stillMissing: true })).toContain("ghl-booking-still-missing");
  });

  it("an unknown scope prints as served", () => {
    expect(ghlScopeLabel("contacts.write")).toBe("Edit Contacts");
    expect(ghlScopeLabel("users.write")).toBe("users.write");
  });

  it("no dash in the copy", () => {
    expect(read("components", "settings", "ghl-booking-line.tsx")).not.toMatch(/[—–]/);
  });

  it("the GoHighLevel row renders the line and re-checks through crm-service", () => {
    const card = read("components", "settings", "brand-integrations-card.tsx");
    expect(card).toContain('def.slug === "gohighlevel" && connection');
    expect(card).toContain("<GhlBookingSection brandId={brandId} connection={connection} />");
    expect(card).toContain("recheckCrmBookingAccess(connection.id, brandId)");
    const api = read("lib", "api.ts");
    expect(api).toContain("/booking-access?brandId=${encodeURIComponent(brandId)}");
    expect(api).toContain("canBook: z.boolean().nullable(),");
  });
});

describe("new GoHighLevel connection lists every permission (AUTO-BOOK-1103-CARD)", () => {
  it("reads crm-service's scopes, read then book, once each, never hard-coded", async () => {
    const { ghlScopesToGrant, ghlScopeLabel } = await import("../src/components/settings/ghl-booking-line");
    expect(ghlScopesToGrant({ mirror: ["contacts.readonly", "calendars.readonly"], booking: ["contacts.write", "contacts.readonly"] })).toEqual([
      "contacts.readonly",
      "calendars.readonly",
      "contacts.write",
    ]);
    expect(ghlScopeLabel("contacts.readonly")).toBe("View Contacts");
    expect(ghlScopeLabel("unknown.scope")).toBe("unknown.scope");
    const fs = await import("node:fs");
    const src = fs.readFileSync(new URL("../src/components/settings/brand-integrations-card.tsx", import.meta.url), "utf8");
    expect(src).toContain('def.slug === "gohighlevel" ? <GhlConnectPermissions brandId={brandId} />');
    expect(src).toContain("getGhlScopes(brandId)");
  });
});
