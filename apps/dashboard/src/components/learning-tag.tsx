import { LEARNING_NOTE, PAUSED_NOTE } from "@/lib/learning-threshold";
import { InfoTooltip } from "@/components/visibility/metric-info";

/**
 * Stands in for a cost per outcome that has too few outcomes behind it to state.
 *
 * It takes the VALUE's place rather than sitting beside one, because printing a
 * dollar figure and a caveat together is read as a price with a footnote — the whole
 * point is that there is no figure yet. The (i) carries the reason, through the shared
 * `InfoTooltip` (a native tooltip attribute shows nothing on a phone).
 *
 * The charter's TERTIARY, owner-decided: every campaign surface reads in one accent,
 * and this tag is the one a reader meets most often on them. It carries `tone-tile`,
 * so on a customer's dashboard it is THEIR tertiary rather than ours — the fill, the
 * text and the border each have a rotation rule, or the pill renders two hues at once.
 * Every class is in the `html.dark` remapped set (`bg-orange-50` / `text-orange-600` /
 * `border-orange-200`), so it does not paint a light block on the dark surface.
 * Full-perimeter 1px border, per the no-side-accent rule.
 *
 * `paused` says the campaign that would have produced those outcomes is STOPPED, and
 * the tag then reads **Paused** in the pause grey — the same word and the same tint the
 * status pill and the controls roll-up already use, so one campaign is never described
 * two ways on one screen. `Learning` there would state a process that is not running:
 * a reader waits for a figure that cannot arrive until they restart the campaign. Grey
 * carries no `tone-tile`: a verdict never rotates with the brand hue, and both classes
 * are in the `html.dark` remapped set.
 */
export function LearningTag({
  withInfo = true,
  paused = false,
}: {
  withInfo?: boolean;
  paused?: boolean;
}) {
  const tone = paused
    ? "border-gray-200 bg-gray-100 text-gray-500"
    : "tone-tile border-orange-200 bg-orange-50 text-orange-600";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tone}`}
    >
      {paused ? "Paused" : "Learning"}
      {withInfo && <InfoTooltip tip={paused ? PAUSED_NOTE : LEARNING_NOTE} placement="top" />}
    </span>
  );
}
