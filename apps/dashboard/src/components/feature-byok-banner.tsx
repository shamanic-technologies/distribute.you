"use client";

import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { ApiError, listByokKeys, setFeaturedCreds } from "@/lib/api";

const POLL_INTERVAL = 10_000;
const pollOptions = {
  refetchInterval: POLL_INTERVAL,
  refetchIntervalInBackground: false,
  placeholderData: keepPreviousData,
};

// TODO: remove fallback once features-service populates `feature.byokProvider`.
// Slug→provider map covers features that require BYOK creds when the backend
// hasn't yet wired the metadata.
const SLUG_PROVIDER_FALLBACK: Record<string, string> = {
  "pr-expert-quote-outreach": "featured",
};

function resolveProvider(featureSlug: string, byokProvider: string | null | undefined): string | null {
  if (byokProvider) return byokProvider;
  return SLUG_PROVIDER_FALLBACK[featureSlug] ?? null;
}

interface FeatureBYOKBannerProps {
  featureSlug: string;
  byokProvider: string | null | undefined;
}

export function FeatureBYOKBanner({ featureSlug, byokProvider }: FeatureBYOKBannerProps) {
  const provider = resolveProvider(featureSlug, byokProvider);

  const { data, isLoading } = useAuthQuery(
    ["byokKeys"],
    () => listByokKeys(),
    pollOptions,
  );

  if (!provider) return null;
  if (isLoading) return <div className="h-20 bg-gray-100 rounded-xl animate-pulse mb-4" />;

  const configured = data?.keys.some((k) => k.provider === provider);
  if (configured) return null;

  if (provider === "featured") {
    return <FeaturedCredsForm />;
  }
  return (
    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4 mb-4 text-sm">
      This feature requires <span className="font-mono">{provider}</span> credentials.
      Configure them in BYOK settings to start running.
    </div>
  );
}

function FeaturedCredsForm() {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setSaving(true);
    setError(null);
    try {
      await setFeaturedCreds(username.trim(), password);
      setUsername("");
      setPassword("");
      queryClient.invalidateQueries({ queryKey: ["byokKeys"] });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.message} (${err.status})`
          : err instanceof Error
            ? err.message
            : "Failed to save credentials";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl mb-6"
      data-testid="featured-creds-form"
    >
      <h2 className="text-lg font-medium text-gray-900 mb-1">
        Connect Featured account
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        We use these credentials to fetch quote requests and submit pitches on
        Featured.com.
      </p>

      {error && (
        <div
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm"
          data-testid="featured-creds-error"
        >
          {error}
        </div>
      )}

      <label className="block mb-3">
        <span className="text-xs font-medium text-gray-700 mb-1 block">
          Username
        </span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
      </label>

      <label className="block mb-4">
        <span className="text-xs font-medium text-gray-700 mb-1 block">
          Password
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
      </label>

      <button
        type="submit"
        disabled={saving || !username.trim() || !password}
        className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Connect Featured account"}
      </button>
    </form>
  );
}
