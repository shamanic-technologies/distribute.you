"use client";

import { CheckCircleIcon } from "@heroicons/react/20/solid";
import {
  partitionChannelsByAvailability,
  type AcquisitionChannelDef,
} from "@/lib/acquisition-channels";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";

// Where we go to find a brand's buyers. A channel feeds the sales funnels above:
// the same funnel can be fed by cold email today and by paid clicks later, so
// the two are separate lists rather than one.
//
// This card STATES what we run, it does not ask. brand-service stores no channel
// selection, so a toggle here would take the answer and persist none of it, and
// a control that silently discards a choice is worse than no control. The choice
// arrives the day there is a field to write it to; until then the honest surface
// is the list of what runs today and what is coming.

export function BrandAcquisitionChannelsCard() {
  const { live, comingSoon } = partitionChannelsByAvailability();

  function renderChannel(def: AcquisitionChannelDef) {
    const dimmed = def.comingSoon;

    return (
      <li
        key={def.key}
        className={`rounded-xl border border-gray-200 ${
          dimmed ? "bg-gray-50" : "bg-white"
        }`}
      >
        <div className="flex items-start gap-3 p-4">
          <AcquisitionChannelMark def={def} dimmed={dimmed} />

          <div className="min-w-0 flex-1">
            <p
              className={`text-sm font-medium ${dimmed ? "text-gray-500" : "text-gray-900"}`}
            >
              {def.name}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">{def.summary}</p>
          </div>

          {dimmed ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
              Coming soon
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
              <CheckCircleIcon className="h-3.5 w-3.5" />
              Running
            </span>
          )}
        </div>
      </li>
    );
  }

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">Acquisition Channels</h2>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="mb-5 text-sm text-gray-500">
          Where we go to find your buyers. Every channel feeds the funnels above.
        </p>

        {live.length > 0 && <ul className="space-y-3">{live.map(renderChannel)}</ul>}

        {comingSoon.length > 0 && (
          <>
            {live.length > 0 && (
              <p className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-gray-400">
                Coming next
              </p>
            )}
            <ul className="space-y-3">{comingSoon.map(renderChannel)}</ul>
          </>
        )}
      </div>
    </section>
  );
}
