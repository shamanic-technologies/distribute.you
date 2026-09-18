import { describe, it, expect } from "vitest";
import {
  START_SELECTION_COOKIE,
  EMPTY_SELECTION,
  encodeStartSelection,
  decodeStartSelection,
  selectionIsPayable,
  selectionIsPaid,
  startSelectionCookieAssignment,
  clearStartSelectionCookieAssignment,
} from "../src/lib/start-selection-cookie";

const SELECTION = {
  outcomes: ["meeting_booked", "signup"],
  // STATED rather than picked: we run one channel, and what is bought is a
  // (funnel x channel) pair. A selection stored while the channel screen
  // existed can name others, which the readers narrow rather than refusing.
  channels: ["sales-cold-email-outreach"],
  funnels: ["sales_meetings_from_website::sales-cold-email-outreach"],
  paid: [],
};

describe("start selection cookie", () => {
  it("round-trips a selection", () => {
    expect(decodeStartSelection(encodeStartSelection(SELECTION))).toEqual(SELECTION);
  });

  it("reads anything unreadable as EMPTY, never as a partial guess", () => {
    for (const raw of [undefined, null, "", "not-json", encodeURIComponent("[1,2,3]")]) {
      expect(decodeStartSelection(raw)).toEqual(EMPTY_SELECTION);
    }
  });

  it("refuses a version it does not know rather than reading fields that may have moved", () => {
    const stale = encodeURIComponent(JSON.stringify({ v: 999, o: ["website_visit"], c: [], f: [] }));
    expect(decodeStartSelection(stale)).toEqual(EMPTY_SELECTION);
  });

  it("drops a token outside the shape our producers use", () => {
    const hostile = encodeURIComponent(
      JSON.stringify({ v: 1, o: ["ok_key", "../../etc", "<script>", 42, "UPPER"], c: [], f: [] }),
    );
    expect(decodeStartSelection(hostile).outcomes).toEqual(["ok_key"]);
  });

  // WHAT IS BOUGHT IS A PAIR, so the shape has to carry one. It did not: the
  // pattern admitted a bare slug only, so every `<funnel>::<channel>` key was
  // dropped on the way in. The payment screen carried on from memory and the
  // handoff broke -- `/onboarding/build` reads the cookie fresh, saw nothing
  // paid, and sent somebody who had just been charged back to the picks.
  it("carries a (funnel x channel) pair key, which is the identity that is bought", () => {
    const paired = {
      ...EMPTY_SELECTION,
      funnels: ["form_magnet::sales-cold-email-outreach"],
      paid: ["form_magnet::sales-cold-email-outreach"],
    };
    const back = decodeStartSelection(encodeStartSelection(paired));
    expect(back.funnels).toEqual(["form_magnet::sales-cold-email-outreach"]);
    expect(back.paid).toEqual(["form_magnet::sales-cold-email-outreach"]);
    expect(selectionIsPaid(back)).toBe(true);
  });

  it("admits the pair shape and nothing looser", () => {
    const raw = encodeURIComponent(
      JSON.stringify({ v: 1, o: ["a::b::c", "::x", "x::", "a::b"], c: [], f: [] }),
    );
    expect(decodeStartSelection(raw).outcomes).toEqual(["a::b"]);
  });

  it("de-duplicates rather than letting a repeat inflate the header", () => {
    const dupes = { ...EMPTY_SELECTION, channels: ["google-ads", "google-ads", "meta-ads"] };
    expect(decodeStartSelection(encodeStartSelection(dupes)).channels).toEqual([
      "google-ads",
      "meta-ads",
    ]);
  });

  it("caps each list, because this rides every request to the origin", () => {
    const many = Array.from({ length: 200 }, (_, i) => `channel-${i}`);
    expect(decodeStartSelection(encodeStartSelection({ ...EMPTY_SELECTION, channels: many })).channels)
      .toHaveLength(40);
  });

  it("refuses an oversized value outright", () => {
    expect(decodeStartSelection("x".repeat(4096))).toEqual(EMPTY_SELECTION);
  });

  it("carries what was already PAID, and reads its absence as nothing paid", () => {
    const withPaid = { ...SELECTION, paid: ["sales_meetings_from_website"] };
    expect(decodeStartSelection(encodeStartSelection(withPaid)).paid).toEqual([
      "sales_meetings_from_website",
    ]);
    // A cookie written before the field existed: "nothing paid yet", which is
    // right for a visitor who never reached a payment screen. Additive, so it
    // must NOT strand them behind a version bump.
    const older = encodeURIComponent(JSON.stringify({ v: 1, o: [], c: ["google-ads"], f: ["x"] }));
    expect(decodeStartSelection(older).paid).toEqual([]);
    expect(selectionIsPaid(decodeStartSelection(older))).toBe(false);
    expect(selectionIsPaid(withPaid)).toBe(true);
  });

  it("is payable only with both a funnel and a channel to run it through", () => {
    expect(selectionIsPayable(SELECTION)).toBe(true);
    expect(selectionIsPayable({ ...SELECTION, funnels: [] })).toBe(false);
    expect(selectionIsPayable({ ...SELECTION, channels: [] })).toBe(false);
    expect(selectionIsPayable(EMPTY_SELECTION)).toBe(false);
  });

  it("writes one cookie assignment, so the attributes cannot drift between callers", () => {
    const set = startSelectionCookieAssignment(SELECTION);
    expect(set.startsWith(`${START_SELECTION_COOKIE}=`)).toBe(true);
    expect(set).toContain("path=/");
    expect(set).toContain("samesite=lax");
    expect(set).toContain("max-age=604800");
    expect(clearStartSelectionCookieAssignment()).toContain("max-age=0");
  });
});
