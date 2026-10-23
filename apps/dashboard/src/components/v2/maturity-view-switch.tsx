"use client";

import { useMaturityView } from "@/lib/v2/use-maturity-view";
import { CostBasisSwitch } from "@/components/v2/cost-basis-switch";

const HINT = {
  mature: "Only people we wrote to long enough ago for their replies to arrive",
  flash: "Everything to date, recent replies still on their way",
} as const;

/**
 * The staff switch between the Mature view (the default) and the Flash view, in the top bar of
 * every Research and Monitoring page. ONE setting: flipping it here flips it on every such page
 * and tab. Renders nothing outside staff mode. Never on a customer page.
 */
export function MaturityViewSwitch() {
  const { isStaff, view, setView } = useMaturityView();
  if (!isStaff) return null;
  return (
    <span className="inline-flex items-center gap-1.5" role="group" aria-label="View">
      {(["mature", "flash"] as const).map((v) => (
        <button
          key={v}
          type="button"
          title={HINT[v]}
          aria-pressed={view === v}
          onClick={() => setView(v)}
          className={view === v ? "k-btn h-7 px-2 text-[12px]" : "k-btn-ghost h-7 px-2 text-[12px]"}
        >
          {v === "mature" ? "Mature" : "Flash"}
        </button>
      ))}
    </span>
  );
}

/** Monitoring's one line under the switch: no figure there is a rate over a cohort, so both views read alike. */
export function MaturityViewSameNote() {
  const { isStaff } = useMaturityView();
  if (!isStaff) return null;
  return <p className="k-fg3 -mt-2 mb-4 text-right text-[12px]">Every figure here is the same in both views.</p>;
}

/** Every Research top bar: the view, then the cost basis. Both staff-only, both one shared choice. */
export function ResearchSwitches() {
  const { isStaff } = useMaturityView();
  if (!isStaff) return null;
  return (
    <>
      <MaturityViewSwitch />
      {/* a hairline between the two switches, so four buttons read as two choices */}
      <span aria-hidden className="h-4 w-px" style={{ background: "var(--line)" }} />
      <CostBasisSwitch />
    </>
  );
}
