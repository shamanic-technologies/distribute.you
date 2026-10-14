import { canSendFrom } from "../../lib/google-connect";

/** The fields of a connected mailbox this line reads (google-service `GET /orgs/google/accounts`). */
export interface GmailMailbox {
  email: string;
  status: string;
  gmailUnavailableReason: string | null;
  scopes: string[];
}

/**
 * One connected mailbox on the Gmail row (GMAIL-NEEDS-SEND-ACCESS-1014).
 *
 * A mailbox whose grant lacks send access says so and offers Reconnect: the same
 * Google sign-in, preselecting this address, which updates the same mailbox and
 * keeps its history. A mailbox with send access shows only its address and
 * Disconnect. Disconnect states what it deletes before it runs, and offers
 * Reconnect in its place, so nobody wipes a mailbox to sign in again.
 *
 * Hook-free and alias-free on purpose: rendered for real in `tests/gmail-send-access.test.tsx`.
 */
export function GmailMailboxLine({
  account,
  confirming,
  removing,
  reconnecting,
  onReconnect,
  onAskDisconnect,
  onConfirmDisconnect,
  onKeep,
}: {
  account: GmailMailbox;
  confirming: boolean;
  removing: boolean;
  reconnecting: boolean;
  onReconnect: () => void;
  onAskDisconnect: () => void;
  onConfirmDisconnect: () => void;
  onKeep: () => void;
}) {
  const needsSendAccess = !canSendFrom(account);
  const reconnectButton = (label: string) => (
    <button
      type="button"
      onClick={onReconnect}
      disabled={reconnecting}
      data-testid="gmail-reconnect"
      className="rounded-lg bg-brand-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-brand-700"
    >
      {reconnecting ? "Opening Google..." : label}
    </button>
  );

  return (
    <li className="text-sm" data-mailbox={account.email}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-gray-900">{account.email}</span>
        {account.status !== "active" ? (
          <span className="text-amber-700">{account.gmailUnavailableReason ?? "Gmail is not available on this account."}</span>
        ) : null}
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
            {reconnectButton("Reconnect instead")}
            <button type="button" onClick={onKeep} className="rounded-lg px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50">
              Keep it
            </button>
          </>
        ) : (
          <>
            {needsSendAccess ? reconnectButton("Reconnect") : null}
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
      {needsSendAccess && !confirming ? (
        <p className="mt-0.5 text-amber-700" data-testid="gmail-needs-send-access">
          Sign in again so follow-ups can reply from this mailbox. The mailbox history stays.
        </p>
      ) : null}
      {confirming ? (
        <p className="mt-0.5 text-gray-600" data-testid="gmail-disconnect-warning">
          Disconnecting stops reading {account.email} and deletes the mailbox history from distribute.you. To sign in again, use Reconnect instead.
        </p>
      ) : null}
    </li>
  );
}
