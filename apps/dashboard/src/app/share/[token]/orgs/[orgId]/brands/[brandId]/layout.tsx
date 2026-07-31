import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareShell } from "@/components/share/share-shell";
import { resolveShareToken } from "@/lib/share-report";

/**
 * The shared brand's dashboard.
 *
 * The org and brand sit in the URL so the real page components can read them the
 * way they always do. They are NOT trusted: this layout re-resolves the
 * credential on every request and renders only when the credential names exactly
 * this org and this brand. Editing the brand id to look at a sibling brand in the
 * same org therefore opens nothing, which is the same answer the read proxy gives
 * independently — two locks, either one sufficient.
 *
 * Re-resolving per request (rather than trusting a first resolve) is also what
 * makes revocation immediate: the next page load stops, not the next session.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SharedBrandLayout({
  params,
  children,
}: {
  params: Promise<{ token: string; orgId: string; brandId: string }>;
  children: React.ReactNode;
}) {
  const { token, orgId, brandId } = await params;

  const brand = await resolveShareToken(token);
  if (!brand) notFound();
  if (brand.id !== brandId || brand.orgId !== orgId) notFound();

  return (
    <ShareShell
      share={{
        token,
        orgId: brand.orgId,
        brandId: brand.id,
        brandName: brand.name,
        brandDomain: brand.domain,
      }}
    >
      {children}
    </ShareShell>
  );
}
