"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { extractErrorDetail } from "./error-detail";

interface SyncCounts {
  inserted: number;
  updated: number;
  unchanged: number;
}

interface ContactCounts extends SyncCounts {
  deleted: number;
}

interface SyncResult {
  accounts?: number;
  gmail?: SyncCounts;
  contacts?: ContactCounts;
}

export function SyncNowButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/v1/orgs/google/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[dashboard] /orgs/google/sync failed", res.status, body);
      const detail = extractErrorDetail(body, res.headers.get("Content-Type"));
      setError(detail ? `Sync failed (${res.status}): ${detail}` : `Sync failed: ${res.status}`);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as SyncResult;
    setResult(data);
    setLoading(false);
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium"
      >
        {loading ? "Syncing..." : "Sync now"}
      </button>
      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}
      {result && (
        <div className="mt-3 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm space-y-1">
          {typeof result.accounts === "number" && (
            <div>
              <strong>Accounts:</strong> {result.accounts}
            </div>
          )}
          {result.gmail && (
            <div>
              <strong>Gmail:</strong> {result.gmail.inserted} inserted ·{" "}
              {result.gmail.updated} updated · {result.gmail.unchanged} unchanged
            </div>
          )}
          {result.contacts && (
            <div>
              <strong>Contacts:</strong> {result.contacts.inserted} inserted ·{" "}
              {result.contacts.updated} updated · {result.contacts.unchanged}{" "}
              unchanged · {result.contacts.deleted} deleted
            </div>
          )}
        </div>
      )}
    </div>
  );
}
