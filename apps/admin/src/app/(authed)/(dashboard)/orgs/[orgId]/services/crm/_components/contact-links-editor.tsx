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

/**
 * Right-panel "status" section: link a Google contact to platform orgs / brands /
 * features. Every toggle instant-saves (no Save button) and reports the saved set
 * up so the contacts table updates immediately. Orgs are searched live against
 * Clerk (/api/admin/orgs); brands + features are cached lists filtered client-side.
 *
 * Brands are NOT constrained to the selected orgs: `org_brands.org_id` is an
 * internal UUID while the org picker deals in Clerk `org_...` ids, so the two id
 * spaces never intersect (brand-service holds no Clerk↔internal mapping). The
 * whole brand catalog is searchable instead.
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

  // ── Brands (all, cached) — full catalog, searchable ──
  const brandsQuery = useAuthQuery(["adminBrands"], () => listAdminBrands(), {
    staleTime: 5 * 60_000,
  });
  const allBrands = brandsQuery.data?.brands ?? [];
  const brandOptions: MultiSelectOption[] = useMemo(
    () => allBrands.map((b) => ({ id: b.id, label: b.name || b.domain || b.id, sublabel: b.domain })),
    [allBrands],
  );

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

  return (
    <div className="space-y-4">
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

      <MultiSelect
        label="Brands"
        options={brandOptions}
        selectedIds={brandIds}
        onToggle={toggleField(brandIds, setBrandIds, "brandIds")}
        placeholder="Filter brands…"
        emptyHint="No brands"
        loading={brandsQuery.isPending}
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
