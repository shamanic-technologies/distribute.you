"use client";

import { useOrganization } from "@clerk/nextjs";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listBrands, type Brand } from "@/lib/api";

/**
 * What a key reads, said where a key is created (API Keys page, Integrations >
 * AI). A key is one user in one organization: the Clerk organization active
 * when it is created, never a brand, never staff powers. A staff member who had
 * a client org open got a key on that client's data and an assistant that
 * could not explain why (2026-10-01), so the org is named BEFORE the click.
 *
 * The org name is Clerk's, the brands are the org's served brand list (same
 * query key as the brand picker); nothing is derived.
 */
export function ApiKeyScope() {
  const { organization, isLoaded } = useOrganization();
  const brandsQ = useAuthQuery<{ brands: Brand[] }>(["brands"], () => listBrands());

  if (!isLoaded) return <span aria-busy="true">Reading which organization this key will read…</span>;
  if (!organization) {
    console.error("[api-key-scope] no active organization while creating a key");
    return <span>No organization is open, so a key cannot be scoped. Open an organization first.</span>;
  }

  const brands = brandsQ.data?.brands;
  const names = brands?.map((b) => b.name ?? b.domain ?? b.id).join(", ");
  return (
    <span>
      This key reads the organization <strong>{organization.name}</strong>
      {brands ? (brands.length > 0 ? ` (brands: ${names})` : " (no brands yet)") : null}. It acts as
      you, in this organization only.
    </span>
  );
}
