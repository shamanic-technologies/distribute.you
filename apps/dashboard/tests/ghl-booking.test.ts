import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GHL_BOOKING_COPY, ghlBookingState, ghlScopesToGrant } from "../src/lib/ghl-booking";

const view = (canBook: boolean | null) => ({
  canBook,
  access: canBook === null ? "unchecked" : canBook ? "granted" : "missing",
  checkedAt: null,
  vendorError: null,
  requiredScopes: ["contacts.write", "calendars/events.write"],
});

describe("GoHighLevel booking state (AUTO-BOOK-1103)", () => {
  it("reads the producer's verdict", () => {
    expect(ghlBookingState(view(true))).toBe("can_book");
    expect(ghlBookingState(view(false))).toBe("cannot_book");
    expect(ghlBookingState(view(null))).toBe("unknown");
    expect(ghlBookingState(undefined)).toBe("unknown");
  });

  it("lists every scope to grant, read then book, once each", () => {
    expect(
      ghlScopesToGrant({ mirror: ["contacts.readonly", "calendars.readonly"], booking: ["contacts.write", "contacts.readonly"] }),
    ).toEqual(["contacts.readonly", "calendars.readonly", "contacts.write"]);
  });

  it("copy carries no em or en dash", () => {
    for (const line of Object.values(GHL_BOOKING_COPY)) expect(line).not.toMatch(/[–—]/);
  });

  it("the card reads the scopes from the producer, never a hard-coded list", () => {
    const src = readFileSync(join(__dirname, "../src/components/settings/brand-integrations-card.tsx"), "utf8");
    expect(src).toContain("getGhlScopes(");
    expect(src).toContain("recheckGhlBookingAccess(");
    expect(src).not.toContain('"contacts.write"');
  });
});
