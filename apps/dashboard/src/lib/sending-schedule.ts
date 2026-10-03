/**
 * WHEN we may email one lead: the read, and the words for it.
 *
 * instantly-service owns the sending window (which local weekdays, which local hours, in
 * which timezone) and serves the exact values its send path books against. Nothing here
 * decides a window: this module parses it and formats it for the person page. Re-typing
 * "Mon-Fri 8-17" here would drift the day the service moves its window.
 *
 * Alias-free (zod and nothing else) so it carries real unit tests.
 */
import { z } from "zod";

export const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

export const SendingScheduleSchema = z.object({
  weekdays: z.array(z.enum(WEEKDAYS)),
  startHour: z.number().int(),
  endHour: z.number().int(),
  timezone: z.string().min(1),
  timezoneIsDefault: z.boolean(),
  hasSequence: z.boolean(),
});

export const SendingScheduleResponseSchema = z.object({
  success: z.literal(true),
  schedule: SendingScheduleSchema,
});

export type SendingSchedule = z.infer<typeof SendingScheduleSchema>;

/** Monday first: the order a working week is read in. */
const DISPLAY_ORDER: (typeof WEEKDAYS)[number][] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const SHORT_DAY: Record<(typeof WEEKDAYS)[number], string> = {
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
};

/** 8 -> "8 AM", 12 -> "12 PM", 17 -> "5 PM", 0 -> "12 AM". */
export function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${h < 12 ? "AM" : "PM"}`;
}

export type ScheduleRow = { day: (typeof WEEKDAYS)[number]; label: string; hours: string | null };

/** One row per day, Monday first. `hours` is null on a day we never send. */
export function scheduleRows(schedule: SendingSchedule): ScheduleRow[] {
  const hours = `${hourLabel(schedule.startHour)} to ${hourLabel(schedule.endHour)}`;
  return DISPLAY_ORDER.map((day) => ({
    day,
    label: SHORT_DAY[day],
    hours: schedule.weekdays.includes(day) ? hours : null,
  }));
}

/** "America/New_York" -> "New York". */
export function timezoneCity(timezone: string): string {
  const last = timezone.split("/").pop() ?? timezone;
  return last.replace(/_/g, " ");
}

/** The lead's own clock: weekday, time and zone abbreviation, read in their timezone. */
export function localClock(
  timezone: string,
  now: Date,
): { day: (typeof WEEKDAYS)[number]; hour: number; time: string; zone: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    hour: "numeric",
    hourCycle: "h23",
    minute: "2-digit",
    timeZoneName: "short",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = get("weekday").toLowerCase() as (typeof WEEKDAYS)[number];
  const hour = Number(get("hour")) % 24;
  const minute = get("minute");
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return {
    day,
    hour,
    time: `${SHORT_DAY[day]} ${twelve}:${minute} ${hour < 12 ? "AM" : "PM"}`,
    zone: get("timeZoneName"),
  };
}

/** Whether the served window is open on the lead's clock right now. */
export function windowOpenAt(schedule: SendingSchedule, now: Date): boolean {
  const clock = localClock(schedule.timezone, now);
  return schedule.weekdays.includes(clock.day) && clock.hour >= schedule.startHour && clock.hour < schedule.endHour;
}
