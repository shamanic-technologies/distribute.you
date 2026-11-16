"use client";

import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { EngineScriptsCard, useScriptEngines } from "@/components/v2/monitoring-script-engines";
import { useResearchMeasureEntry } from "@/lib/research/research-source";
import type { ResearchMeasure } from "@/lib/research/research";
import type { ScriptEngine, ScriptEnginesRead } from "@/lib/monitoring/script-engines";

/**
 * A measure's live scripts = its Engine's scripts as the Rating ranks them TODAY (RESEARCH-NATIVE-ENGINE-1116-P3-DASH).
 * The measure's Engine is the Research file's `measures[].engine`; its scripts are the Engine's row of the script board
 * Monitoring reads (features-service script-engines, `useScriptEngines`, one query key): the same card, the same
 * figures, one source. Nothing is ranked, divided or re-sorted here. The board's value per dollar is the Rating's
 * decision figure, never a return.
 */

/** The board row of one Engine, or null when the board lists none for it. */
export function engineOf(read: ScriptEnginesRead | undefined, engine: string | null): ScriptEngine | null {
  if (!read || read.state !== "ready" || !engine) return null;
  return read.board.engines.find((e) => e.outcome === engine) ?? null;
}

/** The Engine's board row for a measure, and the read it comes from (the page title's count reads the same). */
export function useMeasureEngineScripts(measure: ResearchMeasure) {
  const engine = useResearchMeasureEntry(measure)?.engine ?? null;
  const boardQ = useScriptEngines();
  return { boardQ, engine: engineOf(boardQ.data, engine) };
}

export function ResearchLiveScripts({ measure }: { measure: ResearchMeasure }) {
  const { boardQ, engine } = useMeasureEngineScripts(measure);
  if (boardQ.isError && !boardQ.data) return <Note>We could not read the scripts the Rating runs just now. It retries on its own.</Note>;
  if (!boardQ.data) {
    return (
      <div className="k-card space-y-2 p-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }
  if (boardQ.data.state === "building") return <Note>The Rating is building its board (every 15 minutes). The scripts show here once it lands.</Note>;
  if (!engine) return <Note>No script makes this outcome yet.</Note>;
  return <EngineScriptsCard e={engine} />;
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="k-card">
      <EmptyNote>{children}</EmptyNote>
    </div>
  );
}

/**
 * A click on the row opens its drawer, except on a control (the name link, "+N more", the status
 * menu) and except a click that only BUBBLED here through a portal (the status menu's modal, the
 * tactics popover): React carries portal events up the component tree, not the DOM one.
 */
export function opensDrawer(target: EventTarget, row: Element): boolean {
  if (!(target instanceof Element) || !row.contains(target)) return false;
  return target.closest("a,button,input,textarea,select,[role=menu],[role=dialog]") == null;
}
