"use client";

import { useState } from "react";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  listApiKeys,
  createApiKey,
  deleteApiKey,
  type ApiKey,
  type NewApiKey,
} from "@/lib/api";
import { useCoordinatedReveal } from "@/lib/use-coordinated-reveal";
import { pollOptions } from "@/lib/query-options";
import { DashboardPage } from "@/components/dashboard-page";

/**
 * One org, one kind of key: ours. The page used to carry a second section where
 * an org pasted its own third-party credentials; that is gone on purpose — we
 * hand out a Distribute key and run every vendor ourselves.
 *
 * The key authenticates as the org that created it: api-service validates a
 * `distrib.usr_*` Bearer through key-service and then serves the same routes
 * the dashboard uses, so the holder can read and write everything this UI can.
 * There are no scopes and no expiry yet — revoking is the only limit.
 */
export default function OrgApiKeysPage() {
  const queryClient = useQueryClient();

  const { data: apiKeysData, isPending: apiKeysLoading } = useAuthQuery(
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

  // The static shell (heading, "Create New API Key", "How to use") always
  // paints; only the key list skeletons until its own query settles.
  const keysReady = useCoordinatedReveal([!apiKeysLoading]);

  return (
    <DashboardPage width="wide">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">API Key</h1>
        <p className="text-gray-600">
          Read and manage this organization from your own code.
        </p>
      </div>

      {apiKeyError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {apiKeyError}
        </div>
      )}

      {newKey && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4 max-w-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-medium text-green-800 mb-2">New API key created</h3>
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
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4 max-w-2xl">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-medium text-gray-800">Create a new API key</h3>
              <p className="text-sm text-gray-500">
                Anyone holding it can read and change this organization, so treat
                it like a password.
              </p>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shrink-0"
            >
              {creating ? "Creating..." : "Create key"}
            </button>
          </div>
        </div>

        {!keysReady ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="h-4 w-28 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          </div>
        ) : keys.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-medium text-gray-800 mb-4">Your API keys</h3>
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
        ) : null}

        {/*
          Only instructions that actually work belong here. The key is a Bearer
          token — api-service reads the admin-key header on a separate auth path
          and answers an org key sent that way with a 401.
        */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-medium text-gray-800 mb-4">How to use it</h3>
          <p className="text-sm text-gray-500 mb-3">
            Send the key as a Bearer token. This returns the organization the key
            belongs to.
          </p>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
{`curl https://api.distribute.you/v1/me \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
          </pre>
        </div>
      </div>
    </DashboardPage>
  );
}
