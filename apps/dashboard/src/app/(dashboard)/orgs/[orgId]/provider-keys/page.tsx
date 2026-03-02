"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  listByokKeys,
  setByokKey,
  deleteByokKey,
  listWorkflows,
  type ByokKey,
} from "@/lib/api";
import { SkeletonKeysList } from "@/components/skeleton";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface ProviderRow {
  provider: string;
  configured: boolean;
  maskedKey: string | null;
  updatedAt: string | null;
}

export default function ProviderKeysPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const queryClient = useQueryClient();

  const { data: keysData, isLoading: keysLoading } = useAuthQuery(
    ["byokKeys"],
    () => listByokKeys()
  );
  const { data: workflowsData, isLoading: workflowsLoading } = useAuthQuery(
    ["workflows"],
    () => listWorkflows()
  );

  const isLoading = keysLoading || workflowsLoading;
  const configuredKeys: ByokKey[] = keysData?.keys ?? [];

  // Merge known providers from workflows + already configured keys
  const providers: ProviderRow[] = useMemo(() => {
    const providerSet = new Set<string>();

    // From workflows
    for (const wf of workflowsData?.workflows ?? []) {
      for (const p of wf.requiredProviders ?? []) {
        providerSet.add(p);
      }
    }

    // From configured keys
    for (const k of configuredKeys) {
      providerSet.add(k.provider);
    }

    const keyMap = new Map(configuredKeys.map((k) => [k.provider, k]));

    return [...providerSet].sort().map((provider) => {
      const key = keyMap.get(provider);
      return {
        provider,
        configured: !!key,
        maskedKey: key?.maskedKey ?? null,
        updatedAt: key?.updatedAt ?? null,
      };
    });
  }, [workflowsData, configuredKeys]);

  // Form state for adding/editing a key
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSave(provider: string) {
    if (!apiKeyInput.trim()) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await setByokKey(provider, apiKeyInput.trim());
      await queryClient.invalidateQueries({ queryKey: ["byokKeys"] });
      setEditingProvider(null);
      setApiKeyInput("");
      setSuccessMessage(`${capitalize(provider)} key saved successfully.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save key");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(provider: string) {
    if (!confirm(`Remove your ${capitalize(provider)} key? Workflows using this provider will stop working.`)) return;
    setError(null);
    setSuccessMessage(null);
    try {
      await deleteByokKey(provider);
      await queryClient.invalidateQueries({ queryKey: ["byokKeys"] });
      setSuccessMessage(`${capitalize(provider)} key removed.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete key");
    }
  }

  function startEditing(provider: string) {
    setEditingProvider(provider);
    setApiKeyInput("");
    setError(null);
  }

  function cancelEditing() {
    setEditingProvider(null);
    setApiKeyInput("");
    setError(null);
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">Provider Keys</h1>
        <p className="text-gray-600">
          Manage your own API keys for external providers. These are used when running workflows with your own keys (BYOK).
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 text-sm">
          {successMessage}
        </div>
      )}

      {isLoading ? (
        <SkeletonKeysList />
      ) : providers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center max-w-2xl">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No providers found</h3>
          <p className="text-gray-600 text-sm max-w-md mx-auto">
            Provider keys will appear here when workflows that require external API keys are deployed.
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
                  {/* Status indicator */}
                  <div
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      row.configured ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  <div>
                    <h3 className="font-medium text-gray-800">{capitalize(row.provider)}</h3>
                    {row.configured && row.maskedKey ? (
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

                {/* Actions */}
                {editingProvider !== row.provider && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEditing(row.provider)}
                      className="text-sm font-medium text-brand-600 hover:text-brand-700"
                    >
                      {row.configured ? "Rotate" : "Add Key"}
                    </button>
                    {row.configured && (
                      <button
                        onClick={() => handleDelete(row.provider)}
                        className="text-sm font-medium text-red-500 hover:text-red-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Inline edit form */}
              {editingProvider === row.provider && (
                <div className="mt-4 flex items-center gap-2">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={`Enter your ${capitalize(row.provider)} API key`}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave(row.provider);
                      if (e.key === "Escape") cancelEditing();
                    }}
                  />
                  <button
                    onClick={() => handleSave(row.provider)}
                    disabled={saving || !apiKeyInput.trim()}
                    className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={cancelEditing}
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

      {/* Link to API Keys */}
      <div className="mt-8 max-w-2xl">
        <p className="text-xs text-gray-400">
          Looking for your API authentication keys?{" "}
          <Link href={`/orgs/${orgId}/api-keys`} className="text-brand-600 hover:underline">
            Manage API Keys
          </Link>
        </p>
      </div>
    </div>
  );
}
