"use client";

// The one Save row for every card on brand Settings. Two rules it exists to
// keep, which four hand-rolled copies could not:
//
// 1. Nothing is shown until something has been edited. A Save button sitting
//    greyed out under a form the user has not touched is a control offering
//    itself for an action there is nothing to do — it reads as a thing to press,
//    and it is dead every time.
// 2. It sits at the END of the row. A single primary action belongs where the
//    eye lands last, and every card on the page has to agree on that, or the
//    page reads as several forms that happen to share a background.
//
// `Saved ✓` survives the edit that produced it: it reports an action the user
// just took, so it stays until the next edit clears it.

export function SettingsSaveRow({
  dirty,
  saving,
  saved,
  onSave,
  disabled = false,
  label = "Save",
}: {
  /** The live form differs from the last saved values. */
  dirty: boolean;
  saving: boolean;
  /** A save landed and nothing has been edited since. */
  saved: boolean;
  onSave: () => void;
  /** Blocks the save for a reason of the card's own (a locked field, a gate). */
  disabled?: boolean;
  label?: string;
}) {
  if (!dirty && !saved) return null;

  return (
    <div className="mt-5 flex items-center justify-end gap-3">
      {saved && !dirty && <span className="text-sm text-green-600">Saved ✓</span>}
      {dirty && (
        <button
          type="button"
          onClick={onSave}
          disabled={disabled || saving}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving..." : label}
        </button>
      )}
    </div>
  );
}
