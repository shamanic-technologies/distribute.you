"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptionsSlower } from "@/lib/query-options";
import {
  listGoogleContacts,
  listAdminBrands,
  listFeatures,
  type GoogleContactRow,
  type GoogleContactLinks,
  type AdminBrand,
} from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";
import { useOrg } from "@/lib/org-context";
import { ContactLinksEditor } from "./contact-links-editor";
import { ContactThread } from "./contact-thread";

const PAGE_LIMIT = 50;

interface OrgInfo {
  name: string;
  imageUrl: string;
  hasImage: boolean;
}

function contactKey(c: GoogleContactRow): string {
  return c.resourceName ?? c.id ?? "";
}

function initials(src: string): string {
  return (src || "?").slice(0, 2).toUpperCase();
}

function contactInitials(c: GoogleContactRow): string {
  return initials(c.displayName || c.primaryEmail || "?");
}

/** Clerk org avatar — real logo only when hasImage, else an initials badge. */
function OrgAvatar({ info }: { info: OrgInfo }) {
  if (info.hasImage && info.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={info.imageUrl}
        alt=""
        className="h-5 w-5 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[9px] font-medium text-gray-500">
      {initials(info.name)}
    </span>
  );
}

/** A wrapped row of avatar+label chips (orgs / brands), collapsing overflow to +N. */
function ChipRow({
  items,
  max = 2,
}: {
  items: { key: string; avatar: React.ReactNode; label: string }[];
  max?: number;
}) {
  if (items.length === 0) return <span className="text-xs text-gray-300">—</span>;
  const shown = items.slice(0, max);
  const overflow = items.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((it) => (
        <span
          key={it.key}
          title={it.label}
          className="inline-flex max-w-[10rem] items-center gap-1 rounded-full bg-gray-50 border border-gray-200 px-1.5 py-0.5"
        >
          {it.avatar}
          <span className="truncate text-xs text-gray-700">{it.label}</span>
        </span>
      ))}
      {overflow > 0 && <span className="text-xs text-gray-400">+{overflow}</span>}
    </div>
  );
}

/**
 * Contacts CRM: a filterable, paginated contacts table (left) with Org / Brand /
 * Feature columns resolved from each contact's platform links (orgs + brands show
 * logos), plus a detail panel (right) with the org/brand/feature status editor and
 * the Gmail thread. Org names/logos come from Clerk (/api/admin/orgs/names), brands
 * from the staff brands list, features from the feature registry — all batched.
 */
