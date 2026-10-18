import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM module, no types
import { meetingBeforeAfterStudy } from "../../scripts/blog-data/meeting-before-after.mjs";

const maturity = [{ legKey: "conversation_to_meeting_booked", durationDays: 21, outcomesRequired: 1 }];
const by = (ai: number, team: number, unknown: number) => ({ aiMeetingBooking: ai, yourTeamMeetingBooking: team, other: 0, unknown });
const sideOf = (people: number, booked: number, w: { people: number; booked: number }, bookedBy = by(0, 0, booked)) => ({
  people, booked, rate: people ? booked / people : null, bookedBy, bookedAfterGoLive: 0,
  withinDays: { days: 30, people: w.people, booked: w.booked, rate: w.people ? w.booked / w.people : null },
});
const brand = (id: string, live: boolean, positiveReplyPeople: number) => ({
  brandId: id, goLive: live ? { at: "2026-09-21T00:00:00Z", basis: "first_ai_meeting_booking_act" } : null, positiveReplyPeople,
});
// the shape lead-service served on 2026-10-14 (fleet: 5 live brands, 3 without a go-live)
const read = (after: ReturnType<typeof sideOf>) => ({
  legKey: "conversation_to_meeting_booked",
  horizonDays: 30,
  fleet: { brands: 2, before: sideOf(36, 6, { people: 27, booked: 4 }, by(0, 2, 4)), after },
  brands: [brand("a", true, 30), brand("b", true, 16), brand("c", false, 3), brand("d", false, 0)],
});

describe("AI meeting booking before/after study", () => {
  it("leads with the 30-day read, keeps an empty after side as a bar, and calls it noise", () => {
    const st = meetingBeforeAfterStudy({ read: read(sideOf(10, 2, { people: 0, booked: 0 }, by(1, 0, 1))), maturity });
    expect(st.pipe).toBeNull();
    expect(st.outcome).toBe("meeting");
    expect(st.verdict.kind).toBe("noise");
    expect(st.verdict.reason).toContain("after side");
    const [horizon, allTime] = st.charts;
    expect(horizon.points.map((p: { label: string }) => p.label)).toEqual(["Before the AI went live", "After the AI went live"]);
    expect(horizon.points[1]).toMatchObject({ display: "No one yet", value: 0, thin: true });
    expect(horizon.points[0].display).toBe("15%");
    // all-time: the after side leads (20% vs 17%), the served split of who booked rides the note
    expect(allTime.points[0]).toMatchObject({ label: "After the AI went live", display: "20%" });
    expect(allTime.points[0].note).toContain("AI 1 · your team 0 · unknown 1");
    // the card leads with the before side until an after reply is 30 days old
    expect(st.result).toMatchObject({ display: "15%", sample: "4 meetings of 27 people · after: no positive reply 30 days old yet" });
    expect(horizon.note).toContain("A figure needs 1 meeting behind it");
    // the brand with positive replies and no go-live is counted out; the one with none is not named
    expect(st.conclusion.join(" ")).toContain("1 brand with positive replies but no AI answer yet stays out (3 people)");
  });

  it("asks verdict.mjs once both sides have people at the same horizon, per person, never a conclusion across periods", () => {
    const st = meetingBeforeAfterStudy({ read: read(sideOf(60, 30, { people: 40, booked: 20 })), maturity });
    expect(st.charts[0].points[0].label).toBe("After the AI went live");
    expect(st.verdict.kind).toBe("signal");
    expect(st.verdict.reason).toContain("per person with a positive reply");
    expect(st.result.display).toBe("50%");
    expect(st.crowned).toBe(false);
  });

  it("fails loud when the fleet and the brands disagree on how many went live", () => {
    const bad = { ...read(sideOf(10, 2, { people: 0, booked: 0 })), fleet: { ...read(sideOf(10, 2, { people: 0, booked: 0 })).fleet, brands: 3 } };
    expect(() => meetingBeforeAfterStudy({ read: bad, maturity })).toThrow(/fleet says 3 brands/);
  });
});
