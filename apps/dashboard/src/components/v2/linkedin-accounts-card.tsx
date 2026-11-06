"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ProviderLogo } from "@/components/provider-logo";
import {
  disconnectLinkedinAccount,
  finishLinkedinConnect,
  listLinkedinAccounts,
  startLinkedinConnect,
  updateLinkedinAccount,
  type LinkedinAccount,
} from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { formatCount } from "@/lib/format-number";
import { friendlyDate, timeAgo } from "@/lib/friendly-datetime";
import {
  DEFAULT_LINKEDIN_ACCOUNT_TYPE,
  LINKEDIN_ACCOUNT_TYPES,
  LINKEDIN_RETURN_PARAMS,
  isLinkedinNotConfigured,
  linkedinCallbackUrl,
  linkedinFinishErrorMessage,
  linkedinStartErrorMessage,
  linkedinTripKey,
  looksLikeLinkedinPage,
  type LinkedinAccountType,
} from "@/lib/linkedin-connect";
import { Initials, Shimmer } from "@/components/v2/ui";
import { AccountTypeSelect } from "@/components/v2/account-type-select";

/**
 * LinkedIn accounts of the brand (LINKEDIN-ACCOUNTS-1106), the X card's model (`x-accounts-card.tsx`): connect asks
 * the type and the profile or company page whose posts we bring in (LinkedIn's login never names it), then leaves
 * for the LinkedIn login; the fixed callback page brings the browser back here with `code` + `state`, and this card
 * finishes the link under the page's own org. Each row shows its health (Reconnect when the login died or is about
 * to end) and where its post history import stands, both served by social-service.
 */
