"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { answerMatrixLink, listMatrixLinks, startMatrixLink, unlinkMatrixLink, type MatrixLink } from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { CompanyLogo } from "@/components/company-logo";
import { linkErrorMessage } from "@/lib/integration-write";
import { accountsOfChannel, startMethods } from "@/lib/messaging-accounts";
import { parsePastedHeaders, sessionValues } from "@/lib/browser-session-paste";

/** While a code is on screen it refreshes on the vendor's schedule, so the read polls fast. */
const WAITING_POLL_MS = 3_000;

const CHANNEL: Record<string, { name: string; domain: string; blurb: string; risk?: string }> = {
  whatsapp: { name: "WhatsApp", domain: "whatsapp.com", blurb: "Read your WhatsApp chats with each person, in their thread." },
  telegram: { name: "Telegram", domain: "telegram.org", blurb: "Read your Telegram chats with each person, in their thread." },
  discord: { name: "Discord", domain: "discord.com", blurb: "Read your Discord messages with each person, in their thread." },
  linkedin: {
    name: "LinkedIn",
    domain: "linkedin.com",
    blurb: "Read your LinkedIn messages with each person, in their thread.",
    risk: "LinkedIn may ask you to confirm it is you, or log you out now and then.",
  },
};

/**
 * Messaging apps, linked by the customer themselves: crm-service creates this
 * brand's own bridge account per linked account and runs the app's login, so the row
 * only shows the QR to scan, the pairing code, or the app's own login form, and polls
 * until the app says linked. A channel holds SEVERAL accounts (a founder's WhatsApp and
 * a sales rep's). Nothing is ever sent on a linked account. A channel whose bridge is
 * not running reads "Not available yet" (crm-service's reason on hover) with no button.
 */
