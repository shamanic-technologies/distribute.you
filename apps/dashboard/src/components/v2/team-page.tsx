"use client";

import { useOrganization } from "@clerk/nextjs";
import { OrgAvatar } from "@/components/org-avatar";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { V2Page } from "@/components/v2/setup-pages";

/**
 * Team: Explee's Team page (the first item of its user menu), with our data. The
 * organization and its members are Clerk's own, read-only here: inviting a teammate
 * and deleting the organization are writes the dashboard does not offer anywhere yet,
 * so they are left out rather than drawn as controls that do nothing.
 *
 * Staff are hidden: god-mode makes every staff account a real member of every org it
 * opens, so listing them would show the customer people who are not on their team.
 */

const ROLE_LABEL: Record<string, string> = { "org:admin": "Admin", "org:member": "Member" };

export function V2TeamPage() {
  const { organization, isLoaded, memberships } = useOrganization({ memberships: { pageSize: 50, keepPreviousData: true } });
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
    </V2Page>
  );
}
