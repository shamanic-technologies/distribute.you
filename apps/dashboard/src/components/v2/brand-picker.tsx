"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listBrands } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { BrandLogo } from "@/components/brand-logo";
import { v2Base, v2NewBrandHref } from "@/lib/v2/routes";
import { Shimmer, TopBar } from "@/components/v2/ui";
import { StorefrontIcon } from "@phosphor-icons/react/dist/csr/Storefront";

/**
 * The v2 org page: an org with no remembered brand picks one. An org with NO brand at
 * all (a new org whose brand walk was closed) gets one big way forward, "Add a brand",
 * which opens the brand walk (`/get-started`'s screens, signed in, on this org). A set-up org with exactly ONE
 * brand has nothing to pick: it goes straight to that brand's page. The edge lets a v2 user reach
 * this page even while the org is not set up, instead of the full-page onboarding.
 * The `["brands"]` key v1 polls.
 */
export function V2BrandPicker({ orgId, setUp }: { orgId: string; setUp: boolean }) {
  const q = useAuthQuery(["brands"], () => listBrands());
  const brands = q.data?.brands ?? null;
  const router = useRouter();
  // One brand in a set-up org: nothing to pick, open it (replace, so Back skips this page).
  const onlyId = setUp && brands !== null && brands.length === 1 ? brands[0].id : null;
  useEffect(() => {
    if (onlyId) router.replace(v2Base(orgId, onlyId));
  }, [onlyId, orgId, router]);
  // An org not set up yet: its brand pages are behind the edge's first-run gate, so a
  // brand is RESUMED in the brand walk ("Finish setup") rather than opened.
  const addBrand = () => router.push(v2NewBrandHref(orgId));

  if (brands !== null && brands.length === 0) {
    return (
      <>
        <TopBar crumbs={[{ label: "Brands" }]} />
        <div className="mx-auto flex max-w-[560px] flex-col items-center px-4 pb-16 pt-[14vh] text-center md:px-6">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-[12px]"
            style={{ background: "color-mix(in oklab, var(--accent) 12%, transparent)", color: "var(--accent)" }}
          >
            <StorefrontIcon size={24} weight="duotone" />
          </span>
          <h1 className="mt-5 text-[24px] font-medium leading-[30px] tracking-[-0.02em]">Add your first brand</h1>
          <p className="k-fg2 mt-2 text-[14px] leading-[22px]">
            Tell us what you sell and who you sell to. We set up your first campaign in a few minutes.
          </p>
          <button type="button" className="k-btn-accent mt-6 h-9 px-4 text-[14px]" onClick={addBrand}>
            Add a brand
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar
        crumbs={[{ label: "Brands" }]}
        actions={
          <button type="button" className="k-btn" onClick={addBrand}>
            Add a brand
          </button>
        }
      />
      <div className="mx-auto max-w-[640px] px-4 pb-16 pt-6 md:px-6">
        <h1 className="mb-5 text-[24px] font-medium leading-[30px] tracking-[-0.02em]">Pick a brand</h1>
        <div className="k-card divide-y divide-[var(--line-subtle)]">
          {brands === null || onlyId ? (
            <div className="p-4">{q.isError ? <p className="k-fg3 text-[13px]">We could not read your brands.</p> : <Shimmer className="h-10 w-full" />}</div>
          ) : (
            brands.map((b) => {
              const inner = (
                <>
                  <BrandLogo domain={b.domain ?? null} size={20} className="shrink-0 rounded-[5px]" fallbackClassName="h-5 w-5 shrink-0" />
                  <span className="font-medium">{b.name || b.domain || "Brand"}</span>
                  {!setUp && <span className="k-fg3 ml-auto text-[12px]">Finish setup</span>}
                </>
              );
              return setUp ? (
                <Link key={b.id} href={v2Base(orgId, b.id)} className="k-hover flex items-center gap-3 px-4 py-3 text-[13px]">
                  {inner}
                </Link>
              ) : (
                <Link key={b.id} href={v2NewBrandHref(orgId, b.id)} className="k-hover flex items-center gap-3 px-4 py-3 text-[13px]">
                  {inner}
                </Link>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
