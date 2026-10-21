import { calendarLine, type GoogleCalendarHealth } from "../../lib/google-connect";

/** The fields of a connected calendar this line reads (google-service `GET /orgs/google/calendar/accounts`). */
export interface GoogleCalendarItem extends GoogleCalendarHealth {
  email: string;
}

/**
 * One connected Google Calendar on its Integrations row (GOOGLE-CALENDAR-INTEGRATIONS-ROW-1021).
 *
 * The address, then one line saying what we read: booked meetings and who joined the
 * Google Meet calls; attendance off when Meet access was not granted; reading stopped
 * when the last read failed. The last two offer Reconnect: the same calendar consent,
 * preselecting this address. Disconnect states what it deletes before it runs.
 *
 * Hook-free and alias-free on purpose: rendered for real in `tests/google-calendar-row.test.ts`.
 */
export function GoogleCalendarLine({
  calendar,
  confirming,
  removing,
  reconnecting,
  onReconnect,
  onAskDisconnect,
  onConfirmDisconnect,
  onKeep,
}: {
  calendar: GoogleCalendarItem;
  confirming: boolean;
  removing: boolean;
  reconnecting: boolean;
  onReconnect: () => void;
  onAskDisconnect: () => void;
  onConfirmDisconnect: () => void;
  onKeep: () => void;
}) {
  const line = calendarLine(calendar);
  const reconnectButton = (label: string) => (
    <button
      type="button"
      onClick={onReconnect}
      disabled={reconnecting}
      data-testid="calendar-reconnect"
      className="rounded-lg bg-brand-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-brand-700"
    >
      {reconnecting ? "Opening Google..." : label}
    </button>
  );

  return (
    <li className="text-sm" data-calendar={calendar.email}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-gray-900">{calendar.email}</span>
        {confirming ? (
          <>
            <button
              type="button"
              onClick={onConfirmDisconnect}
              disabled={removing}
              className="rounded-lg border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              {removing ? "Disconnecting..." : "Yes, disconnect"}
            </button>
            <button type="button" onClick={onKeep} className="rounded-lg px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50">
              Keep it
            </button>
          </>
        ) : (
          <>
            {line.reconnect ? reconnectButton("Reconnect") : null}
            <button
              type="button"
              onClick={onAskDisconnect}
              className="rounded-lg border border-gray-200 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50"
            >
              Disconnect
            </button>
          </>
        )}
      </div>
      {confirming ? (
        <p className="mt-0.5 text-gray-600" data-testid="calendar-disconnect-warning">
          Disconnecting stops reading {calendar.email} and deletes its meetings from distribute.you. Your Google Calendar stays as it is.
        </p>
      ) : (
        <p className={`mt-0.5 ${line.tone === "ok" ? "text-gray-600" : "text-amber-700"}`} data-testid="calendar-state">
          {line.text}
        </p>
      )}
    </li>
  );
}
