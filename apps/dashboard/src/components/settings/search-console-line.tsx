import {
  searchConsoleAccountLine,
  searchConsolePropertyLine,
  searchConsoleSiteName,
  type SearchConsoleAccountHealth,
  type SearchConsolePropertyHealth,
} from "../../lib/google-connect";

/** The fields of a connected Search Console account this line reads (google-service `GET /orgs/google/search-console/accounts`). */
export interface SearchConsoleItem extends SearchConsoleAccountHealth {
  email: string;
  properties: SearchConsolePropertyHealth[];
}

const TONE: Record<"ok" | "muted" | "warn", string> = {
  ok: "text-gray-600",
  muted: "text-gray-500",
  warn: "text-amber-700",
};

/**
 * One connected Google Search Console account on its Integrations row (GSC-CONNECTOR-1108).
 *
 * The address, then each of its sites in plain words: counting clicks for which brand, or why
 * not (google-service's verdict, only named here). A dead token says so and offers Reconnect:
 * the same consent, preselecting this address. Disconnect states what it keeps before it runs.
 *
 * Hook-free and alias-free on purpose: rendered for real in `tests/search-console-row.test.ts`.
 */
export function SearchConsoleLine({
  account,
  brandNames,
  confirming,
  removing,
  reconnecting,
  onReconnect,
  onAskDisconnect,
  onConfirmDisconnect,
  onKeep,
}: {
  account: SearchConsoleItem;
  /** Brand id → display name, null while the brand list has not answered. */
  brandNames: Map<string, string> | null;
  confirming: boolean;
  removing: boolean;
  reconnecting: boolean;
  onReconnect: () => void;
  onAskDisconnect: () => void;
  onConfirmDisconnect: () => void;
  onKeep: () => void;
}) {
  const line = searchConsoleAccountLine(account);
  return (
    <li className="text-sm" data-search-console={account.email}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-gray-900">{account.email}</span>
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
            {line.reconnect ? (
              <button
                type="button"
                onClick={onReconnect}
                disabled={reconnecting}
                data-testid="search-console-reconnect"
                className="rounded-lg bg-brand-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-brand-700"
              >
                {reconnecting ? "Opening Google..." : "Reconnect"}
              </button>
            ) : null}
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
        <p className="mt-0.5 text-gray-600" data-testid="search-console-disconnect-warning">
          Disconnecting stops counting new clicks from {account.email}. Clicks already counted stay on your dashboard.
        </p>
      ) : line.text ? (
        <p className={`mt-0.5 ${TONE[line.tone]}`} data-testid="search-console-state">
          {line.text}
        </p>
      ) : null}
      {account.properties.length === 0 ? (
        <p className="mt-0.5 text-gray-500" data-testid="search-console-no-site">
          Google lists no site for this account yet.
        </p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {account.properties.map((p) => {
            const site = searchConsolePropertyLine(p, p.brandId ? (brandNames?.get(p.brandId) ?? null) : null);
            return (
              <li key={p.siteUrl} className="flex flex-wrap items-baseline gap-x-2" data-site={p.siteUrl}>
                <span className="font-medium text-gray-800">{searchConsoleSiteName(p.siteUrl)}</span>
                <span className={TONE[site.tone]}>{site.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
