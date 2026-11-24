"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ProviderLogo } from "@/components/provider-logo";
import {
  disconnectInstagramAccount,
  finishInstagramConnect,
  listInstagramAccounts,
  setInstagramAccountType,
  startInstagramConnect,
  type InstagramAccount,
} from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  DEFAULT_INSTAGRAM_ACCOUNT_TYPE,
  INSTAGRAM_ACCOUNT_TYPES,
  INSTAGRAM_RETURN_PARAMS,
  instagramCallbackUrl,
  instagramFinishErrorMessage,
  instagramStartErrorMessage,
  instagramTripKey,
  type InstagramAccountType,
} from "@/lib/instagram-connect";
import { Initials, Shimmer } from "@/components/v2/ui";
import { AccountTypeSelect } from "@/components/v2/account-type-select";

/**
 * Instagram accounts of the brand (REELS-1124), the X card's twin: any member connects any
 * number of professional accounts (Business or Creator), each typed Pro (AI), Pro (human) or
 * Personal (human); software publishes Reels only on Pro (AI). Connect asks the type first, then
 * leaves for the Instagram login; the fixed callback page brings the browser back here with
 * `code` + `state`, and this card finishes the link under the page's own org. No cap.
 */
export function InstagramAccountsCard({ bare = false }: { bare?: boolean }) {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const queryKey = ["instagramAccounts", brandId];

  const accountsQ = useAuthQuery<InstagramAccount[]>(queryKey, () => listInstagramAccounts(brandId), {
    enabled: !!brandId,
    ...pollOptions,
  });
  const reread = () => queryClient.refetchQueries({ queryKey });

  const [picking, setPicking] = useState(false);
  const [pickedType, setPickedType] = useState<InstagramAccountType>(DEFAULT_INSTAGRAM_ACCOUNT_TYPE);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Leaves for the Instagram login in this tab; the trip is remembered under the state.
  const start = useMutation({
    mutationFn: async (accountType: InstagramAccountType) => {
      const trip = await startInstagramConnect({
        brandId,
        accountType,
        redirectUri: instagramCallbackUrl(window.location.origin),
      });
      window.localStorage.setItem(instagramTripKey(trip.state), JSON.stringify({ orgId, returnTo: pathname }));
      window.location.assign(trip.authorizationUrl);
      return trip;
    },
    onError: (err: Error) => {
      console.error("[instagram-accounts] starting the Instagram login failed", err);
      setError(instagramStartErrorMessage(err));
    },
  });

  // Back from Instagram: finish once, then drop the params from the URL.
  const finishing = useRef(false);
  const returnCode = searchParams.get(INSTAGRAM_RETURN_PARAMS.code);
  const returnState = searchParams.get(INSTAGRAM_RETURN_PARAMS.state);
  const returnError = searchParams.get(INSTAGRAM_RETURN_PARAMS.error);
  const finish = useMutation({
    mutationFn: (input: { code: string; state: string }) => finishInstagramConnect(input),
    onSuccess: async (done) => {
      setError(null);
      setNotice(`@${done.account.username} is connected as ${done.account.accountTypeLabel}.`);
      await reread();
    },
    onError: (err: Error) => {
      console.error("[instagram-accounts] finishing the Instagram login failed", err);
      setError(instagramFinishErrorMessage(err));
    },
  });
  useEffect(() => {
    if (finishing.current) return;
    if (returnError) {
      finishing.current = true;
      setError(returnError);
      router.replace(pathname);
      return;
    }
    if (returnCode && returnState) {
      finishing.current = true;
      finish.mutate({ code: returnCode, state: returnState });
      router.replace(pathname);
    }
  }, [returnCode, returnState, returnError, finish, pathname, router]);

  const accounts = accountsQ.data;
  const busy = start.isPending || finish.isPending;

  return (
    <div className={bare ? "p-5" : "k-card p-4"}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="k-inset flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]">
          <ProviderLogo domain="instagram.com" size={20} className="rounded-[4px]" />
        </span>
        <div className="min-w-[200px] flex-1">
          <span className="text-[14px] font-medium leading-5">
            Instagram accounts
            {accounts && accounts.length > 0 ? <span className="k-fg3 ml-1.5 font-normal tabular-nums">{accounts.length}</span> : null}
          </span>
          <p className="k-fg2 mt-0.5 text-[13px] leading-5">Connect the Instagram accounts we post Reels on for you.</p>
        </div>
        {!picking ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setNotice(null);
              setPicking(true);
            }}
            disabled={busy}
            className="k-btn-accent shrink-0"
          >
            {finish.isPending ? "Connecting..." : "Connect an Instagram account"}
          </button>
        ) : null}
      </div>

      {picking ? (
        <div className="k-inset mt-3 rounded-[8px] p-3">
          <p className="k-label">Who runs this account?</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Account type">
            {INSTAGRAM_ACCOUNT_TYPES.map((t) => {
              const on = pickedType === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPickedType(t.value)}
                  className={`k-card ${on ? "k-card-on" : ""} flex h-10 items-center gap-2 px-3 text-left text-[13px] ${on ? "font-medium" : "k-fg2"}`}
                >
                  <span
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ${on ? "bg-[var(--accent)]" : "shadow-[inset_0_0_0_1.5px_var(--line)]"}`}
                  >
                    {on ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                  </span>
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button type="button" onClick={() => setPicking(false)} className="k-btn-ghost" disabled={start.isPending}>
              Cancel
            </button>
            <button type="button" onClick={() => start.mutate(pickedType)} disabled={start.isPending} className="k-btn-accent">
              {start.isPending ? "Opening Instagram..." : "Continue to Instagram"}
            </button>
          </div>
        </div>
      ) : null}

      {notice ? <p className="mt-3 text-[13px] text-[var(--run)]">{notice}</p> : null}
      {error ? <p className="mt-3 text-[13px] text-[var(--data-rose)]">{error}</p> : null}

      <div className="mt-3">
        {accounts === undefined ? (
          accountsQ.isError ? (
            <p className="k-fg2 text-[13px]">We could not read your Instagram accounts just now.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <Shimmer className="h-10 w-full" />
              <Shimmer className="h-10 w-full" />
            </div>
          )
        ) : accounts.length === 0 ? (
          <p className="k-fg3 text-[13px]">No Instagram account yet.</p>
        ) : (
          <ul className="k-line-subtle divide-y divide-[var(--line-subtle)] border-t">
            {accounts.map((a) => (
              <InstagramAccountRow
                key={a.id}
                account={a}
                reconnecting={start.isPending && start.variables === a.accountType}
                onReconnect={() => {
                  setError(null);
                  setNotice(null);
                  start.mutate(a.accountType);
                }}
                onChanged={reread}
                onError={setError}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function InstagramAccountRow({
  account,
  reconnecting,
  onReconnect,
  onChanged,
  onError,
}: {
  account: InstagramAccount;
  reconnecting: boolean;
  onReconnect: () => void;
  onChanged: () => Promise<unknown>;
  onError: (message: string | null) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  // The pressed type shows at once, the served one wins once the re-read lands.
  const [pendingType, setPendingType] = useState<InstagramAccountType | null>(null);
  const needsReconnect = account.health === "needs_reconnect";

  const changeType = useMutation({
    mutationFn: (accountType: InstagramAccountType) => setInstagramAccountType(account.id, accountType),
    onMutate: (accountType) => setPendingType(accountType),
    onSuccess: async () => {
      onError(null);
      await onChanged();
      setPendingType(null);
    },
    onError: (err: Error) => {
      setPendingType(null);
      console.error("[instagram-accounts] changing the account type failed", err);
      onError("We could not change this account's type. Try again.");
    },
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectInstagramAccount(account.id),
    onSuccess: async () => {
      onError(null);
      await onChanged();
      setConfirming(false);
    },
    onError: (err: Error) => {
      console.error("[instagram-accounts] disconnecting failed", err);
      onError("We could not disconnect this account. Try again.");
    },
  });

  const shownName = account.name?.trim() || account.username;

  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5">
      {account.profileImageUrl && !imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={account.profileImageUrl}
          alt=""
          width={36}
          height={36}
          onError={() => setImageFailed(true)}
          className="h-9 w-9 shrink-0 rounded-full object-cover"
        />
      ) : (
        <Initials name={shownName} size={36} round />
      )}
      <div className="min-w-[180px] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[13px] font-medium leading-5">{shownName}</span>
          {needsReconnect ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--data-rose)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--data-rose)]" />
              Needs reconnect
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-2)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--run)]" />
              Connected
            </span>
          )}
        </div>
        <a
          href={account.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="k-fg3 text-[12px] hover:text-[var(--accent)] hover:underline"
        >
          @{account.username}
        </a>
        {needsReconnect && account.healthReason ? <p className="k-fg2 mt-0.5 text-[12px]">{account.healthReason}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <AccountTypeSelect
          id={`instagram-type-${account.id}`}
          label={`Account type of @${account.username}`}
          value={pendingType ?? account.accountType}
          disabled={changeType.isPending}
          onChange={(next) => changeType.mutate(next)}
        />
        {needsReconnect ? (
          <button type="button" onClick={onReconnect} disabled={reconnecting} className="k-btn-accent">
            {reconnecting ? "Opening Instagram..." : "Reconnect"}
          </button>
        ) : null}
        {confirming ? (
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
        )}
      </div>
    </li>
  );
}
