"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  listApiKeys,
  createApiKey,
  deleteApiKey,
  listByokKeys,
  setByokKey,
  deleteByokKey,
  listWorkflows,
  listKeySources,
  setKeySource,
  type ApiKey,
  type NewApiKey,
  type ByokKey,
  type KeySourcePreference,
} from "@/lib/api";
import { SkeletonApiKey } from "@/components/skeleton";

const POLL_INTERVAL = 5_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false };

/** Providers that should always appear in the BYOK section, even if no workflow requires them yet. */
const ALWAYS_VISIBLE_PROVIDERS = ["serper-dev"] as const;

/** Human-friendly metadata for well-known providers. */
const PROVIDER_META: Record<string, { label: string; description: string }> = {
  "serper-dev": {
    label: "Serper.dev API Key",
    description: "Used for web and news search via Google (endpoints /search/*)",
  },
};

function providerLabel(provider: string): string {
  return PROVIDER_META[provider]?.label ?? capitalize(provider);
}

function capitalize(s: unknown): string {
  const str = String(s ?? "");
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

interface ProviderRow {
  provider: string;
  configured: boolean;
  maskedKey: string | null;
  updatedAt: string | null;
  keySource: "org" | "platform";
}

export default function OrgApiKeysPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  void orgId; // used in the future if needed
  const queryClient = useQueryClient();

  // ─── Platform API Keys ──────────────────────────────────────────────────
  const { data: apiKeysData, isLoading: apiKeysLoading } = useAuthQuery(
    ["apiKeys"],
    () => listApiKeys(),
    pollOptions,
  );
  const keys: ApiKey[] = apiKeysData?.keys ?? [];

  const [newKey, setNewKey] = useState<NewApiKey | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    setApiKeyError(null);
    setNewKey(null);
    try {
      const data = await createApiKey("Dashboard Key");
      setNewKey(data);
      await queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
    } catch (err) {
      setApiKeyError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteApiKey(id: string) {
    if (!confirm("Delete this API key? It will stop working immediately.")) return;
    try {
      await deleteApiKey(id);
      await queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
    } catch (err) {
      setApiKeyError(err instanceof Error ? err.message : "Failed to delete key");
    }
  }

  function handleCopy(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ─── Provider Keys (BYOK) ──────────────────────────────────────────────
  const { data: byokData, isLoading: byokLoading } = useAuthQuery(
    ["byokKeys"],
    () => listByokKeys(),
    pollOptions,
  );
  const { data: workflowsData, isLoading: workflowsLoading } = useAuthQuery(
    ["workflows"],
    () => listWorkflows(),
    pollOptions,
  );
  const { data: keySourcesData, isLoading: keySourcesLoading } = useAuthQuery(
    ["keySources"],
    () => listKeySources(),
    pollOptions,
  );

  const configuredKeys: ByokKey[] = byokData?.keys ?? [];
  const keySources: KeySourcePreference[] = keySourcesData?.sources ?? [];

  const providers: ProviderRow[] = useMemo(() => {
    const providerSet = new Set<string>(ALWAYS_VISIBLE_PROVIDERS);
    for (const wf of workflowsData?.workflows ?? []) {
      if (wf.status && wf.status === "deprecated") continue;
      for (const p of wf.requiredProviders ?? []) {
        if (typeof p === "string" && p) providerSet.add(p);
      }
    }
    for (const k of configuredKeys) {
      providerSet.add(k.provider);
    }
    const keyMap = new Map(configuredKeys.map((k) => [k.provider, k]));
    const sourceMap = new Map(keySources.map((s) => [s.provider, s.keySource]));
    return [...providerSet].sort().map((provider) => {
      const key = keyMap.get(provider);
      return {
        provider,
        configured: !!key,
        maskedKey: key?.maskedKey ?? null,
        updatedAt: key?.updatedAt ?? null,
        keySource: sourceMap.get(provider) ?? "platform",
      };
    });
  }, [workflowsData, configuredKeys, keySources]);

  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [providerKeyInput, setProviderKeyInput] = useState("");
  const [savingProvider, setSavingProvider] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerSuccess, setProviderSuccess] = useState<string | null>(null);

  async function handleSaveProvider(provider: string) {
    if (!providerKeyInput.trim()) return;
    setSavingProvider(true);
    setProviderError(null);
    setProviderSuccess(null);
    try {
      await setByokKey(provider, providerKeyInput.trim());
      await queryClient.invalidateQueries({ queryKey: ["byokKeys"] });
      setEditingProvider(null);
      setProviderKeyInput("");
      setProviderSuccess(`${providerLabel(provider)} saved successfully.`);
      setTimeout(() => setProviderSuccess(null), 3000);
    } catch (err) {
      setProviderError(err instanceof Error ? err.message : "Failed to save key");
    } finally {
      setSavingProvider(false);
    }
  }

  async function handleDeleteProvider(provider: string) {
    if (!confirm(`Remove your ${providerLabel(provider)} key? Workflows using this provider will stop working.`)) return;
    setProviderError(null);
    setProviderSuccess(null);
    try {
      await deleteByokKey(provider);
      await queryClient.invalidateQueries({ queryKey: ["byokKeys"] });
      setProviderSuccess(`${providerLabel(provider)} key removed.`);
      setTimeout(() => setProviderSuccess(null), 3000);
    } catch (err) {
      setProviderError(err instanceof Error ? err.message : "Failed to delete key");
    }
  }

  function startEditingProvider(provider: string) {
    setEditingProvider(provider);
    setProviderKeyInput("");
    setProviderError(null);
  }

  function cancelEditingProvider() {
    setEditingProvider(null);
    setProviderKeyInput("");
    setProviderError(null);
  }

  const [togglingSource, setTogglingSource] = useState<string | null>(null);

  async function handleToggleSource(provider: string, currentSource: "org" | "platform") {
    const newSource = currentSource === "platform" ? "org" : "platform";
    setTogglingSource(provider);
    setProviderError(null);
    setProviderSuccess(null);
    try {
      await setKeySource(provider, newSource);
      await queryClient.invalidateQueries({ queryKey: ["keySources"] });
      setProviderSuccess(`${providerLabel(provider)} switched to ${newSource === "org" ? "your own key" : "platform key"}.`);
      setTimeout(() => setProviderSuccess(null), 3000);
    } catch (err) {
      setProviderError(err instanceof Error ? err.message : "Failed to update key source");
    } finally {
      setTogglingSource(null);
    }
  }

  const isLoading = apiKeysLoading || byokLoading || workflowsLoading || keySourcesLoading;

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-gray-800">Keys</h1>
          <p className="text-gray-600">Manage API and provider keys for this organization.</p>
        </div>
        <SkeletonApiKey />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">Keys</h1>
        <p className="text-gray-600">Manage API and provider keys for this organization.</p>
      </div>

      {/* ─── Section 1: Platform API Key ────────────────────────────────── */}
      <div className="mb-10">
        <h2 className="text-lg font-medium text-gray-900 mb-1">Platform API Key</h2>
        <p className="text-sm text-gray-500 mb-4">
          Use this key to connect to Distribute via the API or MCP clients.
        </p>

        {apiKeyError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {apiKeyError}
          </div>
        )}

        {newKey && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-green-800 mb-2">New API Key Created</h3>
                <p className="text-sm text-green-700 mb-3">
                  Copy this key now. It won&apos;t be shown again.
                </p>
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <code className="font-mono text-sm text-gray-800 break-all">
                    {newKey.key}
                  </code>
                </div>
              </div>
              <button
                onClick={() => handleCopy(newKey.key)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4 max-w-2xl">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-800">Create New API Key</h3>
                <p className="text-sm text-gray-500">Generate a new key for MCP or API access</p>
              </div>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium"
              >
                {creating ? "Creating..." : "Create Key"}
              </button>
            </div>
          </div>

          {keys.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-medium text-gray-800 mb-4">Your API Keys</h3>
              <div className="space-y-3">
                {keys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
                  >
                    <div>
                      <code className="font-mono text-sm text-gray-700">
                        {key.keyPrefix}••••••••••••••••
                      </code>
                      <div className="text-xs text-gray-500 mt-1">
                        Created {new Date(key.createdAt).toLocaleDateString()}
                        {key.lastUsedAt && (
                          <> · Last used {new Date(key.lastUsedAt).toLocaleDateString()}</>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteApiKey(key.id)}
                      className="text-red-500 hover:text-red-600 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-medium text-gray-800 mb-4">How to Use</h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-gray-700 mb-2">Claude Code:</p>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
{`claude mcp add distribute -- npx @distribute/mcp --api-key=YOUR_API_KEY`}
                </pre>
              </div>
              <div>
                <p className="font-medium text-gray-700 mb-2">Claude Desktop / Cursor:</p>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
{`{
  "mcpServers": {
    "distribute": {
      "command": "npx",
      "args": ["@distribute/mcp", "--api-key=YOUR_API_KEY"]
    }
  }
}`}
                </pre>
              </div>
              <div>
                <p className="font-medium text-gray-700 mb-2">REST API:</p>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
{`curl https://api.distribute.you/v1/me \\
  -H "X-API-Key: YOUR_API_KEY"`}
                </pre>
              </div>
              <div>
                <p className="font-medium text-gray-700 mb-2">TypeScript Client:</p>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
{`import { DistributeClient } from "@distribute/api-client";

const client = new DistributeClient({
  apiKey: "YOUR_API_KEY",
});`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Section 2: Provider Keys (BYOK) ────────────────────────────── */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-1">Provider Keys</h2>
        <p className="text-sm text-gray-500 mb-4">
          Manage your own API keys for external providers (BYOK). These are used when running workflows with your own keys.
        </p>

        {providerError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {providerError}
          </div>
        )}
        {providerSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {providerSuccess}
          </div>
        )}

        {providers.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center max-w-2xl">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">
              No providers found. Provider keys will appear here when workflows that require external API keys are deployed.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {providers.map((row) => (
              <div
                key={row.provider}
                className="bg-white rounded-xl border border-gray-200 p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        row.keySource === "platform" || row.configured ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                    <div>
                      <h3 className="font-medium text-gray-800">{providerLabel(row.provider)}</h3>
                      {PROVIDER_META[row.provider]?.description && !row.configured && row.keySource === "org" && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {PROVIDER_META[row.provider].description}
                        </p>
                      )}
                      {row.keySource === "platform" ? (
                        <p className="text-xs text-gray-500 mt-0.5">Using platform key</p>
                      ) : row.configured && row.maskedKey ? (
                        <p className="text-xs text-gray-500 mt-0.5">
                          <code className="font-mono">{row.maskedKey}</code>
                          {row.updatedAt && (
                            <> · Updated {new Date(row.updatedAt).toLocaleDateString()}</>
                          )}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 mt-0.5">Not configured</p>
                      )}
                    </div>
                  </div>

                  {editingProvider !== row.provider && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleSource(row.provider, row.keySource)}
                        disabled={togglingSource === row.provider || (row.keySource === "platform" && !row.configured)}
                        className="text-xs font-medium px-2 py-1 rounded-full border transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title={row.keySource === "platform" && !row.configured ? "Add your own key first to switch" : `Switch to ${row.keySource === "platform" ? "own key" : "platform key"}`}
                      >
                        {togglingSource === row.provider ? "..." : row.keySource === "platform" ? "Use own key" : "Use platform"}
                      </button>
                      {row.keySource === "org" && (
                        <>
                          <button
                            onClick={() => startEditingProvider(row.provider)}
                            className="text-sm font-medium text-brand-600 hover:text-brand-700"
                          >
                            {row.configured ? "Rotate" : "Add Key"}
                          </button>
                          {row.configured && (
                            <button
                              onClick={() => handleDeleteProvider(row.provider)}
                              className="text-sm font-medium text-red-500 hover:text-red-600"
                            >
                              Remove
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {editingProvider === row.provider && (
                  <div className="mt-4 flex items-center gap-2">
                    <input
                      type="password"
                      value={providerKeyInput}
                      onChange={(e) => setProviderKeyInput(e.target.value)}
                      placeholder={`Enter your ${providerLabel(row.provider)} key`}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveProvider(row.provider);
                        if (e.key === "Escape") cancelEditingProvider();
                      }}
                    />
                    <button
                      onClick={() => handleSaveProvider(row.provider)}
                      disabled={savingProvider || !providerKeyInput.trim()}
                      className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                    >
                      {savingProvider ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={cancelEditingProvider}
                      className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