export function CrmWorkspace() {
  const { org } = useOrg();
  const [rawFilter, setRawFilter] = useState("");
  const [filter, setFilter] = useState("");
  const [extra, setExtra] = useState<GoogleContactRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Local link overrides applied on save, so the table + panel update instantly.
  const [linkOverrides, setLinkOverrides] = useState<Record<string, GoogleContactLinks>>({});

  // Debounce the filter input.
  useEffect(() => {
    const t = setTimeout(() => setFilter(rawFilter.trim()), 300);
    return () => clearTimeout(t);
  }, [rawFilter]);

  // Reset pagination when the filter changes.
  useEffect(() => {
    setExtra([]);
    setCursor(null);
  }, [filter]);

  const query = useAuthQuery(
    ["googleContacts", filter],
    () => listGoogleContacts(null, PAGE_LIMIT, undefined, { query: filter || undefined }),
    pollOptionsSlower,
  );

  const contacts: GoogleContactRow[] = useMemo(() => {
    const base = query.data ? [...query.data.items, ...extra] : [];
    return base.map((c) => {
      const override = linkOverrides[contactKey(c)];
      return override ? { ...c, links: override } : c;
    });
  }, [query.data, extra, linkOverrides]);

  // ── Resolvers for the Org / Brand / Feature columns (all batched) ──
  const brandsQuery = useAuthQuery(["adminBrands"], () => listAdminBrands(), {
    staleTime: 5 * 60_000,
  });
  const brandMap = useMemo(() => {
    const m = new Map<string, AdminBrand>();
    for (const b of brandsQuery.data?.brands ?? []) m.set(b.id, b);
    return m;
  }, [brandsQuery.data]);

  const featuresQuery = useAuthQuery(["features", "all"], () => listFeatures(), {
    staleTime: 5 * 60_000,
  });
  const featureNameBySlug = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of featuresQuery.data?.features ?? []) m.set(f.slug, f.name || f.slug);
    return m;
  }, [featuresQuery.data]);

  // Every distinct linked org id across the visible rows → one names+logos fetch.
  const orgIdsAll = useMemo(() => {
    const s = new Set<string>();
    for (const c of contacts) for (const id of c.links?.orgIds ?? []) s.add(id);
    return [...s].sort();
  }, [contacts]);

  const orgQuery = useQuery({
    queryKey: ["crmOrgInfo", orgIdsAll.join(",")],
    enabled: orgIdsAll.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/orgs/names?ids=${encodeURIComponent(orgIdsAll.join(","))}`,
      );
      if (!res.ok) throw new Error("[admin] CRM org info fetch failed");
      return (await res.json()) as { orgs: Record<string, OrgInfo> };
    },
  });
  const orgMap = orgQuery.data?.orgs ?? {};

  const nextCursor = extra.length > 0 ? cursor : (query.data?.nextCursor ?? null);
  const selected = contacts.find((c) => contactKey(c) === selectedKey) ?? null;

  async function loadMore() {
    const c = extra.length > 0 ? cursor : query.data?.nextCursor;
    if (!c) return;
    setLoadingMore(true);
    try {
      const page = await listGoogleContacts(c, PAGE_LIMIT, undefined, {
        query: filter || undefined,
      });
      setExtra((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="relative flex h-[calc(100vh-16rem)] min-h-[32rem] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white md:flex-row">
      {/* Left — contacts table */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-gray-200 p-3">
          <input
            type="text"
            value={rawFilter}
            onChange={(e) => setRawFilter(e.target.value)}
            placeholder="Filter contacts by name or email…"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {query.isPending ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : query.isError ? (
            <p className="p-4 text-sm text-red-600">Failed to load contacts.</p>
          ) : contacts.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400">
              {filter ? "No contacts match your filter." : "No Google contacts synced yet."}
            </p>
          ) : (
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="px-4 py-2">Contact</th>
                  <th className="px-4 py-2">Org</th>
                  <th className="px-4 py-2">Brand</th>
                  <th className="px-4 py-2">Feature</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contacts.map((c) => {
                  const key = contactKey(c);
                  const isSel = key === selectedKey;
                  const links = c.links;
                  const orgItems = (links?.orgIds ?? []).map((id) => {
                    const info = orgMap[id];
                    return {
                      key: id,
                      avatar: (
                        <OrgAvatar info={info ?? { name: id, imageUrl: "", hasImage: false }} />
                      ),
                      label: info?.name || id,
                    };
                  });
                  const brandItems = (links?.brandIds ?? []).map((id) => {
                    const b = brandMap.get(id);
                    return {
                      key: id,
                      avatar: <BrandLogo domain={b?.domain ?? null} size={20} className="rounded" />,
                      label: b?.name || b?.domain || id,
                    };
                  });
                  const featureLabels = (links?.featureSlugs ?? []).map(
                    (slug) => featureNameBySlug.get(slug) || slug,
                  );
                  return (
                    <tr
                      key={key}
                      onClick={() => setSelectedKey(key)}
                      className={`cursor-pointer ${isSel ? "bg-brand-50" : "hover:bg-gray-50"}`}
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500">
                            {contactInitials(c)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-gray-800">
                              {c.displayName || c.primaryEmail || key}
                            </span>
                            {c.primaryEmail && (
                              <span className="block truncate text-xs text-gray-400">
                                {c.primaryEmail}
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 align-top">
                        <ChipRow items={orgItems} />
                      </td>
                      <td className="px-4 py-2 align-top">
                        <ChipRow items={brandItems} />
                      </td>
                      <td className="px-4 py-2 align-top">
                        {featureLabels.length === 0 ? (
                          <span className="text-xs text-gray-300">—</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1">
                            {featureLabels.slice(0, 2).map((label, i) => (
                              <span
                                key={`${label}-${i}`}
                                title={label}
                                className="inline-flex max-w-[10rem] items-center rounded-full bg-gray-50 border border-gray-200 px-1.5 py-0.5 text-xs text-gray-700"
                              >
                                <span className="truncate">{label}</span>
                              </span>
                            ))}
                            {featureLabels.length > 2 && (
                              <span className="text-xs text-gray-400">
                                +{featureLabels.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {nextCursor && (
            <div className="p-3">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right — contact detail panel */}
      {selected && (
        <div className="absolute inset-0 flex flex-col overflow-y-auto border-gray-200 bg-white md:static md:w-[26rem] md:border-l">
          <div className="flex items-start justify-between gap-3 border-b border-gray-200 p-4">
            <div className="flex min-w-0 items-center gap-3">
              {selected.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selected.photoUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-500">
                  {contactInitials(selected)}
                </span>
              )}
              <div className="min-w-0">
                <div className="truncate font-medium text-gray-900">
                  {selected.displayName || selected.primaryEmail || contactKey(selected)}
                </div>
                {selected.primaryEmail && (
                  <div className="truncate text-xs text-gray-400">{selected.primaryEmail}</div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedKey(null)}
              className="shrink-0 text-gray-400 hover:text-gray-700"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="border-b border-gray-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-800">Status</h3>
            <ContactLinksEditor
              contact={selected}
              lockedOrgId={org?.id}
              lockedOrgName={org?.name}
              onSaved={(links) =>
                setLinkOverrides((prev) => ({ ...prev, [contactKey(selected)]: links }))
              }
            />
          </div>

          <div className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-800">Emails</h3>
            <ContactThread email={selected.primaryEmail} />
          </div>
        </div>
      )}
    </div>
  );
}
