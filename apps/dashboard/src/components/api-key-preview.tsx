"use client";

import { useState } from "react";
import Link from "next/link";
import { listApiKeys, createApiKey, type NewApiKey } from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";

export function ApiKeyPreview() {
  const queryClient = useQueryClient();
  const [newKey, setNewKey] = useState<NewApiKey | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useAuthQuery(["apiKeys"], () =>
    listApiKeys()
  );
  const keys = data?.keys ?? [];

  async function handleCreate() {
    setCreating(true);
    try {
      const data = await createApiKey("Dashboard Key");
      setNewKey(data);
      queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
    } catch (err) {
      console.error("Failed to create key:", err);
    } finally {
      setCreating(false);
    }
  }

  function handleCopy(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading && !data) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-24 mb-3"></div>
        <div className="h-10 bg-gray-100 rounded"></div>
      </div>
    );
  }

  // Show newly created key
  if (newKey) {
    return (
      <div className="bg-green-50 rounded-2xl border border-green-200 p-6">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="font-display font-bold text-green-800">API Key Created</h3>
        </div>
        <p className="text-sm text-green-700 mb-3">Copy now - won&apos;t be shown again!</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-white px-3 py-2 rounded-lg text-sm font-mono text-gray-800 border border-green-200 truncate">
            {newKey.key}
          </code>
          <button
            onClick={() => handleCopy(newKey.key)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium whitespace-nowrap"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    );
  }

  // No keys - show create button
  if (keys.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <h3 className="font-display font-bold text-gray-800">API Key</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">Create an API key to use distribute.</p>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium"
        >
          {creating ? "Creating..." : "Create API Key"}
        </button>
      </div>
    );
  }

  // Show first key with masked display
  const firstKey = keys[0];
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <h3 className="font-display font-bold text-gray-800">Your API Key</h3>
        </div>
        <Link href="/api-keys" className="text-sm text-brand-600 hover:text-brand-700">
          Manage →
        </Link>
      </div>
      <div className="bg-gray-50 px-3 py-2 rounded-lg">
        <code className="font-mono text-sm text-gray-700">
          {firstKey.keyPrefix}••••••••••••••••
        </code>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Created {new Date(firstKey.createdAt).toLocaleDateString()}
        {firstKey.lastUsedAt && <> · Last used {new Date(firstKey.lastUsedAt).toLocaleDateString()}</>}
      </p>
    </div>
  );
}
