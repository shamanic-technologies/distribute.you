"use client";

import Link from "next/link";
import { listBrands } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { BrandLogo } from "@/components/brand-logo";
import { v2Base } from "@/lib/v2/routes";
import { EmptyNote, Shimmer, TopBar } from "@/components/v2/ui";

/** An org with no remembered brand picks one, in v2. The `["brands"]` key v1 polls. */
export function V2BrandPicker({ orgId }: { orgId: string }) {
  const q = useAuthQuery(["brands"], () => listBrands());
  const brands = q.data?.brands ?? null;
  return (
    <>
      <TopBar crumbs={[{ label: "Brands" }]} />
      <div className="mx-auto max-w-[640px] px-4 pb-16 pt-6 md:px-6">
        <h1 className="mb-5 text-[24px] font-medium leading-[30px] tracking-[-0.02em]">Pick a brand</h1>
        <div className="k-card divide-y divide-[var(--line-subtle)]">
          {brands === null ? (
            <div className="p-4">{q.isError ? <p className="k-fg3 text-[13px]">We could not read your brands.</p> : <Shimmer className="h-10 w-full" />}</div>
          ) : brands.length === 0 ? (
            <EmptyNote>No brand in this organization yet.</EmptyNote>
          ) : (
            brands.map((b) => (
              <Link key={b.id} href={v2Base(orgId, b.id)} className="k-hover flex items-center gap-3 px-4 py-3 text-[13px]">
                <BrandLogo domain={b.domain ?? null} size={20} className="shrink-0 rounded-[5px]" fallbackClassName="h-5 w-5 shrink-0" />
                <span className="font-medium">{b.name || b.domain || "Brand"}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  );
}
