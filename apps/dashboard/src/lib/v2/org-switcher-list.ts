/**
 * The Organizations block of the v2 sidebar switcher, written once for staff and
 * customers alike (owner 2026-10-05: the staff menu reads like the GA one).
 *
 * - The search box shows only past `ORG_SEARCH_MIN` orgs, for both. A customer's
 *   count is their memberships; a staff reader's is the platform total the god-mode
 *   route serves for an EMPTY query (a filtered total would hide the box mid-search).
 * - A customer's search filters their memberships here; staff search runs on the
 *   server, so their list arrives already filtered.
 * - With no search typed, the org you are on is pinned first, even when it is absent
 *   from the fetched page (staff see the 50 newest orgs only).
 *
 * Alias-free on purpose: unit-tested without the `@` alias.
 */

export const ORG_SEARCH_MIN = 8;

export type SwitcherOrg = {
  id: string;
  name: string;
  imageUrl?: string | null;
  hasImage?: boolean;
};

export function showOrgSearch(orgCount: number, query: string): boolean {
  return orgCount > ORG_SEARCH_MIN || query.trim() !== "";
}

export function switcherOrgs({
  orgs,
  query,
  filterLocally,
  current,
}: {
  orgs: SwitcherOrg[];
  query: string;
  /** True for a customer (memberships), false for staff (server already filtered). */
  filterLocally: boolean;
  /** The org the URL is on, or null off an org page. */
  current: SwitcherOrg | null;
}): SwitcherOrg[] {
  const q = query.trim().toLowerCase();
  if (q) {
    return filterLocally ? orgs.filter((o) => o.name.toLowerCase().includes(q)) : orgs;
  }
  if (!current) return orgs;
  const listed = orgs.find((o) => o.id === current.id) ?? current;
  return [listed, ...orgs.filter((o) => o.id !== current.id)];
}

/**
 * The keyboard highlight in the Organizations block: ↓/↑ in the search box move it
 * through the rows, wrapping at both ends, and Enter opens the highlighted org.
 * `-1` = nothing highlighted (no search typed yet); ↓ from there lands on the first row,
 * ↑ on the last. An empty list highlights nothing.
 */
export function moveOrgCursor(cursor: number, count: number, step: 1 | -1): number {
  if (count === 0) return -1;
  if (cursor < 0 || cursor >= count) return step === 1 ? 0 : count - 1;
  return (cursor + step + count) % count;
}
