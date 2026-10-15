"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ProviderLogo } from "@/components/provider-logo";
import {
  createOwnerTelegramLinkCode,
  getBillingAccount,
  getOwnerTelegram,
  unlinkOwnerTelegram,
  type BillingAccount,
  type OwnerTelegramLinkCode,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { Shimmer, StateDot } from "@/components/v2/ui";

/** While the customer is in Telegram the status read polls fast, so Connected shows on return. */
const WAITING_POLL_MS = 3_000;

/**
 * Telegram updates for the org: one short message to the owner's chat when one of our
 * workflows acts for them (a post published). Every member can connect it themselves:
 * the button opens the platform bot with a one-time code, the bot hands the code to
 * client-service, and this card turns Connected on its next read. Own org only.
 */
export function TelegramUpdatesCard() {
  const queryClient = useQueryClient();
  const { data: account } = useAuthQuery<BillingAccount>(["billingAccount"], () => getBillingAccount());
  const orgId = account?.org_id ?? null;
  const [pendingLink, setPendingLink] = useState<OwnerTelegramLinkCode | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusQ = useAuthQuery(["ownerTelegram", orgId ?? "none"], () => getOwnerTelegram(orgId!), {
    enabled: !!orgId,
    refetchInterval: (query: { state: { data?: { reachable: boolean } } }) =>
      pendingLink && !query.state.data?.reachable && new Date(pendingLink.expiresAt).getTime() > Date.now() ? WAITING_POLL_MS : false,
  });
  const reread = () => queryClient.refetchQueries({ queryKey: ["ownerTelegram", orgId ?? "none"] });

  const connect = useMutation({
    // The tab opens inside the click (a popup blocker lets it), then goes to the bot once the code is back.
    mutationFn: async (tab: Window | null) => {
      const link = await createOwnerTelegramLinkCode(orgId!);
      if (tab) tab.location.href = link.linkUrl;
      return link;
    },
    onSuccess: (link) => {
      setError(null);
      setPendingLink(link);
    },
    onError: (err: Error, tab) => {
      tab?.close();
      console.error("[telegram-updates] creating the link failed", err);
      setError("We could not open Telegram just now. Try again.");
    },
  });

  const disconnect = useMutation({
    mutationFn: () => unlinkOwnerTelegram(orgId!),
    onSuccess: async () => {
      setConfirming(false);
      setPendingLink(null);
      setError(null);
      await reread();
    },
    onError: (err: Error) => {
      console.error("[telegram-updates] disconnecting failed", err);
      setError("We could not disconnect Telegram. Try again.");
    },
  });

  const status = statusQ.data;
  const connected = status?.reachable === true;
  const waiting = !connected && pendingLink !== null;

  return (
    <div className="k-card p-4">
      <div className="flex flex-wrap items-start gap-3">
        <span className="k-inset flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]">
          <ProviderLogo domain="telegram.org" size={20} className="rounded-[4px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-medium leading-5">Telegram updates</span>
            {status ? <StateDot running={connected} label={connected ? "Connected" : "Not connected"} /> : null}
          </div>
          <p className="k-fg2 mt-0.5 text-[13px] leading-5">Get a short message on Telegram when we post for you.</p>
          {waiting && pendingLink ? (
            <p className="k-fg2 mt-2 text-[13px] leading-5">
              In Telegram, tap Start.{" "}
              <a href={pendingLink.linkUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                Open Telegram again
              </a>
            </p>
          ) : null}
          {connected && status?.linkedAt ? (
            <p className="k-fg3 mt-1 text-[12px]">Since {new Date(status.linkedAt).toLocaleDateString()}</p>
          ) : null}
          {confirming ? <p className="k-fg2 mt-2 text-[13px]">You will stop getting these messages. You can connect again anytime.</p> : null}
          {statusQ.isError && !status ? <p className="k-fg2 mt-2 text-[13px]">We could not read your Telegram status just now.</p> : null}
          {error ? <p className="mt-2 text-[13px] text-[var(--data-rose)]">{error}</p> : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!status ? (
            statusQ.isError ? null : <Shimmer className="h-7 w-32" />
          ) : connected ? (
            confirming ? (
              <>
                <button type="button" onClick={() => disconnect.mutate()} disabled={disconnect.isPending} className="k-btn-strong">
                  {disconnect.isPending ? "Disconnecting..." : "Yes, disconnect"}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="k-btn-ghost">
                  Keep it
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="k-btn">
                Disconnect
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => connect.mutate(window.open("about:blank", "_blank"))}
              disabled={connect.isPending}
              className="k-btn-accent"
            >
              {connect.isPending ? "Opening Telegram..." : waiting ? "Get a new link" : "Connect Telegram"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