export function MessagingLinkRows({ brandId }: { brandId: string }) {
  const q = useAuthQuery(["matrixLinks", brandId], () => listMatrixLinks(brandId), {
    refetchInterval: (query: { state: { data?: { links: MatrixLink[]; accounts: MatrixLink[] } } }) =>
      query.state.data?.accounts.some((l) => l.status === "waiting") ? WAITING_POLL_MS : false,
  });
  if (q.isError && !q.data) {
    return <p className="p-5 text-sm text-gray-600">We could not read your messaging apps just now. Retrying.</p>;
  }
  if (!q.data) {
    return (
      <div className="p-5">
        <span className="block h-10 w-full animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }
  const data = q.data;
  return (
    <>
      {data.links.map((link) => (
        <ChannelRow key={link.channel} brandId={brandId} link={link} accounts={accountsOfChannel(data, link.channel)} />
      ))}
    </>
  );
}

/** One channel: what it offers, every account on it, and the way to add one more. */
function ChannelRow({ brandId, link, accounts }: { brandId: string; link: MatrixLink; accounts: MatrixLink[] }) {
  const queryClient = useQueryClient();
  const meta = CHANNEL[link.channel] ?? { name: link.channel, domain: `${link.channel}.com`, blurb: "" };
  const [phone, setPhone] = useState("");
  const [usePhone, setUsePhone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reread = () => queryClient.refetchQueries({ queryKey: ["matrixLinks", brandId] });

  const start = useMutation({
    mutationFn: (method: string) =>
      startMatrixLink(brandId, link.channel, method, method === "phone" ? { phoneNumber: phone.trim() } : {}),
    onSuccess: async () => {
      setError(null);
      setUsePhone(false);
      setPhone("");
      await reread();
    },
    onError: (err: Error) => {
      console.error("[integrations] starting the link failed", link.channel, err);
      setError(linkErrorMessage(err));
    },
  });

  const methods = startMethods(link.methods);
  const linkedCount = accounts.filter((a) => a.status === "linked").length;
  // One attempt at a time: the add button waits while a code or a form is on screen.
  const attempting = accounts.some((a) => a.status === "waiting");

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white p-1">
          <CompanyLogo domain={meta.domain} name={meta.name} size={28} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-900">{meta.name}</span>
            <ChannelPill link={link} linkedCount={linkedCount} />
          </div>
          <p className="mt-0.5 text-sm text-gray-500">{meta.blurb}</p>
          {link.available && meta.risk ? <p className="mt-0.5 text-xs text-gray-500">{meta.risk}</p> : null}

          {link.available && usePhone ? (
            <form
              className="mt-3 flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                start.mutate("phone");
              }}
            >
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+33612345678"
                aria-label="Your phone number, in international format"
                className="w-56 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-300/40"
              />
              <button type="submit" disabled={!phone.trim() || start.isPending} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40">
                {start.isPending ? "Asking for a code..." : "Get a code"}
              </button>
            </form>
          ) : null}
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!link.available || attempting ? null : (
            <>
              {methods.includes("phone") ? (
                <button type="button" onClick={() => setUsePhone((v) => !v)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                  {usePhone ? "Use a QR code" : "Use a phone number"}
                </button>
              ) : null}
              {!usePhone && methods[0] && methods[0] !== "phone" ? (
                <button type="button" onClick={() => start.mutate(methods[0])} disabled={start.isPending} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                  {start.isPending ? "Starting..." : linkedCount > 0 ? "Add another account" : "Link"}
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {accounts.length > 0 ? (
        <ul className="mt-3 space-y-3 border-t border-gray-100 pt-3 sm:ml-[52px]">
          {accounts.map((a) => (
            <AccountRow key={a.linkId ?? a.channel} brandId={brandId} link={a} meta={meta} onChanged={reread} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** One account on a channel: its state, the code or form while linking, and its own way out. */
function AccountRow({
  brandId,
  link,
  meta,
  onChanged,
}: {
  brandId: string;
  link: MatrixLink;
  meta: { name: string };
  onChanged: () => Promise<unknown>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [pasted, setPasted] = useState("");
  const linkId = link.linkId ?? null;

  const unlink = useMutation({
    mutationFn: () => unlinkMatrixLink(brandId, link.channel, linkId),
    onSuccess: async () => {
      setConfirming(false);
      setError(null);
      await onChanged();
    },
    onError: (err: Error) => {
      console.error("[integrations] unlinking failed", link.channel, linkId, err);
      setError("Could not unlink. Try again.");
    },
  });

  const relink = useMutation({
    mutationFn: () => startMatrixLink(brandId, link.channel, startMethods(link.methods)[0] ?? "qr", linkId ? { linkId } : {}),
    onSuccess: async () => {
      setError(null);
      await onChanged();
    },
    onError: (err: Error) => {
      console.error("[integrations] relinking failed", link.channel, linkId, err);
      setError(linkErrorMessage(err));
    },
  });

  const answer = useMutation({
    mutationFn: (input: Record<string, string>) => {
      if (!linkId) throw new Error("This link has no id to answer");
      return answerMatrixLink(brandId, link.channel, linkId, input);
    },
    onSuccess: async () => {
      setValues({});
      setPasted("");
      setError(null);
      await onChanged();
    },
    onError: async (err: Error) => {
      console.error("[integrations] answering the login step failed", link.channel, linkId, err);
      setError(linkErrorMessage(err));
      await onChanged();
    },
  });

  const waiting = link.status === "waiting";
  const linked = link.status === "linked";
  const needsRelink = linked && (link.needsRelink === true || (!!link.bridgeState?.state && link.bridgeState.state !== "CONNECTED"));
  const busy = unlink.isPending || relink.isPending || answer.isPending;
  const form = waiting && link.input?.type === "user_input" ? link.input : null;
  // A web page cannot read another site's cookies: the customer copies one request
  // from their logged-in browser and we pick out the values the app's step lists.
  const session = waiting && link.input?.type === "cookies" && link.input.cookies ? link.input.cookies : null;
  const read = session && pasted.trim() ? sessionValues(session.fields, parsePastedHeaders(pasted)) : null;

  return (
    <li>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-900">
              {link.account ? (link.account.name ? `${link.account.name} (${link.account.id})` : link.account.id) : waiting ? "New account" : meta.name}
            </span>
            <AccountPill link={link} needsRelink={needsRelink} />
          </div>
          {needsRelink ? (
            <p className="mt-1 text-sm text-amber-700">{link.bridgeState?.reason ?? `${meta.name} logged us out of this account. Link it again.`}</p>
          ) : null}
          {link.status === "failed" && link.error ? <p className="mt-1 text-sm text-amber-700">{link.error.message}</p> : null}

          {waiting && !form && !session ? (
            <div className="mt-3 flex flex-wrap items-start gap-4">
              {link.qr ? (
                <img src={link.qr.imageDataUrl} alt={`QR code to link ${meta.name}`} width={176} height={176} className="rounded-lg border border-gray-200 bg-white p-2" />
              ) : null}
              {link.pairingCode ? (
                <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-2xl tracking-widest text-gray-900">{link.pairingCode}</p>
              ) : null}
              <p className="max-w-xs text-sm text-gray-600">
                {link.instructions ??
                  (link.qr
                    ? `On your phone, open ${meta.name}, then Linked devices, then Link a device, and scan this code.`
                    : link.pairingCode
                      ? `On your phone, open ${meta.name}, then Linked devices, then Link with phone number, and type this code.`
                      : "Getting a code...")}
              </p>
            </div>
          ) : null}

          {form ? (
            <form
              className="mt-3 max-w-md space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                answer.mutate(values);
              }}
            >
              {form.instructions ? <p className="text-sm text-gray-600">{form.instructions}</p> : null}
              {form.fields.map((f) => (
                <label key={f.id} className="block">
                  <span className="text-sm font-medium text-gray-700">{f.name ?? f.id}</span>
                  {f.options && f.options.length > 0 ? (
                    <select
                      value={values[f.id] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                      className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-300/40"
                    >
                      <option value="" disabled>
                        Choose
                      </option>
                      {f.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type === "password" ? "password" : f.type === "email" ? "email" : "text"}
                      value={values[f.id] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                      autoComplete="off"
                      spellCheck={false}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-300/40"
                    />
                  )}
                  {f.description ? <span className="mt-1 block text-xs text-gray-500">{f.description}</span> : null}
                </label>
              ))}
              <p className="text-xs text-gray-500">We pass this to {meta.name} to log in. We never store it.</p>
              <button
                type="submit"
                disabled={busy || form.fields.some((f) => !(values[f.id] ?? "").trim())}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {answer.isPending ? `Checking with ${meta.name}...` : "Continue"}
              </button>
            </form>
          ) : null}

          {session ? (
            <form
              className="mt-3 max-w-xl space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (read && read.missing.length === 0) answer.mutate(read.values);
              }}
            >
              <p className="text-sm text-gray-600">Log in to {meta.name} in your browser, then copy one of its requests here.</p>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
                <li>
                  <a href={session.url ?? "https://www.linkedin.com/feed/"} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 hover:underline">
                    Open {meta.name}
                  </a>{" "}
                  and log in.
                </li>
                <li>Open the developer tools (F12, or Cmd+Option+I on a Mac) and click Network.</li>
                <li>Type voyager in the filter box, then reload the page.</li>
                <li>Right-click any line, then Copy, then Copy as cURL.</li>
              </ol>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={4}
                placeholder="curl 'https://www.linkedin.com/voyager/api/...' -H ..."
                aria-label={`The ${meta.name} request you copied`}
                autoComplete="off"
                spellCheck={false}
                className="block w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs text-gray-900 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-300/40"
              />
              {read && read.missing.length > 0 ? (
                <p className="text-sm text-amber-700">This copy lacks {read.missing.join(", ")}. Copy a line whose name starts with voyager.</p>
              ) : null}
              <p className="text-xs text-gray-500">This holds your {meta.name} login. We pass it to {meta.name} and never store it.</p>
              <button
                type="submit"
                disabled={busy || !read || read.missing.length > 0}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {answer.isPending ? `Checking with ${meta.name}...` : "Continue"}
              </button>
            </form>
          ) : null}

          {confirming ? (
            <p className="mt-2 text-sm text-gray-600">This logs us out of this {meta.name} account, stops reading it and removes what we mirrored. Nothing on your phone changes.</p>
          ) : null}
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {confirming ? (
            <>
              <button type="button" onClick={() => unlink.mutate()} disabled={busy} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100">
                {unlink.isPending ? "Unlinking..." : "Yes, unlink"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                Keep it
              </button>
            </>
          ) : (
            <>
              {needsRelink || link.status === "failed" ? (
                <button type="button" onClick={() => relink.mutate()} disabled={busy} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                  {relink.isPending ? "Starting..." : needsRelink ? "Link again" : "Try again"}
                </button>
              ) : null}
              <button type="button" onClick={() => setConfirming(true)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                {linked ? "Unlink" : "Cancel"}
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function ChannelPill({ link, linkedCount }: { link: MatrixLink; linkedCount: number }) {
  // crm-service's own sentence says why, on hover; the pill is the short form.
  const cfg = !link.available
    ? { box: "border-gray-200 bg-gray-50 text-gray-600", label: "Not available yet", title: link.unavailableReason ?? undefined }
    : linkedCount > 0
      ? { box: "border-green-200 bg-green-50 text-green-700", label: linkedCount === 1 ? "1 account linked" : `${linkedCount} accounts linked` }
      : { box: "border-gray-200 bg-gray-50 text-gray-600", label: "Not linked" };
  return (
    <span title={"title" in cfg ? cfg.title : undefined} className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.box}`}>
      {cfg.label}
    </span>
  );
}

function AccountPill({ link, needsRelink }: { link: MatrixLink; needsRelink: boolean }) {
  const cfg = needsRelink
    ? { box: "border-amber-200 bg-amber-50 text-amber-700", label: "Needs attention" }
    : link.status === "linked"
      ? { box: "border-green-200 bg-green-50 text-green-700", label: "Linked" }
      : link.status === "waiting"
        ? { box: "border-amber-200 bg-amber-50 text-amber-700", label: link.input ? "Waiting for you" : "Waiting for your phone" }
        : link.status === "failed"
          ? { box: "border-amber-200 bg-amber-50 text-amber-700", label: "Did not link" }
          : { box: "border-gray-200 bg-gray-50 text-gray-600", label: "Not linked" };
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.box}`}>{cfg.label}</span>;
}
