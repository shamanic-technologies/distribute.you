"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { createApiKey, listApiKeys, type ApiKey } from "@/lib/api";
import { AI_RESOURCES, MCP_ENDPOINT_URL, aiSetupPrompt } from "@/lib/ai-integration";
import { v2Href } from "@/lib/v2/routes";
import { Toast } from "@/components/toast";
import { ApiKeyScope } from "@/components/settings/api-key-scope";

/**
 * Integrations → AI: one line to paste into any assistant, and every developer
 * door behind it. The line points the assistant at the agent skill, which
 * carries the per-harness setup, so this page stays one sentence long.
 *
 * A key is shown once, the moment it is issued; that is the only time the line
 * can carry it. The key list and its revocation stay on the API Keys page, one
 * editor for one value.
 */
export function V2AiIntegrationView({ orgId, brandId }: { orgId: string; brandId: string }) {
  const queryClient = useQueryClient();
  const keysQ = useAuthQuery<{ keys: ApiKey[] }>(["apiKeys"], () => listApiKeys());
  const [newKey, setNewKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const prompt = aiSetupPrompt(newKey);
  const keyCount = keysQ.data?.keys.length ?? null;

  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text);
    setToast(what);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2500);
  };

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const made = await createApiKey("AI assistant");
      setNewKey(made.key);
      await queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
    } catch (err) {
      console.error("[integrations-ai] create key failed", err);
      setError("We could not create a key right now. Try again in a moment.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="k-card p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="k-label">Paste this into your AI</p>
          <span className="k-fg3 text-[12px]">Claude Code, Cursor, Codex, OpenClaw, Conductor…</span>
        </div>
        <div className="mt-2 flex items-start gap-2">
          <textarea
            readOnly
            value={prompt}
            aria-label="Setup line for your AI"
            rows={3}
            // k-input pins a 28px control height; this field holds a sentence.
            style={{ height: "auto" }}
            className="k-input k-mono min-w-0 flex-1 resize-none px-2 py-1.5 text-[12px] leading-[18px]"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button type="button" onClick={() => copy(prompt, "Copied. Paste it into your AI")} className="k-btn-strong shrink-0">
            Copy
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px]">
          {newKey ? (
            <span className="k-fg2">The line carries your new key. It is shown only now, so copy it before leaving the page.</span>
          ) : (
            <>
              <button type="button" onClick={create} disabled={creating} className="k-btn">
                {creating ? "Creating key…" : "Put a new key in the line"}
              </button>
              <span className="k-fg3">Or copy it as is: your AI will ask for a key you already have.</span>
            </>
          )}
        </div>
        <p className="k-fg2 mt-2 text-[12px]">
          <ApiKeyScope />
        </p>
        {error && <p className="mt-2 text-[12px] text-[var(--data-rose)]">{error}</p>}
      </div>

      <div className="k-card p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="k-label">MCP server</p>
          <Link href={v2Href(orgId, brandId, "api-keys")} className="k-btn shrink-0">
            Manage API keys
            {keyCount !== null && <span className="k-fg3 tabular-nums">{keyCount}</span>}
          </Link>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input readOnly value={MCP_ENDPOINT_URL} aria-label="MCP server URL" className="k-input k-mono min-w-0 flex-1 px-2 text-[12px]" onFocus={(e) => e.currentTarget.select()} />
          <button type="button" onClick={() => copy(MCP_ENDPOINT_URL, "MCP URL copied")} className="k-btn shrink-0">
            Copy
          </button>
        </div>
        <p className="k-fg3 mt-2 text-[12px]">
          Streamable HTTP, with your key as a Bearer token. Browser apps that only take OAuth connectors (claude.ai, ChatGPT) cannot add it yet; the skill has them use the API instead.
        </p>
      </div>

      <div className="k-card overflow-hidden">
        <p className="k-label px-4 pb-2 pt-4">Docs and skills</p>
        <ul>
          {AI_RESOURCES.map((r) => (
            <li key={r.href} className="k-line-subtle border-t">
              <a href={r.href} target="_blank" rel="noopener noreferrer" className="k-row flex items-baseline justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="text-[13px]">{r.label}</span>
                  <span className="k-fg3 ml-2 text-[12px]">{r.note}</span>
                </span>
                <span className="k-fg3 shrink-0 text-[12px]">↗</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      {toast && <Toast message={toast} />}
    </div>
  );
}
