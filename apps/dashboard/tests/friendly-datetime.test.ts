import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { friendlyDate, friendlyDateTime, friendlyTime } from "../src/lib/friendly-datetime";

// Local time throughout: these are the reader's day boundaries, so the fixtures are
// built with the local-time Date constructor rather than an ISO string (which would
// be parsed as UTC and drift the expected day for anyone west of Greenwich).
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe("friendlyTime", () => {
  it.each([
    [at(2026, 7, 30, 8, 45), "8:45am"],
    [at(2026, 7, 30, 22, 45), "10:45pm"],
    [at(2026, 7, 30, 16, 23), "4:23pm"],
  ])("renders %s as %s", (d, expected) => {
    expect(friendlyTime(d)).toBe(expected);
  });

  // Both noon and midnight are hour 12, not hour 0 — `h % 12` alone prints "0:07am".
  it("renders midnight and noon as 12, not 0", () => {
    expect(friendlyTime(at(2026, 7, 30, 0, 7))).toBe("12:07am");
    expect(friendlyTime(at(2026, 7, 30, 12, 7))).toBe("12:07pm");
  });

  it("pads the minute but not the hour", () => {
    expect(friendlyTime(at(2026, 7, 30, 9, 5))).toBe("9:05am");
  });

  // Current ICU separates the meridiem with U+202F, so a `toLocaleTimeString` +
  // `.replace(" ", "")` implementation silently leaves a stray gap in the string.
  it("never emits whitespace", () => {
    expect(friendlyTime(at(2026, 7, 30, 8, 45))).not.toMatch(/\s/);
  });
});

describe("friendlyDate", () => {
  const now = at(2026, 7, 30, 14, 0);

  it("names today and yesterday", () => {
    expect(friendlyDate(at(2026, 7, 30, 8, 45), now)).toBe("Today");
    expect(friendlyDate(at(2026, 7, 29, 22, 45), now)).toBe("Yesterday");
  });

  // Calendar days, not 24-hour blocks: 11pm yesterday is 15 hours before 2pm today
  // and must still read "Yesterday".
  it("counts calendar days, not elapsed hours", () => {
    expect(friendlyDate(at(2026, 7, 29, 23, 59), now)).toBe("Yesterday");
    expect(friendlyDate(at(2026, 7, 30, 0, 1), now)).toBe("Today");
  });

  it("falls back to the calendar date beyond yesterday", () => {
    expect(friendlyDate(at(2026, 7, 28, 16, 23), now)).toBe("Jul 28, 2026");
  });

  // Deliberately no "Tomorrow": the only future rows are scheduled sends, and the
  // send window is weekdays 8am-5pm, so the day itself can move.
  it("gives a future instant its plain date, never a relative day name", () => {
    expect(friendlyDate(at(2026, 8, 2, 9, 12), now)).toBe("Aug 2, 2026");
    expect(friendlyDate(at(2026, 7, 31, 9, 12), now)).toBe("Jul 31, 2026");
  });
});

describe("friendlyDateTime", () => {
  const now = at(2026, 7, 30, 14, 0);

  it.each([
    [at(2026, 7, 30, 8, 45), "Today at 8:45am"],
    [at(2026, 7, 29, 22, 45), "Yesterday at 10:45pm"],
    [at(2026, 7, 28, 16, 23), "Jul 28, 2026 at 4:23pm"],
  ])("renders %s as %s", (d, expected) => {
    expect(friendlyDateTime(d, now)).toBe(expected);
  });
});

// Source-substring: the component imports through the `@` alias, which vitest does
// not resolve in this repo.
describe("lead timeline date lines", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../src/components/audiences/engaged-leads-page.tsx"),
    "utf-8",
  );
  const body = (() => {
    const at2 = src.indexOf("function LeadTimeline(");
    expect(at2).toBeGreaterThan(-1);
    return src.slice(at2, at2 + 11000);
  })();

  it("gives a past instant its time and a future one only its date", () => {
    // Instantly sends inside a weekday window, so a clock time on a projected send
    // would be invented precision.
    expect(body).toContain("{isFuture ? friendlyDate(e.at) : friendlyDateTime(e.at)}");
  });

  it("times every delivery row inside a message card", () => {
    // These are observed instants, so they always carry the time.
    expect(body).toContain("{friendlyDateTime(ev.at)}");
  });

  it("keeps the full timestamp on hover", () => {
    // The friendly form drops the seconds and the timezone; the title keeps them.
    expect(body).toContain('title={new Date(e.at).toLocaleString()}');
    expect(body).toContain('title={new Date(ev.at).toLocaleString()}');
  });

  it("drops the bare calendar-date render", () => {
    expect(body).not.toContain('toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })');
  });
});
