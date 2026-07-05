"use client";

import { useGoogleSync } from "./use-google-sync";

/**
 * Manual "Sync now" trigger. Runs the shared Google-sync flow (POST + poll) and,
 * on success, invalidates the React Query CRM roots so the messages / contacts /
 * accounts lists silently revalidate — no full-page `router.refresh` (the lists
 * are client-side React Query now, not a server render).
 */
export function SyncNowButton() {
  const { loading, error, summary, runSync } = useGoogleSync();

  return (
    <div>
      <button
        onClick={() => void runSync()}
        disabled={loading}
        className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium inline-flex items-center gap-2"
      >
        {loading && (
          <span
            className="inline-block h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin"
            aria-hidden="true"
          />
        )}
        {loading ? "Syncing..." : "Sync now"}
      </button>
      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}
      {summary && (
        <div className="mt-3 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm space-y-1">
          {typeof summary.accounts === "number" && (
            <div>
              <strong>Accounts:</strong> {summary.accounts}
            </div>
          )}
          {summary.gmail && (
            <div>
              <strong>Gmail:</strong> {summary.gmail.inserted} inserted ·{" "}
              {summary.gmail.updated} updated · {summary.gmail.unchanged} unchanged
            </div>
          )}
          {summary.contacts && (
            <div>
              <strong>Contacts:</strong> {summary.contacts.inserted} inserted ·{" "}
              {summary.contacts.updated} updated · {summary.contacts.unchanged}{" "}
              unchanged · {summary.contacts.deleted} deleted
            </div>
          )}
        </div>
      )}
    </div>
  );
}
