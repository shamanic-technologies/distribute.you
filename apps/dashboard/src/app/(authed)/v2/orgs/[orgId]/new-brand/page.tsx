import { BrandWalk } from "@/components/v2/brand-walk";

/**
 * "Add a brand" / "New brand" / "Finish setup" (`?brand=<id>`): the `/get-started`
 * screens, signed in, on THIS org. The edge lets an org that is not set up yet reach it
 * (a new org's first brand), like the bare org page.
 */
export default async function V2NewBrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ brand?: string | string[] }>;
}) {
  const { orgId } = await params;
  const { brand } = await searchParams;
  return <BrandWalk orgId={orgId} brandId={typeof brand === "string" && brand ? brand : null} />;
}
