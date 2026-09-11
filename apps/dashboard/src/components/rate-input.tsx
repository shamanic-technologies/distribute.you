"use client";

/**
 * A conversion-rate field: the number and its `%` sit TOGETHER, in a box sized
 * for a percentage. A full-width box with the digits at the left edge and the
 * unit floated to the right edge puts a hundred pixels between the two halves
 * of one value, and a reader stops seeing it as a percentage at all. Width and
 * alignment are the whole design: `w-28` fits `100` with room to type, and the
 * number is right-aligned so it abuts the sign whatever its length. The `$`
 * money field beside it keeps its own shape (a prefix on a wider box), since
 * an amount grows to the right.
 */
export function RateInput({
  value,
  onChange,
  onBlur,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  ariaLabel?: string;
}) {
  return (
    <span className="inline-flex self-start items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 focus-within:border-brand-400">
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-28 min-w-0 bg-transparent text-right text-sm font-semibold text-gray-900 focus:outline-none"
      />
      <span className="text-sm text-gray-500">%</span>
    </span>
  );
}
