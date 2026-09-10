import { nameCounter, type NameCounterState } from "@/lib/name-limits";

/**
 * HOW MANY CHARACTERS ARE LEFT IN A NAME FIELD.
 *
 * Renders nothing until the end is in sight, then the remaining count, then the
 * same number in red once it is negative — X's behaviour, which is what this
 * was asked to be. The appearance of the number IS the warning; a counter
 * visible from the first keystroke is noise for most of a 255-character field.
 *
 * It states a NUMBER and no sentence. What the limit is, and what happens past
 * it, belong to the field's own help text and to the producer's refusal; a
 * counter that also explains itself is a paragraph nobody reads at the moment
 * they are typing.
 *
 * `aria-live="polite"` because a control whose only feedback is visual is a
 * control a screen reader user meets as a silent refusal on submit.
 */
export function CharCounter({
  value,
  max,
  normalize,
  className = "",
}: {
  value: string;
  max: number;
  normalize: (value: string) => string;
  className?: string;
}) {
  const state = nameCounter(value, max, normalize);
  if (!state.reveal) return null;
  return <CharCounterReadout state={state} className={className} />;
}

/** The readout alone, for a caller that already computed the state. */
export function CharCounterReadout({
  state,
  className = "",
}: {
  state: NameCounterState;
  className?: string;
}) {
  return (
    <span
      aria-live="polite"
      className={`text-xs tabular-nums ${TONE_CLASS[state.tone]} ${className}`}
    >
      {state.remaining}
    </span>
  );
}

// `text-amber-600` and `text-red-600` both carry an `html.dark` remap, so the
// warning reads on either surface. A tone added here needs its own remap in the
// same commit — a colour that is legible in the light default and near-black in
// the dark one is the recurring gap in this app.
const TONE_CLASS: Record<NameCounterState["tone"], string> = {
  quiet: "text-gray-400",
  close: "text-amber-600",
  over: "text-red-600 font-medium",
};
