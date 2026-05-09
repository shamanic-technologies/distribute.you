"use client";

import { useState } from "react";

export function ConnectGoogleButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const redirectUri = `${window.location.origin}/services/crm/oauth/callback`;
    const res = await fetch("/api/v1/orgs/google/auth/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redirectUri }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[dashboard] /orgs/google/auth/start failed", res.status, body);
      setError(`Failed to start OAuth: ${res.status}`);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { url?: string };
    if (!data.url) {
      console.error("[dashboard] /orgs/google/auth/start returned no url", data);
      setError("OAuth start returned no URL");
      setLoading(false);
      return;
    }
    window.location.assign(data.url);
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium"
      >
        {loading ? "Connecting..." : "Connect Google"}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
