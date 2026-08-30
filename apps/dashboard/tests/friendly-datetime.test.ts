import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { friendlyDate, friendlyDateTime, friendlyTime, timeAgo } from "../src/lib/friendly-datetime";

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

describe("timeAgo", () => {
  const now = at(2026, 7, 30, 14, 0);

  it("reads the sub-minute case as Just now, never a second count", () => {
    expect(timeAgo(new Date(now.getTime() - 1_000), now)).toBe("Just now");
    expect(timeAgo(new Date(now.getTime() - 59_000), now)).toBe("Just now");
  });

  it("singularises one minute and one hour", () => {
    expect(timeAgo(new Date(now.getTime() - 60_000), now)).toBe("1 minute ago");
    expect(timeAgo(at(2026, 7, 30, 13, 0), now)).toBe("1 hour ago");
  });

  it("counts minutes, then hours", () => {
    expect(timeAgo(at(2026, 7, 30, 13, 57), now)).toBe("3 minutes ago");
    expect(timeAgo(at(2026, 7, 30, 11, 0), now)).toBe("3 hours ago");
  });

  // Same local-midnight diff friendlyDate uses, so the two surfaces cannot disagree
  // about which day an instant fell on.
  it("counts calendar days once the day has turned", () => {
    expect(timeAgo(at(2026, 7, 29, 22, 0), now)).toBe("1 day ago");
    expect(timeAgo(at(2026, 7, 28, 16, 23), now)).toBe("2 days ago");
  });

  it("falls back to the calendar date past a month", () => {
    expect(timeAgo(at(2026, 6, 1, 9, 0), now)).toBe("Jun 1, 2026");
  });

  // A few seconds of clock skew must not print a negative count.
  it("never counts backwards", () => {
    expect(timeAgo(at(2026, 7, 30, 14, 30), now)).toBe("Just now");
    expect(timeAgo(at(2026, 8, 2, 9, 0), now)).toBe("Just now");
  });
});

// Source-substring: the component imports through the `@` alias, which vitest does
// not resolve in this repo.
describe("lead timeline date lines", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../src/components/audiences/engaged-leads-page.tsx"),
    "utf-8",
  );
  // Bounded by the NEXT declaration rather than a guessed length: both assertions
  // below are `toContain`, so a slice that falls short cuts the target out and the
  // failure reads as "the code is missing" for code that is right there. The delivery
  // row sits at the very end of the component, so every comment added to it pushed
  // the boundary — a fixed length was one edit away from breaking each time.
  const body = (() => {
    const at2 = src.indexOf("function LeadTimeline(");
    expect(at2).toBeGreaterThan(-1);
    const end = src.indexOf("function LeadsLoadingSkeleton(");
    expect(end).toBeGreaterThan(at2);
    return src.slice(at2, end);
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
