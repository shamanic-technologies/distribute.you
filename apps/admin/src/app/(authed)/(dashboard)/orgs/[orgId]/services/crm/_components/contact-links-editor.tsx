"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  listAdminBrands,
  listBrands,
  listFeatures,
  saveContactLinks,
  type GoogleContactRow,
  type GoogleContactLinks,
} from "@/lib/api";
import { MultiSelect, type MultiSelectOption } from "./multi-select";

interface OrgOption {
  id: string;
  name: string;
}

const EMPTY_LINKS: GoogleContactLinks = {
  orgIds: [],
  brandIds: [],
  featureSlugs: [],
  status: null,
};

/**
 * Right-panel "status" section: link a Google contact to platform orgs / brands /
 * features. Every toggle instant-saves (no Save button) and reports the saved set
 * up so the contacts table updates immediately.
 *
 * Two modes:
 *
 * • Org-granularity (`lockedOrgId` passed — the CRM lives under /orgs/[orgId]):
 *   Organizations is LOCKED to the current org — a single pre-checked chip the
 *   user can untick (contact isn't part of it) but can't swap/add another. Brands
 *   come from the org-scoped `listBrands()` (the authed org == the URL org here,
 *   so it returns exactly this org's brands — sidestepping the Clerk-id vs
 *   internal-UUID mismatch that forces root mode onto the whole /admin/brands
 *   catalog). If the org has exactly one brand it's pre-ticked (UI only — never a
 *   silent write; it persists on the next toggle like every other change).
 *
 * • Root (`lockedOrgId` absent — future root-level CRM panel): Organizations is a
 *   live Clerk search (/api/admin/orgs, multi-org) and brands are the full
 *   /admin/brands catalog, searchable — the two id-spaces never intersect so
 *   brands can't be org-constrained.
 */
