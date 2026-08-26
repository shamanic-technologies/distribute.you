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
 * The charter's SECONDARY (purple, ~44 degrees off the primary blue), not amber: this
 * is a waiting state, and an amber/orange pill reads as a warning about something the
 * customer did wrong. It carries none of the decorative mark-tile
 * class, so it does not rotate with a customer's brand hue — a mark tile is decoration,
 * this carries meaning, and meaning never rotates. Every class is in the `html.dark` remapped set (`bg-purple-50` /
 * `text-purple-700` / `border-purple-200`), so it does not paint a light block on the
 * dark surface. Full-perimeter 1px border, per the no-side-accent rule.
 */
export function LearningTag({ withInfo = true }: { withInfo?: boolean }) {
  return (
    <span className="tone-tile inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-600 whitespace-nowrap">
      Learning
      {withInfo && <InfoTooltip tip={LEARNING_NOTE} placement="top" />}
    </span>
  );
}
