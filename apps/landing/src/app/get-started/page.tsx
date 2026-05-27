import type { Metadata } from "next";
import { headers } from "next/headers";
import { GetStartedForm } from "@/components/get-started-form";
import { TrustStrip } from "@/components/trust-strip";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { resolveUrls } from "@/lib/env-urls";
import { fetchTrustStripBrands } from "@/lib/invites/trust-strip-brands";
import { isValidInviteSlug } from "@/lib/invite-cookie";

export const metadata: Metadata = {
  title: "Get started · distribute",
  description: "distribute is currently invite-only. Use your invite code or request access.",
  robots: {
    index: false,
    follow: false,
  },
};

interface PageProps {
  searchParams: Promise<{ invite?: string }>;
}

export default async function GetStartedPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const inviteParam = params.invite ?? null;
  const initialInvite = isValidInviteSlug(inviteParam) ? inviteParam.toLowerCase() : null;

  const headersList = await headers();
  const host = headersList.get("host") || "";
  const urls = resolveUrls(host);

  const brands = await fetchTrustStripBrands(12);

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="text-center mb-10 md:mb-12">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-xs font-medium text-brand-700 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
            Invite-only — while we onboard 1-on-1
          </span>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Get started with distribute
          </h1>
          <p className="text-gray-500 max-w-xl mx-auto">
            We onboard each new user 1-on-1 so the platform stays high-signal.
            Either continue with your invite, or join the waitlist — both doors
            below.
          </p>
        </div>
        <GetStartedForm signUpUrl={urls.signUp} initialInvite={initialInvite} />
        <p className="text-center text-xs text-gray-400 mt-8 max-w-md mx-auto">
          💡 Skip the line: a friend already using distribute can share their
          invite link. They earn $25 credit, you start with $25 credit.
        </p>
        <TrustStrip brands={brands} />
      </div>
      <Footer />
    </main>
  );
}
