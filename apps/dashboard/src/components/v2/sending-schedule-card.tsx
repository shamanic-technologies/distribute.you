"use client";

import { useEffect, useState } from "react";
import { getLeadSendingSchedule } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { localClock, scheduleRows, timezoneCity, windowOpenAt } from "@/lib/sending-schedule";
import { Shimmer, StateDot } from "@/components/v2/ui";

/**
 * WHEN we may email this person: the weekly window in their own timezone, and whether it
 * is open on their clock right now. The window is instantly-service's; this card only
 * shows it, so a customer sees we write during their prospect's working hours.
 */
export function SendingScheduleCard({ email, brandId }: { email: string; brandId: string }) {
  const q = useAuthQuery(["leadSendingSchedule", email, brandId], () => getLeadSendingSchedule(email, brandId));
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const schedule = q.data;
  const clock = schedule ? localClock(schedule.timezone, now) : null;
  const open = schedule ? windowOpenAt(schedule, now) : false;

  return (
    <div className="k-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="k-label">Sending schedule</p>
        {schedule ? <StateDot running={open} label={open ? "Open now" : "Closed now"} /> : null}
      </div>
      {q.isError ? (
        <p className="k-fg3 mt-3 text-[13px]">We could not read this schedule right now.</p>
      ) : !schedule || !clock ? (
        <div className="mt-3 space-y-2.5">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Shimmer key={i} className="h-4 w-full" />
          ))}
        </div>
      ) : (
        <>
          <dl className="mt-3 space-y-2.5 text-[13px]">
            {scheduleRows(schedule).map((row) => (
              <div key={row.day} className="flex items-baseline justify-between gap-3">
                <dt className={row.day === clock.day ? "font-medium" : "k-fg3"}>{row.label}</dt>
                <dd className="tabular-nums">{row.hours ?? <span className="k-fg4">Off</span>}</dd>
              </div>
            ))}
          </dl>
          <p className="k-fg3 k-line-subtle mt-3 border-t pt-3 text-[12px] leading-[18px]">
            {schedule.timezoneIsDefault
              ? `We don't know their time zone yet, so we use ${timezoneCity(schedule.timezone)} time (${clock.zone}).`
              : `Their time zone: ${timezoneCity(schedule.timezone)} (${clock.zone}).`}{" "}
            It&apos;s {clock.time} there.
          </p>
        </>
      )}
    </div>
  );
}
