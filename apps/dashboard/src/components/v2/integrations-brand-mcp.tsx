"use client";

import { useEffect, useRef, useState } from "react";
import { PlugsConnectedIcon } from "@phosphor-icons/react/dist/csr/PlugsConnected";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import {
  ApiError,
  addBrandMcpServer,
  checkBrandMcpServer,
  listBrandMcpServers,
  removeBrandMcpServer,
} from "@/lib/api";
import { isConnected, serverStateLine, type BrandMcpServer } from "@/lib/v2/brand-mcp-servers";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { Toast } from "@/components/toast";

const TERMS_URL = "https://distribute.you/terms#brand-mcp-servers";

/** Our own copy per refusal; never the producer's body (dashboard rule). */
function addErrorCopy(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return "This server is already connected to this brand.";
    if (err.status === 400) return "Use a public https address, for example https://mcp.example.com/mcp. A brand holds up to 10 servers.";
  }
  return "Unable to add the server. Try again in a moment.";
}

/**
 * Integrations > Accounts and AI > Tools for our AI (BRAND-MCP-1109, public beta).
 * A brand plugs the MCP servers our conversation AI may use when it writes to its leads
 * and clients; the AI reads and acts through them in every campaign. One row per server:
 * its mark, name, address, the producer's connect state, then Check again / Remove.
 */
export function BrandMcpServersView({ brandId }: { brandId: string }) {
  const queryClient = useQueryClient();
  const key = ["brandMcpServers", brandId];
  const q = useAuthQuery<BrandMcpServer[]>(key, () => listBrandMcpServers(brandId), pollOptions);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const say = (msg: string) => {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2500);
  };
  const reread = () => queryClient.refetchQueries({ queryKey: key });

  const servers = q.data ?? [];
  const answered = q.data !== undefined || q.isError;

  return (
    <div className="k-card overflow-hidden">
      {!answered ? (
        <div className="space-y-2 p-4">
          <Shimmer className="h-10" />
          <Shimmer className="h-10" />
        </div>
      ) : q.isError && q.data === undefined ? (
        <EmptyNote>Unable to load this brand&apos;s servers. Reload the page to try again.</EmptyNote>
      ) : servers.length === 0 && !adding ? (
        <EmptyNote>No server yet. Add one so our AI can check what each person already has with you.</EmptyNote>
      ) : (
        <ul>
          {servers.map((s) => (
            <ServerRow key={s.id} brandId={brandId} server={s} onChanged={reread} say={say} />
          ))}
        </ul>
      )}
      <div className="k-line-subtle border-t px-4 py-3">
        {adding ? (
          <AddServerForm
            brandId={brandId}
            onDone={async (s) => {
              queryClient.setQueryData<BrandMcpServer[]>(key, (prev) => [...(prev ?? []), s]);
              await reread();
              setAdding(false);
              say(isConnected(s) ? `${s.name} connected` : `${s.name} added, not connected yet`);
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" className="k-btn" onClick={() => setAdding(true)}>
              Add an MCP server
            </button>
            <a href={TERMS_URL} target="_blank" rel="noreferrer" className="k-fg3 text-[12px] hover:text-[var(--fg-1)]">
              Our AI can read and write on these servers. Read the terms
            </a>
          </div>
        )}
      </div>
      {toast && <Toast message={toast} />}
    </div>
  );
}

function ServerRow({
  brandId,
  server,
  onChanged,
  say,
}: {
  brandId: string;
  server: BrandMcpServer;
  onChanged: () => Promise<unknown>;
  say: (m: string) => void;
}) {
  const [busy, setBusy] = useState<"check" | "remove" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const ok = isConnected(server);

  const check = async () => {
    setBusy("check");
    setFailed(null);
    try {
      const s = await checkBrandMcpServer(brandId, server.id);
      await onChanged();
      say(isConnected(s) ? `${s.name} connected` : `${s.name} is still not connected`);
    } catch (err) {
      console.error("[brand-mcp] check failed", err);
      setFailed("Unable to check the server. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("remove");
    setFailed(null);
    try {
      await removeBrandMcpServer(brandId, server.id);
      await onChanged();
      say(`${server.name} removed`);
    } catch (err) {
      console.error("[brand-mcp] remove failed", err);
      setFailed("Unable to remove the server. Try again in a moment.");
      setBusy(null);
      setConfirming(false);
    }
  };

  return (
    <li className="k-line-subtle flex items-start gap-3 border-b px-4 py-3 last:border-b-0">
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: "color-mix(in oklch, var(--data-teal) 16%, transparent)", color: "var(--data-teal)" }}
      >
        <PlugsConnectedIcon size={20} weight="duotone" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium leading-5">{server.name}</p>
        <p className="k-fg3 k-mono truncate text-[12px] leading-5" title={server.url}>{server.url}</p>
        <p className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-2)]">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: ok ? "var(--run)" : "var(--data-rose)" }}
          />
          <span title={ok ? server.toolNames.join(", ") : undefined}>{serverStateLine(server)}</span>
        </p>
        {failed && <p className="mt-1 text-[12px] text-[var(--data-rose)]">{failed}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {confirming ? (
          <>
            <button type="button" className="k-btn" disabled={busy !== null} onClick={remove}>
              {busy === "remove" ? "Removing…" : "Remove server"}
            </button>
            <button type="button" className="k-btn-ghost" disabled={busy !== null} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" className="k-btn-ghost" disabled={busy !== null} onClick={check}>
              {busy === "check" ? "Checking…" : "Check again"}
            </button>
            <button type="button" className="k-btn-ghost" disabled={busy !== null} onClick={() => setConfirming(true)}>
              Remove
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function AddServerForm({
  brandId,
  onDone,
  onCancel,
}: {
  brandId: string;
  onDone: (s: BrandMcpServer) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [authorization, setAuthorization] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = name.trim().length > 0 && url.trim().length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      const s = await addBrandMcpServer(brandId, {
        name: name.trim(),
        url: url.trim(),
        ...(authorization.trim() ? { authorization: authorization.trim() } : {}),
      });
      await onDone(s);
    } catch (err) {
      console.error("[brand-mcp] add failed", err);
      setError(addErrorCopy(err));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <label className="block">
          <span className="k-label">Name</span>
          <input className="k-input mt-1 w-full px-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Our CRM" maxLength={80} autoFocus />
        </label>
        <label className="block">
          <span className="k-label">Server URL</span>
          <input className="k-input k-mono mt-1 w-full px-2 text-[12px]" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com/mcp" inputMode="url" />
        </label>
      </div>
      <label className="block">
        <span className="k-label">Authorization header (optional)</span>
        <input
          type="password"
          autoComplete="off"
          className="k-input k-mono mt-1 w-full px-2 text-[12px]"
          value={authorization}
          onChange={(e) => setAuthorization(e.target.value)}
          placeholder="Bearer sk_live_…"
        />
        <span className="k-fg3 mt-1 block text-[12px]">Stored encrypted. Shown to no one, us included.</span>
      </label>
      {error && <p className="text-[12px] text-[var(--data-rose)]">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" className="k-btn-strong" disabled={!ready || saving}>
          {saving ? "Connecting…" : "Connect server"}
        </button>
        <button type="button" className="k-btn-ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