export function LinkedinAccountsCard({ bare = false }: { bare?: boolean }) {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const queryKey = ["linkedinAccounts", brandId];

  const accountsQ = useAuthQuery<LinkedinAccount[]>(queryKey, () => listLinkedinAccounts(brandId), { enabled: !!brandId, ...pollOptions });
  const reread = () => queryClient.refetchQueries({ queryKey });

  const [picking, setPicking] = useState(false);
  const [pickedType, setPickedType] = useState<LinkedinAccountType>(DEFAULT_LINKEDIN_ACCOUNT_TYPE);
  const [pageUrl, setPageUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Our LinkedIn app is not set up yet (social-service's named 502): said plainly, the button waits.
  const [notConfigured, setNotConfigured] = useState(false);

  const start = useMutation({
    mutationFn: async (input: { accountType: LinkedinAccountType; profileUrl: string }) => {
      const trip = await startLinkedinConnect({ brandId, ...input, redirectUri: linkedinCallbackUrl(window.location.origin) });
      window.localStorage.setItem(linkedinTripKey(trip.state), JSON.stringify({ orgId, returnTo: pathname }));
      window.location.assign(trip.authorizationUrl);
      return trip;
    },
    onError: (err: Error) => {
      console.error("[linkedin-accounts] starting the LinkedIn login failed", err);
      if (isLinkedinNotConfigured(err)) setNotConfigured(true);
      setError(linkedinStartErrorMessage(err));
    },
  });

  // Back from LinkedIn: finish once, then drop the params from the URL.
  const finishing = useRef(false);
  const returnCode = searchParams.get(LINKEDIN_RETURN_PARAMS.code);
  const returnState = searchParams.get(LINKEDIN_RETURN_PARAMS.state);
  const returnError = searchParams.get(LINKEDIN_RETURN_PARAMS.error);
  const finish = useMutation({
    mutationFn: (input: { code: string; state: string }) => finishLinkedinConnect(input),
    onSuccess: async (done) => {
      setError(null);
      setNotice(`${done.account.name?.trim() || "Your LinkedIn account"} is connected. We are bringing in its posts.`);
      await reread();
    },
    onError: (err: Error) => {
      console.error("[linkedin-accounts] finishing the LinkedIn login failed", err);
      if (isLinkedinNotConfigured(err)) setNotConfigured(true);
      setError(linkedinFinishErrorMessage(err));
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
  const pageOk = looksLikeLinkedinPage(pageUrl);

  return (
    <div className={bare ? "p-5" : "k-card p-4"}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="k-inset flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]">
          <ProviderLogo domain="linkedin.com" size={20} className="rounded-[4px]" />
        </span>
        <div className="min-w-[200px] flex-1">
          <span className="text-[14px] font-medium leading-5">
            LinkedIn accounts
            {accounts && accounts.length > 0 ? <span className="k-fg3 ml-1.5 font-normal tabular-nums">{accounts.length}</span> : null}
          </span>
          <p className="k-fg2 mt-0.5 text-[13px] leading-5">See every LinkedIn post, its views and the signups it brings.</p>
        </div>
        {!picking ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setNotice(null);
              setPicking(true);
            }}
            disabled={busy || notConfigured}
            className="k-btn-accent shrink-0"
          >
            {finish.isPending ? "Connecting..." : "Connect a LinkedIn account"}
          </button>
        ) : null}
      </div>

      {picking ? (
        <div className="k-inset mt-3 rounded-[8px] p-3">
          <label htmlFor="linkedin-page-url" className="k-label">
            Your profile or company page
          </label>
          <input
            id="linkedin-page-url"
            type="url"
            inputMode="url"
            value={pageUrl}
            onChange={(e) => setPageUrl(e.target.value)}
            placeholder="https://www.linkedin.com/in/your-name"
            className="k-input mt-2 w-full"
            autoFocus
          />
          <p className="k-label mt-3">Who runs this account?</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Account type">
            {LINKEDIN_ACCOUNT_TYPES.map((t) => {
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
                  <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ${on ? "bg-[var(--accent)]" : "shadow-[inset_0_0_0_1.5px_var(--line)]"}`}>
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
            <button
              type="button"
              onClick={() => start.mutate({ accountType: pickedType, profileUrl: pageUrl.trim() })}
              disabled={start.isPending || !pageOk || notConfigured}
              className="k-btn-accent"
            >
              {start.isPending ? "Opening LinkedIn..." : "Continue to LinkedIn"}
            </button>
          </div>
        </div>
      ) : null}

      {notConfigured ? <p className="k-fg2 mt-3 text-[13px]">LinkedIn is not set up on our side yet. You can connect it as soon as it is.</p> : null}
      {notice ? <p className="mt-3 text-[13px] text-[var(--run)]">{notice}</p> : null}
      {error && !notConfigured ? <p className="mt-3 text-[13px] text-[var(--data-rose)]">{error}</p> : null}

      <div className="mt-3">
        {accounts === undefined ? (
          accountsQ.isError ? (
            <p className="k-fg2 text-[13px]">We could not read your LinkedIn accounts just now.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <Shimmer className="h-10 w-full" />
            </div>
          )
        ) : accounts.length === 0 ? (
          <p className="k-fg3 text-[13px]">No LinkedIn account yet.</p>
        ) : (
          <ul className="k-line-subtle divide-y divide-[var(--line-subtle)] border-t">
            {accounts.map((a) => (
              <LinkedinAccountRow
                key={a.id}
                account={a}
                reconnecting={start.isPending && start.variables?.profileUrl === a.profileUrl}
                onReconnect={() => {
                  setError(null);
                  setNotice(null);
                  start.mutate({ accountType: a.accountType, profileUrl: a.profileUrl });
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

/** Where the post history import stands, in one line (served counts). */
function importLine(a: LinkedinAccount): string {
  const imp = a.import;
  if (!imp) return "Bringing in its posts soon.";
  const posts = `${formatCount(imp.postsImported)} post${imp.postsImported === 1 ? "" : "s"}`;
  if (imp.historyComplete) return `${posts} brought in${imp.lastReadAt ? `, last read ${timeAgo(imp.lastReadAt)}` : ""}.`;
  return `${posts} brought in so far. Reading older posts.`;
}

function LinkedinAccountRow({
  account,
  reconnecting,
  onReconnect,
  onChanged,
  onError,
}: {
  account: LinkedinAccount;
  reconnecting: boolean;
  onReconnect: () => void;
  onChanged: () => Promise<unknown>;
  onError: (message: string | null) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [pendingType, setPendingType] = useState<LinkedinAccountType | null>(null);
  const needsReconnect = account.health === "needs_reconnect";

  const changeType = useMutation({
    mutationFn: (accountType: LinkedinAccountType) => updateLinkedinAccount(account.id, { accountType }),
    onMutate: (accountType) => setPendingType(accountType),
    onSuccess: async () => {
      onError(null);
      await onChanged();
      setPendingType(null);
    },
    onError: (err: Error) => {
      setPendingType(null);
      console.error("[linkedin-accounts] changing the account type failed", err);
      onError("We could not change this account's type. Try again.");
    },
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectLinkedinAccount(account.id),
    onSuccess: async () => {
      onError(null);
      await onChanged();
      setConfirming(false);
    },
    onError: (err: Error) => {
      console.error("[linkedin-accounts] disconnecting failed", err);
      onError("We could not disconnect this account. Try again.");
    },
  });

  const shownName = account.name?.trim() || account.profileUrl.replace(/^https?:\/\/(www\.)?/, "");

  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5">
      {account.pictureUrl && !imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={account.pictureUrl} alt="" width={36} height={36} onError={() => setImageFailed(true)} className="h-9 w-9 shrink-0 rounded-full object-cover" />
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
        <a href={account.profileUrl} target="_blank" rel="noopener noreferrer" className="k-fg3 text-[12px] hover:text-[var(--accent)] hover:underline">
          {account.pageKind === "company" ? "Company page" : "Profile"}
        </a>
        <p className="k-fg2 mt-0.5 text-[12px]">{importLine(account)}</p>
        {needsReconnect && account.healthReason ? <p className="k-fg2 mt-0.5 text-[12px]">{account.healthReason}</p> : null}
        {!needsReconnect && account.reconnectBy ? <p className="k-fg3 mt-0.5 text-[12px]">Reconnect by {friendlyDate(account.reconnectBy)}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <AccountTypeSelect
          id={`linkedin-type-${account.id}`}
          label={`Account type of ${shownName}`}
          value={pendingType ?? account.accountType}
          disabled={changeType.isPending}
          onChange={(next) => changeType.mutate(next)}
        />
        <button type="button" onClick={onReconnect} disabled={reconnecting} className={needsReconnect ? "k-btn-accent" : "k-btn"}>
          {reconnecting ? "Opening LinkedIn..." : "Reconnect"}
        </button>
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
