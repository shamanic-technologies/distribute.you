/** The booking facts of a GoHighLevel connection (crm-service `booking`, AUTO-BOOK-1103). */
export interface GhlBooking {
  /** true = the token can book, false = it lacks the permissions, null = not known yet. */
  canBook: boolean | null;
  requiredScopes: string[];
}

/**
 * The names GoHighLevel shows for each permission when you edit a Private Integration.
 * A pure display lookup: crm-service serves WHICH scopes are needed, an unknown one
 * prints as served.
 */
export const GHL_SCOPE_LABELS: Record<string, string> = {
  "contacts.write": "Edit Contacts",
  "calendars/events.write": "Edit Calendar Events",
};

export function ghlScopeLabel(scope: string): string {
  return GHL_SCOPE_LABELS[scope] ?? scope;
}

/**
 * Can our AI book meetings on this brand's GoHighLevel calendar (GHL-CANBOOK-CARD-1103).
 *
 * Three states, read straight off crm-service's `canBook`: it can (green), it cannot yet
 * (the steps to allow it in GoHighLevel + Check again), not known yet (neutral, never red).
 * Check again asks crm-service to probe GoHighLevel once more; the card flips on its answer.
 *
 * Hook-free and alias-free on purpose: rendered for real in `tests/ghl-booking-line.test.tsx`.
 */
export function GhlBookingLine({
  booking,
  checking,
  checkFailed,
  stillMissing,
  onCheck,
}: {
  booking: GhlBooking | null;
  checking: boolean;
  /** The last Check again could not reach crm-service / GoHighLevel. */
  checkFailed: boolean;
  /** The last Check again answered, and the permissions are still not there. */
  stillMissing: boolean;
  onCheck: () => void;
}) {
  const canBook = booking?.canBook ?? null;
  const checkButton = (label: string) => (
    <button
      type="button"
      onClick={onCheck}
      disabled={checking}
      data-testid="ghl-booking-check"
      className={`rounded-lg border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700 ${checking ? "cursor-wait" : "hover:bg-gray-50"}`}
    >
      {checking ? "Checking..." : label}
    </button>
  );

  if (canBook === true) {
    return (
      <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm" data-testid="ghl-booking" data-state="can-book">
        <p className="flex items-center gap-2 font-medium text-gray-900">
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
          Books meetings for you
        </p>
        <p className="mt-0.5 text-gray-600">When a prospect picks a time, our AI books it on your GoHighLevel calendar.</p>
      </div>
    );
  }

  if (canBook === null) {
    return (
      <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm" data-testid="ghl-booking" data-state="unknown">
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-2 font-medium text-gray-700">
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-gray-300" />
            Checking if our AI can book meetings on your calendar...
          </p>
          {checkButton("Check now")}
        </div>
        {checkFailed ? <p className="mt-1 text-gray-600">We could not check just now. Try again in a minute.</p> : null}
      </div>
    );
  }

  const permissions = (booking?.requiredScopes ?? []).map(ghlScopeLabel);
  return (
    <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm" data-testid="ghl-booking" data-state="cannot-book">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-2 font-medium text-gray-900">
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
          Can&apos;t book meetings yet
        </p>
        {checkButton("Check again")}
      </div>
      <p className="mt-0.5 text-gray-600">
        Our AI offers prospects a few times for now. Allow it to book, and it puts the meeting on your calendar itself.
      </p>
      <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-gray-700">
        <li>In GoHighLevel, open Settings, then Private Integrations.</li>
        <li>Edit the token you connected here.</li>
        <li>
          Add {permissions.length === 1 ? "this permission" : "these permissions"}:{" "}
          {permissions.map((p, i) => (
            <span key={p}>
              {i > 0 ? (i === permissions.length - 1 ? " and " : ", ") : null}
              <span className="font-medium text-gray-900">{p}</span>
            </span>
          ))}
          .
        </li>
        <li>Save, then press Check again.</li>
      </ol>
      {stillMissing ? (
        <p className="mt-1 text-gray-600" data-testid="ghl-booking-still-missing">
          Not there yet. Once you save in GoHighLevel, check again.
        </p>
      ) : null}
      {checkFailed ? <p className="mt-1 text-gray-600">We could not check just now. Try again in a minute.</p> : null}
    </div>
  );
}
