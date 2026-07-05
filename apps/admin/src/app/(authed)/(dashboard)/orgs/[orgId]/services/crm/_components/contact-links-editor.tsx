"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  listAdminBrands,
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

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

/**
 * Right-panel "status" section: link a Google contact to platform orgs / brands /
 * features. Brands are constrained to the selected orgs. All three can be empty.
 * Orgs are searched live against Clerk (/api/admin/orgs); brands + features are
 * cached lists filtered client-side.
 */
export function ContactLinksEditor({
  contact,
  onSaved,
}: {
  contact: GoogleContactRow;
  onSaved: (links: GoogleContactLinks) => void;
}) {
  const resourceName = contact.resourceName ?? "";
  const initial = contact.links ?? EMPTY_LINKS;
  const [orgIds, setOrgIds] = useState<string[]>(initial.orgIds);
  const [brandIds, setBrandIds] = useState<string[]>(initial.brandIds);
  const [featureSlugs, setFeatureSlugs] = useState<string[]>(initial.featureSlugs);

  // Re-seed when a different contact is selected.
  useEffect(() => {
    const links = contact.links ?? EMPTY_LINKS;
    setOrgIds(links.orgIds);
    setBrandIds(links.brandIds);
    setFeatureSlugs(links.featureSlugs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceName]);

  // ── Orgs: live Clerk search + name resolution for pre-selected ids ──
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

  // Prime the org dropdown with the most-recent orgs on first render.
  useEffect(() => {
    searchOrgs("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Brands (all, cached) filtered by selected orgs ──
  const brandsQuery = useAuthQuery(["adminBrands"], () => listAdminBrands(), {
    staleTime: 5 * 60_000,
  });
  const allBrands = brandsQuery.data?.brands ?? [];
  const brandOptions: MultiSelectOption[] = useMemo(() => {
    const orgSet = new Set(orgIds);
    const selSet = new Set(brandIds);
    return allBrands
      .filter((b) => orgSet.has(b.orgId) || selSet.has(b.id))
      .map((b) => ({ id: b.id, label: b.name || b.domain || b.id, sublabel: b.domain }));
  }, [allBrands, orgIds, brandIds]);

  // Drop brand selections whose org is no longer selected.
  useEffect(() => {
    if (orgIds.length === 0) return;
    const orgSet = new Set(orgIds);
    const brandOrg = new Map(allBrands.map((b) => [b.id, b.orgId]));
    setBrandIds((prev) => prev.filter((id) => !brandOrg.has(id) || orgSet.has(brandOrg.get(id)!)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgIds, allBrands]);

  // ── Features (cached) ──
  const featuresQuery = useAuthQuery(["features", "all"], () => listFeatures(), {
    staleTime: 5 * 60_000,
  });
  const featureOptions: MultiSelectOption[] = (featuresQuery.data?.features ?? []).map((f) => ({
    id: f.slug,
    label: f.name || f.slug,
    sublabel: f.slug,
  }));

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) =>
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const dirty =
    !sameSet(orgIds, initial.orgIds) ||
    !sameSet(brandIds, initial.brandIds) ||
    !sameSet(featureSlugs, initial.featureSlugs);

  const mutation = useMutation({
    mutationFn: () =>
      saveContactLinks({
        resourceName,
        orgIds,
        brandIds,
        featureSlugs,
        status: initial.status ?? null,
      }),
    onSuccess: (saved) => {
      onSaved({
        orgIds: saved.orgIds,
        brandIds: saved.brandIds,
        featureSlugs: saved.featureSlugs,
        status: saved.status,
      });
    },
  });

  const brandDisabled = orgIds.length === 0 && brandIds.length === 0;

  if (!resourceName) {
    return <p className="text-sm text-gray-400">This contact can’t be linked (no resource id).</p>;
  }

  return (
    <div className="space-y-4">
      <MultiSelect
        label="Organizations"
        options={orgOptions.map((o) => ({ id: o.id, label: o.name || o.id }))}
        selectedIds={orgIds}
        onToggle={toggle(setOrgIds)}
        onSearchChange={searchOrgs}
        loading={orgLoading}
        placeholder="Search organizations…"
        emptyHint="Type to search organizations"
      />

      <MultiSelect
        label="Brands"
        options={brandOptions}
        selectedIds={brandIds}
        onToggle={toggle(setBrandIds)}
        placeholder={brandDisabled ? "Select an organization first" : "Filter brands…"}
        emptyHint={brandDisabled ? "Select an organization first" : "No brands for selected orgs"}
        loading={brandsQuery.isPending}
        disabled={brandDisabled}
      />

      <MultiSelect
        label="Features"
        options={featureOptions}
        selectedIds={featureSlugs}
        onToggle={toggle(setFeatureSlugs)}
        placeholder="Filter features…"
        loading={featuresQuery.isPending}
      />

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          disabled={!dirty || mutation.isPending}
          onClick={() => mutation.mutate()}
          className={`rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white ${
            mutation.isPending
              ? "cursor-wait"
              : "disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-600"
          }`}
        >
          {mutation.isPending ? "Saving…" : "Save status"}
        </button>
        {mutation.isError && (
          <span className="text-sm text-red-600">Save failed — try again.</span>
        )}
        {!dirty && !mutation.isPending && mutation.isSuccess && (
          <span className="text-sm text-green-600">Saved.</span>
        )}
      </div>
    </div>
  );
}
