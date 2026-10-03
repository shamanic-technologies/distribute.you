import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SendingScheduleResponseSchema,
  hourLabel,
  localClock,
  scheduleRows,
  timezoneCity,
  windowOpenAt,
  type SendingSchedule,
} from "../src/lib/sending-schedule";

const SCHEDULE: SendingSchedule = {
  weekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  startHour: 8,
  endHour: 17,
  timezone: "America/New_York",
  timezoneIsDefault: false,
  hasSequence: true,
};

describe("sending schedule", () => {
  it("parses the served body", () => {
    const parsed = SendingScheduleResponseSchema.safeParse({ success: true, schedule: SCHEDULE });
    expect(parsed.success).toBe(true);
  });

  it("rejects a body without a schedule", () => {
    expect(SendingScheduleResponseSchema.safeParse({ success: true }).success).toBe(false);
  });

  it("labels hours on a 12-hour clock", () => {
    expect(hourLabel(8)).toBe("8 AM");
    expect(hourLabel(12)).toBe("12 PM");
    expect(hourLabel(17)).toBe("5 PM");
    expect(hourLabel(0)).toBe("12 AM");
  });

  it("lists the week Monday first, with weekends off", () => {
    const rows = scheduleRows(SCHEDULE);
    expect(rows.map((r) => r.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(rows[0].hours).toBe("8 AM to 5 PM");
    expect(rows[5].hours).toBeNull();
    expect(rows[6].hours).toBeNull();
  });

  it("follows the served weekdays, never a typed-in week", () => {
    const rows = scheduleRows({ ...SCHEDULE, weekdays: ["saturday"] });
    expect(rows.filter((r) => r.hours).map((r) => r.day)).toEqual(["saturday"]);
  });

  it("names the city of a timezone", () => {
    expect(timezoneCity("America/New_York")).toBe("New York");
    expect(timezoneCity("Europe/Paris")).toBe("Paris");
  });

  it("reads the lead's clock in their timezone", () => {
    // 2026-10-05 is a Monday; 14:30 UTC is 10:30 in New York (EDT).
    const clock = localClock("America/New_York", new Date("2026-10-05T14:30:00Z"));
    expect(clock.day).toBe("monday");
    expect(clock.time).toBe("Mon 10:30 AM");
    expect(clock.zone).toBe("EDT");
  });

  it("is open inside the window and closed outside it", () => {
    expect(windowOpenAt(SCHEDULE, new Date("2026-10-05T14:30:00Z"))).toBe(true); // Mon 10:30
    expect(windowOpenAt(SCHEDULE, new Date("2026-10-05T21:30:00Z"))).toBe(false); // Mon 17:30
    expect(windowOpenAt(SCHEDULE, new Date("2026-10-04T14:30:00Z"))).toBe(false); // Sun
  });

  it("the person page mounts the card under Details", () => {
    const src = readFileSync(join(__dirname, "../src/components/v2/person-page.tsx"), "utf8");
    const details = src.indexOf('<p className="k-label">Details</p>');
    const card = src.indexOf("<SendingScheduleCard");
    const crm = src.indexOf("<CrmAttributionCard");
    expect(details).toBeGreaterThan(-1);
    expect(card).toBeGreaterThan(details);
    expect(crm).toBeGreaterThan(card);
    expect(src.slice(card, src.indexOf("/>", card))).toContain("brandId={brandId}");
  });
});
