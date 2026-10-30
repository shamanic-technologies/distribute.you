"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ProviderLogo } from "@/components/provider-logo";
import {
  disconnectXAccount,
  finishXConnect,
  listXAccounts,
  setXAccountType,
  startXConnect,
  type XAccount,
} from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  DEFAULT_X_ACCOUNT_TYPE,
  X_ACCOUNT_TYPES,
  X_RETURN_PARAMS,
  xCallbackUrl,
  xFinishErrorMessage,
  xStartErrorMessage,
  xTripKey,
  type XAccountType,
} from "@/lib/x-connect";
import { Initials, Shimmer } from "@/components/v2/ui";
import { AccountTypeSelect } from "@/components/v2/account-type-select";

/**
 * X accounts of the brand (X-ACCOUNTS-1030): any member connects any
 * number of them, each typed Pro (AI), Pro (human) or Personal (human). Connect asks
 * the type first, then leaves for the X login; the fixed callback page brings
 * the browser back here with `code` + `state`, and this card finishes the link under
 * the page's own org. No cap on accounts or per type.
 */
export function XAccountsCard({ bare = false }: { bare?: boolean }) {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const queryKey = ["xAccounts", brandId];

  const accountsQ = useAuthQuery<XAccount[]>(queryKey, () => listXAccounts(brandId), {
    enabled: !!brandId,
    ...pollOptions,
  });
  const reread = () => queryClient.refetchQueries({ queryKey });

  const [picking, setPicking] = useState(false);
  const [pickedType, setPickedType] = useState<XAccountType>(DEFAULT_X_ACCOUNT_TYPE);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Leaves for the X login in this tab; the trip is remembered under the state.
  const start = useMutation({
    mutationFn: async (accountType: XAccountType) => {
      const trip = await startXConnect({
        brandId,
        accountType,
        redirectUri: xCallbackUrl(window.location.origin),
      });
      window.localStorage.setItem(xTripKey(trip.state), JSON.stringify({ orgId, returnTo: pathname }));
      window.location.assign(trip.authorizationUrl);
      return trip;
    },
    onError: (err: Error) => {
      console.error("[x-accounts] starting the X login failed", err);
      setError(xStartErrorMessage(err));
    },
  });

  // Back from X: finish once, then drop the params from the URL.
  const finishing = useRef(false);
  const returnCode = searchParams.get(X_RETURN_PARAMS.code);
  const returnState = searchParams.get(X_RETURN_PARAMS.state);
  const returnError = searchParams.get(X_RETURN_PARAMS.error);
  const finish = useMutation({
    mutationFn: (input: { code: string; state: string }) => finishXConnect(input),
    onSuccess: async (done) => {
      setError(null);
      setNotice(`@${done.account.username} is connected as ${done.account.accountTypeLabel}.`);
      await reread();
    },
    onError: (err: Error) => {
      console.error("[x-accounts] finishing the X login failed", err);
      setError(xFinishErrorMessage(err));
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
          <ProviderLogo domain="x.com" size={20} className="rounded-[4px]" />
        </span>
        <div className="min-w-[200px] flex-1">
          <span className="text-[14px] font-medium leading-5">
            X accounts
            {accounts && accounts.length > 0 ? <span className="k-fg3 ml-1.5 font-normal tabular-nums">{accounts.length}</span> : null}
          </span>
          <p className="k-fg2 mt-0.5 text-[13px] leading-5">Connect the X accounts we post on for you.</p>
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
            {finish.isPending ? "Connecting..." : "Connect an X account"}
          </button>
        ) : null}
      </div>

      {picking ? (
        <div className="k-inset mt-3 rounded-[8px] p-3">
          <p className="k-label">Who runs this account?</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Account type">
            {X_ACCOUNT_TYPES.map((t) => {
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
              {start.isPending ? "Opening X..." : "Continue to X"}
            </button>
          </div>
        </div>
      ) : null}

      {notice ? <p className="mt-3 text-[13px] text-[var(--run)]">{notice}</p> : null}
      {error ? <p className="mt-3 text-[13px] text-[var(--data-rose)]">{error}</p> : null}

      <div className="mt-3">
        {accounts === undefined ? (
          accountsQ.isError ? (
            <p className="k-fg2 text-[13px]">We could not read your X accounts just now.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <Shimmer className="h-10 w-full" />
              <Shimmer className="h-10 w-full" />
            </div>
          )
        ) : accounts.length === 0 ? (
          <p className="k-fg3 text-[13px]">No X account yet.</p>
        ) : (
          <ul className="k-line-subtle divide-y divide-[var(--line-subtle)] border-t">
            {accounts.map((a) => (
              <XAccountRow
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

function XAccountRow({
  account,
  reconnecting,
  onReconnect,
  onChanged,
  onError,
}: {
  account: XAccount;
  reconnecting: boolean;
  onReconnect: () => void;
  onChanged: () => Promise<unknown>;
  onError: (message: string | null) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  // The pressed type shows at once, the served one wins once the re-read lands.
  const [pendingType, setPendingType] = useState<XAccountType | null>(null);
  const needsReconnect = account.health === "needs_reconnect";

  const changeType = useMutation({
    mutationFn: (accountType: XAccountType) => setXAccountType(account.id, accountType),
    onMutate: (accountType) => setPendingType(accountType),
    onSuccess: async () => {
      onError(null);
      await onChanged();
      setPendingType(null);
    },
    onError: (err: Error) => {
      setPendingType(null);
      console.error("[x-accounts] changing the account type failed", err);
      onError("We could not change this account's type. Try again.");
    },
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectXAccount(account.id),
    onSuccess: async () => {
      onError(null);
      await onChanged();
      setConfirming(false);
    },
    onError: (err: Error) => {
      console.error("[x-accounts] disconnecting failed", err);
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
          id={`x-type-${account.id}`}
          label={`Account type of @${account.username}`}
          value={pendingType ?? account.accountType}
          disabled={changeType.isPending}
          onChange={(next) => changeType.mutate(next)}
        />
        {needsReconnect ? (
          <button type="button" onClick={onReconnect} disabled={reconnecting} className="k-btn-accent">
            {reconnecting ? "Opening X..." : "Reconnect"}
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
