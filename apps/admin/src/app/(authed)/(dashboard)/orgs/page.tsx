"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useOrganization, useOrganizationList } from "@clerk/nextjs";
import { explicitHierarchyHref } from "@/lib/last-brand";
import { clearBreadcrumbCaches } from "@/components/breadcrumb-nav";

/**
 * /orgs → the app-level "Organizations" root: a searchable list of EVERY
 * platform org (staff god-mode). Picking one joins it (option A auto-join),
 * activates it in Clerk, and drills into the org overview — the same path the
 * breadcrumb switcher uses. Replaces the old redirect-to-active-org: the root
 * granularity is org-agnostic, so it lands here (pick an org) instead of
 * silently re-entering the last active one.
 */

interface OrgOption {
  id: string;
  name: string;
  slug: string | null;
  imageUrl?: string | null;
  hasImage?: boolean;
}

const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

/** The org's domain when its name is domain-shaped (onboarding names the org
 *  after the brand domain). Renamed / non-domain names fall back to the initial. */
function orgDomainFromName(name?: string | null): string | null {
  if (!name) return null;
  const candidate = name.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
  return /^[^\s]+\.[^\s]+$/.test(candidate) ? candidate : null;
}

function OrgAvatar({
  name,
  imageUrl,
  hasImage,
}: {
  name: string;
  imageUrl?: string | null;
  hasImage?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const domain = orgDomainFromName(name);
  const src = hasImage && imageUrl
    ? imageUrl
    : domain
      ? `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}`
      : null;
  if (src && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        onError={() => setBroken(true)}
        className="w-9 h-9 rounded-lg object-cover bg-brand-100 flex-shrink-0"
      />
    );
  }
  return (
    <div className="w-9 h-9 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0">
      <span className="text-brand-600 font-semibold text-sm">{name?.[0]?.toUpperCase() || "O"}</span>
    </div>
  );
}

export default function OrganizationsPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const { setActive } = useOrganizationList();
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);

  const fetchOrgs = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orgs?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setOrgs(data.organizations || []);
      }
    } catch (err) {
      console.error("Failed to fetch orgs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search; initial load fetches the full list.
  useEffect(() => {
    const t = setTimeout(() => fetchOrgs(search), 250);
    return () => clearTimeout(t);
  }, [search, fetchOrgs]);

  // Same god-mode switch as the breadcrumb: join (idempotent, makes the admin a
  // real member so Clerk setActive accepts the org) → activate → drill to org
  // overview. AWAIT setActive before navigating so the session's org claim has
  // rotated (DIS-143 stale-write race).
  const handleSelect = async (clerkOrgId: string) => {
    setSwitching(clerkOrgId);
    clearBreadcrumbCaches();
    try {
      await fetch(`/api/admin/orgs/${clerkOrgId}/join`, { method: "POST" });
    } catch (err) {
      console.error("Failed to join org:", err);
    }
    if (setActive) {
      await setActive({ organization: clerkOrgId });
    }
    router.push(explicitHierarchyHref(`/orgs/${clerkOrgId}`));
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Organizations</h1>
        <p className="text-sm text-gray-500 mt-1">Pick an organization to drill into its brands and data.</p>
      </div>

      <div className="relative mb-4">
        <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search all organizations…"
          className="w-full text-sm pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-300 focus:outline-none"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading && orgs.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">Loading…</div>
        ) : orgs.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">No organizations found</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {orgs.map((o) => (
              <li key={o.id}>
                <button
                  onClick={() => handleSelect(o.id)}
                  disabled={switching !== null}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${
                    organization?.id === o.id ? "bg-brand-50" : "hover:bg-gray-50"
                  } ${switching !== null ? "cursor-wait" : ""}`}
                >
                  <OrgAvatar name={o.name} imageUrl={o.imageUrl} hasImage={o.hasImage} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-gray-800 truncate">{o.name}</span>
                    {o.slug && <span className="block text-xs text-gray-400 truncate">{o.slug}</span>}
                  </span>
                  {switching === o.id ? (
                    <svg className="w-4 h-4 text-brand-500 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : organization?.id === o.id ? (
                    <span className="text-[10px] text-brand-600 font-medium bg-brand-100 px-2 py-0.5 rounded-full flex-shrink-0">Active</span>
                  ) : (
                    <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
