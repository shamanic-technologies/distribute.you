import { LEARNING_NOTE } from "@/lib/learning-threshold";
import { InfoTooltip } from "@/components/visibility/metric-info";

/**
 * Stands in for a cost per outcome that has too few outcomes behind it to state.
 *
 * It takes the VALUE's place rather than sitting beside one, because printing a
 * dollar figure and a caveat together is read as a price with a footnote — the whole
 * point is that there is no figure yet. The (i) carries the reason, through the shared
 * `InfoTooltip` (a native tooltip attribute shows nothing on a phone).
 *
 * Amber, and every class is in the `html.dark` remapped set (`bg-amber-50` /
 * `text-amber-700` / `border-amber-200`), so it does not paint a light block on the
 * dark surface. Full-perimeter 1px border, per the no-side-accent rule.
 */
export function LearningTag({ withInfo = true }: { withInfo?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 whitespace-nowrap">
      Learning
      {withInfo && <InfoTooltip tip={LEARNING_NOTE} placement="top" />}
    </span>
  );
}
