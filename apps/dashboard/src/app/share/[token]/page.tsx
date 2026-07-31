import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { resolveShareToken } from "@/lib/share-report";

/**
 * Public, read-only view of one brand.
 *
 * Lives OUTSIDE `(authed)` on purpose: that subtree is where `ClerkProvider`
 * mounts, and this page has no session by construction. The credential in the
 * URL is the entire authority.
 *
 * No sidebar, no tenant switcher, no account menu: those are the org's chrome,
 * and this page is not the org's.
 *
 * It shows the brand's identity and nothing else, because that is all a
 * credential unlocks today — brand-service's resolve returns the brand's
 * public-safe payload and no org id, and the outreach figures live behind
 * org-scoped endpoints. Reaching for those would mean inventing an org lookup
 * the producer deliberately did not hand out. Widening this page is a
 * brand-service change first.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // A shared link is a private capability. Keeping it out of the index is the
  // difference between "I sent this to three people" and "this is on the web".
  robots: { index: false, follow: false },
};

export default async function SharedBrandPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const brand = await resolveShareToken(token);
  // Unknown, revoked and rotated-away links are one outcome: this opens nothing.
  // The reader is never told which, because that difference is the org's business.
  if (!brand) notFound();

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex items-center gap-3">
          <BrandLogo domain={brand.domain} size={40} />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 truncate">{brand.name}</h1>
            {brand.domain && <p className="text-xs text-gray-500 truncate">{brand.domain}</p>}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-medium text-gray-900">About this brand</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-gray-500">Name</dt>
              <dd className="text-gray-800 font-medium">{brand.name}</dd>
            </div>
            {brand.domain && (
              <div className="flex gap-3">
                <dt className="w-24 shrink-0 text-gray-500">Domain</dt>
                <dd className="text-gray-800 font-medium">{brand.domain}</dd>
              </div>
            )}
            {brand.url && (
              <div className="flex gap-3">
                <dt className="w-24 shrink-0 text-gray-500">Website</dt>
                <dd className="min-w-0">
                  <a
                    href={brand.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:underline break-all"
                  >
                    {brand.url}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* States plainly what this page is, so a reader does not assume they
            are seeing everything and the brand owner is not surprised by what a
            recipient can see. */}
        <p className="mt-6 text-sm text-gray-500">
          A read-only view shared by {brand.name}. Spend, budget, audiences and contact
          details are not included.
        </p>

        <p className="mt-10 text-xs text-gray-400">
          Outreach run by{" "}
          <a
            href="https://distribute.you"
            className="text-brand-600 hover:underline"
            rel="noopener noreferrer"
          >
            distribute
          </a>
        </p>
      </div>
    </main>
  );
}
