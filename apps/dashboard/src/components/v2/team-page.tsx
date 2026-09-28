"use client";

import { useOrganization, useSession } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { OrgAvatar } from "@/components/org-avatar";
import { dashboardOrigin, isInvitableEmail, joinLinkUrl, sanitizeInviteBrand } from "@/lib/org-invite";
import { resolveBrandTint } from "@/lib/brand-tint";
import { useTenantSwitcher } from "@/lib/use-tenant-switcher";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { V2Page } from "@/components/v2/setup-pages";

/**
 * Team: Explee's Team page (the first item of its user menu), with our data. The
 * organization and its members are Clerk's own. An admin can invite a teammate by
 * email (Clerk mails the link, `/invite` turns it into an account inside this org)
 * and revoke an invitation still pending. Deleting the organization is not offered.
 *
 * Staff are hidden: god-mode makes every staff account a real member of every org it
 * opens, so listing them would show the customer people who are not on their team.
 */

const ROLE_LABEL: Record<string, string> = { "org:admin": "Admin", "org:member": "Member" };

export function V2TeamPage() {
  const { organization, isLoaded, memberships, invitations, membership } = useOrganization({
    memberships: { pageSize: 50, keepPreviousData: true },
    invitations: { pageSize: 50, keepPreviousData: true, status: ["pending"] },
  });
  const isAdmin = membership?.role === "org:admin";
  const all = memberships?.data ?? [];
  const rows = all.filter((m) => !isAdminEmail(m.publicUserData?.identifier));
  const total = (memberships?.count ?? all.length) - (all.length - rows.length);
  const pending = !isLoaded || (memberships?.isLoading ?? true);
  return (
    <V2Page crumbs={[{ label: "Account" }, { label: "Team" }]} title={organization?.name ?? "Team"} sub="Everyone who can open this organization." width="max-w-[760px]">
      {organization && (
        <div className="k-card mb-4 flex items-center gap-3 p-4">
          <OrgAvatar name={organization.name} imageUrl={organization.imageUrl} hasImage={organization.hasImage} sizeClass="w-8 h-8" />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium">{organization.name}</p>
            <p className="k-fg3 text-[12px]">Created {new Date(organization.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
          </div>
        </div>
      )}
      {isAdmin && <InviteLinkCard />}
      {isAdmin && <InviteCard onInvited={() => invitations?.revalidate?.()} />}
      <div className="k-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[var(--line-subtle)] px-4 py-3">
          <p className="text-[13px] font-medium">Members</p>
          {!pending && <span className="k-chip tabular-nums">{total}</span>}
        </div>
        <table className="w-full table-fixed text-[13px]">
          <thead>
            <tr className="k-fg3 border-b border-[var(--line-subtle)] text-left text-[12px]">
              <th className="px-4 py-2 font-normal">Member</th>
              <th className="w-[96px] px-4 py-2 font-normal">Role</th>
              <th className="hidden w-[120px] px-4 py-2 font-normal sm:table-cell">Joined</th>
            </tr>
          </thead>
          <tbody>
            {pending
              ? [0, 1].map((i) => (
                  <tr key={i} className="k-row">
                    <td className="px-4 py-3" colSpan={3}>
                      <div className="h-4 w-48 animate-pulse rounded bg-[var(--bg-inset)]" />
                    </td>
                  </tr>
                ))
              : rows.map((m) => {
                  const u = m.publicUserData;
                  const name = [u?.firstName, u?.lastName].filter(Boolean).join(" ");
                  const email = u?.identifier ?? "";
                  return (
                    <tr key={m.id} className="k-row">
                      <td className="px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          {u?.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.imageUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                          ) : (
                            <span className="h-7 w-7 shrink-0 rounded-full bg-[var(--bg-selected)]" />
                          )}
                          <span className="min-w-0 leading-4">
                            <span className="block truncate font-medium">{name || email}</span>
                            {name && <span className="k-fg3 block truncate text-[12px]">{email}</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">{ROLE_LABEL[m.role] ?? m.role}</td>
                      <td className="k-fg3 hidden px-4 py-2.5 sm:table-cell">
                        {new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
      {isAdmin && (invitations?.data?.length ?? 0) > 0 && (
        <div className="k-card mt-4 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[var(--line-subtle)] px-4 py-3">
            <p className="text-[13px] font-medium">Pending invitations</p>
            <span className="k-chip tabular-nums">{invitations?.count ?? 0}</span>
          </div>
          <table className="w-full table-fixed text-[13px]">
            <tbody>
              {(invitations?.data ?? []).map((inv) => (
                <PendingInvitationRow
                  key={inv.id}
                  email={inv.emailAddress}
                  role={inv.role}
                  sentAt={inv.createdAt}
                  onRevoke={async () => {
                    await inv.revoke();
                    await invitations?.revalidate?.();
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </V2Page>
  );
}

/**
 * Invite by email. The org the invitation goes to is the one in the URL, and the
 * request carries a token Clerk minted FOR that org, so the route's `auth().orgId`
 * is the org on screen whatever another tab has made active.
 */
function InviteCard({ onInvited }: { onInvited: () => void }) {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? null;
  const { session } = useSession();
  // The brand on screen travels with the invitation, so the invitee is greeted with
  // it (name, logo, colours) before they have an account to read it with.
  const { displayBrand } = useTenantSwitcher();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  const valid = isInvitableEmail(email);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || sending || !orgId || !session) return;
    setSending(true);
    setError("");
    setSent("");
    try {
      const token = await session.getToken({ organizationId: orgId });
      const res = await fetch("/api/orgs/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          orgId,
          emailAddress: email,
          brand: displayBrand?.name
            ? {
                name: displayBrand.name,
                domain: displayBrand.domain,
                logoUrl: displayBrand.logoUrl ?? null,
                tint: resolveBrandTint(displayBrand.colors),
              }
            : null,
        }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string; emailAddress?: string } | null;
      if (!res.ok) {
        console.error("[team] invite failed", res.status, body);
        setError(body?.error ?? "Could not send the invitation. Try again.");
        return;
      }
      setSent(`Invitation sent to ${body?.emailAddress ?? email}.`);
      setEmail("");
      onInvited();
    } catch (err) {
      console.error("[team] invite failed", err);
      setError("Could not send the invitation. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="k-card mb-4 p-4">
      <p className="text-[13px] font-medium">Invite a teammate</p>
      <p className="k-fg3 mt-0.5 text-[12px]">They get an email with a link to join this organization as an admin.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setSent("");
            setError("");
          }}
          placeholder="name@company.com"
          aria-label="Email address"
          className="k-input min-w-0 flex-1 px-2.5"
        />
        <button
          type="submit"
          disabled={!valid || sending}
          aria-busy={sending}
          className={`k-btn-accent justify-center ${sending ? "cursor-wait" : !valid ? "cursor-not-allowed opacity-50" : ""}`}
        >
          {sending ? "Sending..." : "Send invite"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[12px] text-red-600">
          {error}
        </p>
      )}
      {sent && (
        <p role="status" className="mt-2 text-[12px] text-green-700">
          {sent}
        </p>
      )}
    </form>
  );
}

function PendingInvitationRow({
  email,
  role,
  sentAt,
  onRevoke,
}: {
  email: string;
  role: string;
  sentAt: Date;
  onRevoke: () => Promise<void>;
}) {
  const [revoking, setRevoking] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <tr className="k-row">
      <td className="px-4 py-2.5">
        <span className="block truncate font-medium">{email}</span>
        {failed && <span className="block text-[12px] text-red-600">Could not revoke. Try again.</span>}
      </td>
      <td className="w-[96px] px-4 py-2.5">{ROLE_LABEL[role] ?? role}</td>
      <td className="k-fg3 hidden w-[120px] px-4 py-2.5 sm:table-cell">
        Sent {new Date(sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
      </td>
      <td className="w-[96px] px-4 py-2.5 text-right">
        <button
          type="button"
          disabled={revoking}
          aria-busy={revoking}
          onClick={async () => {
            setRevoking(true);
            setFailed(false);
            try {
              await onRevoke();
            } catch (err) {
              console.error("[team] revoke failed", err);
              setFailed(true);
              setRevoking(false);
            }
          }}
          className={`text-[12px] font-medium text-red-600 ${revoking ? "cursor-wait" : "hover:underline"}`}
        >
          {revoking ? "Revoking..." : "Revoke"}
        </button>
      </td>
    </tr>
  );
}

/**
 * The team's shareable invite link: anyone who opens it and signs in joins as an
 * Admin. No expiry, by decision; every other admin is emailed when somebody joins, and
 * Revoke kills the link at once (creating a new one mints a new code).
 */
function InviteLinkCard() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? null;
  const { session } = useSession();
  const { displayBrand } = useTenantSwitcher();
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const call = async (method: "GET" | "POST" | "DELETE") => {
    if (!orgId || !session) return;
    const token = await session.getToken({ organizationId: orgId });
    const headers: Record<string, string> = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const res = await fetch(
      method === "GET" ? `/api/orgs/invite-link?orgId=${encodeURIComponent(orgId)}` : "/api/orgs/invite-link",
      method === "GET" ? { headers } : { method, headers, body: JSON.stringify({ orgId }) },
    );
    const body = (await res.json().catch(() => null)) as { code?: string | null; error?: string } | null;
    if (!res.ok) {
      console.error("[team] invite link", method, res.status, body);
      throw new Error(body?.error ?? "Could not update the invite link. Try again.");
    }
    setCode(body?.code ?? null);
  };

  useEffect(() => {
    if (code !== undefined || !orgId || !session) return;
    call("GET").catch((err: Error) => {
      setError(err.message);
      setCode(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, session, code]);

  const run = async (method: "POST" | "DELETE") => {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      await call(method);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const brand = displayBrand?.name
    ? sanitizeInviteBrand({
        name: displayBrand.name,
        domain: displayBrand.domain,
        logoUrl: displayBrand.logoUrl ?? null,
        tint: resolveBrandTint(displayBrand.colors),
      })
    : null;
  const url = code && orgId ? joinLinkUrl(dashboardOrigin(window.location.origin), orgId, code, brand) : null;

  return (
    <div className="k-card mb-4 p-4">
      <p className="text-[13px] font-medium">Invite link</p>
      <p className="k-fg3 mt-0.5 text-[12px]">
        Anyone with this link can join as an admin. Every admin gets an email when someone joins.
      </p>
      {code === undefined ? (
        <div className="mt-3 h-7 w-full animate-pulse rounded bg-[var(--bg-inset)]" />
      ) : url ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input readOnly value={url} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} className="k-input min-w-0 flex-1 px-2.5" />
          <button
            type="button"
            className="k-btn-accent justify-center"
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            disabled={busy}
            aria-busy={busy}
            onClick={() => run("DELETE")}
            className={`k-btn justify-center text-red-600 ${busy ? "cursor-wait" : ""}`}
          >
            {busy ? "Revoking..." : "Revoke"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          aria-busy={busy}
          onClick={() => run("POST")}
          className={`k-btn-accent mt-3 ${busy ? "cursor-wait" : ""}`}
        >
          {busy ? "Creating..." : "Create invite link"}
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[12px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
