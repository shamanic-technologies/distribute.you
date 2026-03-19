"use client";

import { useState } from "react";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { listApiKeys, createApiKey, deleteApiKey, type ApiKey, type NewApiKey } from "@/lib/api";
import { SkeletonApiKey } from "@/components/skeleton";

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useAuthQuery(["apiKeys"], () => listApiKeys());
  const keys: ApiKey[] = data?.keys ?? [];

  const [newKey, setNewKey] = useState<NewApiKey | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    setNewKey(null);
    try {
      const data = await createApiKey("Dashboard Key");
      setNewKey(data);
      await queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this API key? It will stop working immediately.")) return;
    try {
      await deleteApiKey(id);
      await queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete key");
    }
  }

  function handleCopy(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">API Keys</h1>
        <p className="text-gray-600">Manage API keys for distribute and REST API access.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {newKey && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6">
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

      {isLoading ? (
        <SkeletonApiKey />
      ) : (
        <div className="space-y-6 max-w-2xl">
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

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-medium text-gray-800 mb-4">Your API Keys</h3>

            {keys.length === 0 ? (
              <p className="text-gray-500 text-sm">No API keys yet. Create one to get started.</p>
            ) : (
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
                      onClick={() => handleDelete(key.id)}
                      className="text-red-500 hover:text-red-600 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-medium text-gray-800 mb-4">How to Use</h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-gray-700 mb-2">For MCP (ChatGPT, Claude, Cursor):</p>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
{`{
  "mcpServers": {
    "distribute": {
      "url": "https://mcp.distribute.you/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`}
                </pre>
              </div>
              <div>
                <p className="font-medium text-gray-700 mb-2">For REST API:</p>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
{`curl https://api.distribute.you/v1/me \\
  -H "X-API-Key: YOUR_API_KEY"`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