export function ContactLinksEditor({
  contact,
  onSaved,
  lockedOrgId,
  lockedOrgName,
}: {
  contact: GoogleContactRow;
  onSaved: (links: GoogleContactLinks) => void;
  /** Org-granularity mode: lock the Organizations field to this org. Absent = full cross-org Clerk search. */
  lockedOrgId?: string;
  lockedOrgName?: string;
}) {
  const locked = !!lockedOrgId;
  const resourceName = contact.resourceName ?? "";
  const initial = contact.links ?? EMPTY_LINKS;
  const [orgIds, setOrgIds] = useState<string[]>(initial.orgIds);
  const [brandIds, setBrandIds] = useState<string[]>(initial.brandIds);
  const [featureSlugs, setFeatureSlugs] = useState<string[]>(initial.featureSlugs);

  // Pre-tick the single-brand default once per contact (UI only, not persisted).
  const brandPretickedFor = useRef<string | null>(null);

  // Re-seed when a different contact is selected. In locked mode pre-select the
  // current org (UI only — persists on the next toggle, never a silent write).
  useEffect(() => {
    const links = contact.links ?? EMPTY_LINKS;
    setOrgIds(
      locked && lockedOrgId && !links.orgIds.includes(lockedOrgId)
        ? [...links.orgIds, lockedOrgId]
        : links.orgIds,
    );
    setBrandIds(links.brandIds);
    setFeatureSlugs(links.featureSlugs);
    brandPretickedFor.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceName]);

  // ── Orgs (root mode only): live Clerk search + name resolution ──
  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mergeOrgOptions = (incoming: OrgOption[]) => {
    setOrgOptions((prev) => {
      const m = new Map(prev.map((o) => [o.id, o]));
      for (const o of incoming) m.set(o.id, o);
      return [...m.values()];
    });
  };

  // Resolve names for the contact's already-linked orgs so their chips show a name.
  useEffect(() => {
    if (locked) return;
    const ids = (contact.links ?? EMPTY_LINKS).orgIds;
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/orgs/names?ids=${encodeURIComponent(ids.join(","))}`);
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { names: Record<string, string> };
      mergeOrgOptions(Object.entries(data.names).map(([id, name]) => ({ id, name })));
    })();
    return () => {
      cancelled = true;
    };
  }, [resourceName]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchOrgs = (q: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setOrgLoading(true);
      try {
        const res = await fetch(`/api/admin/orgs?q=${encodeURIComponent(q.trim())}`);
        if (!res.ok) return;
        const data = (await res.json()) as { organizations: { id: string; name: string }[] };
        mergeOrgOptions(data.organizations.map((o) => ({ id: o.id, name: o.name })));
      } finally {
        setOrgLoading(false);
      }
    }, 250);
  };

  // Prime the org dropdown with the most-recent orgs on first render (root mode).
  useEffect(() => {
    if (locked) return;
    searchOrgs("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Brands: org-scoped in locked mode, full catalog in root mode ──
  const orgBrandsQuery = useAuthQuery(["orgBrands", lockedOrgId ?? ""], () => listBrands(), {
    enabled: locked,
    staleTime: 5 * 60_000,
  });
  const adminBrandsQuery = useAuthQuery(["adminBrands"], () => listAdminBrands(), {
    enabled: !locked,
    staleTime: 5 * 60_000,
  });
  const brands = locked
    ? orgBrandsQuery.data?.brands ?? []
    : adminBrandsQuery.data?.brands ?? [];
  const brandsPending = locked ? orgBrandsQuery.isPending : adminBrandsQuery.isPending;
  const brandOptions: MultiSelectOption[] = useMemo(
    () => brands.map((b) => ({ id: b.id, label: b.name || b.domain || b.id, sublabel: b.domain })),
    [brands],
  );

  // Pre-tick the org's single brand on panel open (locked mode, UI only).
  useEffect(() => {
    if (!locked || orgBrandsQuery.isPending) return;
    if (brandPretickedFor.current === resourceName) return;
    brandPretickedFor.current = resourceName;
    if (brands.length === 1) {
      const only = brands[0].id;
      setBrandIds((prev) => (prev.includes(only) ? prev : [...prev, only]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, resourceName, orgBrandsQuery.isPending, brands.length]);

  // ── Features (cached) ──
  const featuresQuery = useAuthQuery(["features", "all"], () => listFeatures(), {
    staleTime: 5 * 60_000,
  });
  const featureOptions: MultiSelectOption[] = (featuresQuery.data?.features ?? []).map((f) => ({
    id: f.slug,
    label: f.name || f.slug,
    sublabel: f.slug,
  }));

  // ── Instant save: every toggle persists the full set and reports it up ──
  const mutation = useMutation({
    mutationFn: (links: { orgIds: string[]; brandIds: string[]; featureSlugs: string[] }) =>
      saveContactLinks({ resourceName, ...links, status: initial.status ?? null }),
    onSuccess: (saved) => {
      onSaved({
        orgIds: saved.orgIds,
        brandIds: saved.brandIds,
        featureSlugs: saved.featureSlugs,
        status: saved.status,
      });
    },
  });

  const toggleField =
    (current: string[], setter: React.Dispatch<React.SetStateAction<string[]>>, field: "orgIds" | "brandIds" | "featureSlugs") =>
    (id: string) => {
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      setter(next);
      mutation.mutate({ orgIds, brandIds, featureSlugs, [field]: next });
    };

  if (!resourceName) {
    return <p className="text-sm text-gray-400">This contact can’t be linked (no resource id).</p>;
  }

  const orgLabel = lockedOrgName || lockedOrgId || "";
  const orgChecked = !!lockedOrgId && orgIds.includes(lockedOrgId);

  return (
    <div className="space-y-4">
      {locked ? (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Organizations
            </label>
          </div>
          {orgChecked ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs px-2 py-0.5">
              <span className="truncate max-w-[200px]">{orgLabel}</span>
              <button
                type="button"
                onClick={() => toggleField(orgIds, setOrgIds, "orgIds")(lockedOrgId!)}
                className="text-brand-400 hover:text-brand-700"
                aria-label={`Remove ${orgLabel}`}
              >
                ×
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => toggleField(orgIds, setOrgIds, "orgIds")(lockedOrgId!)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-brand-300 hover:text-brand-600 text-xs px-2 py-0.5"
            >
              + {orgLabel}
            </button>
          )}
        </div>
      ) : (
        <MultiSelect
          label="Organizations"
          options={orgOptions.map((o) => ({ id: o.id, label: o.name || o.id }))}
          selectedIds={orgIds}
          onToggle={toggleField(orgIds, setOrgIds, "orgIds")}
          onSearchChange={searchOrgs}
          loading={orgLoading}
          placeholder="Search organizations…"
          emptyHint="Type to search organizations"
        />
      )}

      <MultiSelect
        label="Brands"
        options={brandOptions}
        selectedIds={brandIds}
        onToggle={toggleField(brandIds, setBrandIds, "brandIds")}
        placeholder="Filter brands…"
        emptyHint="No brands"
        loading={brandsPending}
      />

      <MultiSelect
        label="Features"
        options={featureOptions}
        selectedIds={featureSlugs}
        onToggle={toggleField(featureSlugs, setFeatureSlugs, "featureSlugs")}
        placeholder="Filter features…"
        loading={featuresQuery.isPending}
      />

      <div className="flex items-center gap-2 pt-1 text-xs">
        {mutation.isPending ? (
          <span className="text-gray-400">Saving…</span>
        ) : mutation.isError ? (
          <span className="text-red-600">Save failed — try again.</span>
        ) : mutation.isSuccess ? (
          <span className="text-green-600">Saved.</span>
        ) : (
          <span className="text-gray-300">Changes save automatically.</span>
        )}
      </div>
    </div>
  );
}
