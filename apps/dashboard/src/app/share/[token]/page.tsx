import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { resolveShareToken } from "@/lib/share-report";
import { shareBrandBasePath } from "@/lib/share-mode";

/**
 * The share link itself.
 *
 * It renders nothing. Its job is to turn the credential into the brand it opens
 * and send the reader to that brand's dashboard, which lives one level down at
 * the mirrored route shape (`/share/<token>/orgs/<orgId>/brands/<brandId>`). The
 * ids in that URL are a consequence of running the REAL pages — they read their
 * org and brand off the route in ~25 places — and not a second credential: the
 * layout below re-resolves the token and refuses to render anything the token
 * does not name.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // A shared link is a private capability. Keeping it out of the index is the
  // difference between "I sent this to three people" and "this is on the web".
  robots: { index: false, follow: false },
};

export default async function SharedBrandEntry({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const brand = await resolveShareToken(token);
  // Unknown, revoked and rotated-away links are one outcome: this opens nothing.
  // The reader is never told which, because that difference is the org's business.
  if (!brand) notFound();

  redirect(shareBrandBasePath(token, brand.orgId, brand.id));
}
