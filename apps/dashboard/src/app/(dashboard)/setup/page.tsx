"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

interface ByokKey {
  provider: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const PROVIDERS: Record<string, {
  name: string;
  description: string;
  placeholder: string;
  getKeyUrl: string;
}> = {
  anthropic: {
    name: "Anthropic",
    description: "Claude models for email generation",
    placeholder: "sk-ant-...",
    getKeyUrl: "https://console.anthropic.com/settings/keys",
  },
  apollo: {
    name: "Apollo",
    description: "Lead enrichment and contacts",
    placeholder: "...",
    getKeyUrl: "https://app.apollo.io/#/settings/integrations/api",
  },
  instantly: {
    name: "Instantly",
    description: "Email sending and warm-up",
    placeholder: "...",
    getKeyUrl: "https://app.instantly.ai/app/settings/integrations",
  },
  firecrawl: {
    name: "Firecrawl",
    description: "Web scraping and data extraction",
    placeholder: "fc-...",
    getKeyUrl: "https://www.firecrawl.dev/app/api-keys",
  },
};

const ALL_PROVIDERS = Object.keys(PROVIDERS);

export default function SetupPage() {
  const { getToken } = useAuth();
  const [keys, setKeys] = useState<ByokKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newKeys, setNewKeys] = useState<Record<string, string>>({});
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/keys`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      }
    } catch (err) {
      console.error("Failed to load keys:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveKey(provider: string) {
    const apiKey = newKeys[provider];
    if (!apiKey?.trim()) return;

    setSaving(provider);
    setError(null);
    setSuccess(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/keys`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ provider, apiKey: apiKey.trim() }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save key");
      }

      setSuccess(`${PROVIDERS[provider]?.name || provider} key saved`);
      setNewKeys((prev) => ({ ...prev, [provider]: "" }));
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save key");
    } finally {
      setSaving(null);
    }
  }

  async function handleDeleteKey(provider: string) {
    if (!confirm(`Remove ${PROVIDERS[provider]?.name || provider} key?`)) return;

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/keys/${provider}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete key");
    }
  }

  const hasKey = (provider: string) => keys.some((k) => k.provider === provider);

  const configuredCount = ALL_PROVIDERS.filter((p) => hasKey(p)).length;
  const allReady = configuredCount === ALL_PROVIDERS.length;

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4 max-w-2xl">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-2xl font-semibold text-gray-900">Setup</h1>
          <p className="text-gray-600">Configure your API provider keys to enable workflows.</p>
        </div>

        {/* Status banner */}
        {allReady && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 max-w-2xl">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">All keys configured!</span>
          </div>
        )}

        {/* Provider Keys */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          {ALL_PROVIDERS.map((providerId) => {
            const provider = PROVIDERS[providerId];
            const configured = hasKey(providerId);

            return (
              <div
                key={providerId}
                className="bg-white rounded-xl border border-gray-200 p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                    <p className="text-sm text-gray-500">{provider.description}</p>
                  </div>
                  {configured ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Configured
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
                      Required
                    </span>
                  )}
                </div>

                {configured ? (
                  <button
                    onClick={() => setSelectedProvider(providerId)}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition"
                  >
                    Manage Key
                  </button>
                ) : (
                  <button
                    onClick={() => setSelectedProvider(providerId)}
                    className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium transition"
                  >
                    Add Key
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Panel */}
      {selectedProvider && (() => {
        const provider = PROVIDERS[selectedProvider];
        const existingKey = keys.find((k) => k.provider === selectedProvider);
        const isConfigured = !!existingKey;

        return (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/30 z-40 md:hidden"
              onClick={() => setSelectedProvider(null)}
            />

            {/* Panel */}
            <div className="fixed md:relative right-0 top-0 h-full w-full max-w-md bg-white border-l border-gray-200 z-50 flex flex-col shadow-xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div>
                  <h2 className="font-semibold text-gray-900">{provider.name}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{provider.description}</p>
                </div>
                <button
                  onClick={() => setSelectedProvider(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
                    {success}
                  </div>
                )}

                <div className="bg-gray-50 rounded-xl p-4">
                  {isConfigured ? (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                          Configured
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                        <span className="text-xs text-gray-400">
                          Added {new Date(existingKey.createdAt).toLocaleDateString()}
                        </span>
                        <button
                          onClick={() => handleDeleteKey(selectedProvider)}
                          className="text-sm text-red-500 hover:text-red-600 font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <a
                        href={provider.getKeyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                      >
                        Get API key
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          autoComplete="off"
                          data-1p-ignore
                          data-lpignore="true"
                          placeholder={provider.placeholder}
                          value={newKeys[selectedProvider] || ""}
                          onChange={(e) => setNewKeys((prev) => ({ ...prev, [selectedProvider]: e.target.value }))}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                        <button
                          onClick={() => handleSaveKey(selectedProvider)}
                          disabled={!newKeys[selectedProvider]?.trim() || saving === selectedProvider}
                          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
                        >
                          {saving === selectedProvider ? "..." : "Save"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
