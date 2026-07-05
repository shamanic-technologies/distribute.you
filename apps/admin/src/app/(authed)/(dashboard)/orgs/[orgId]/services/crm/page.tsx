import { GoogleCrmClient } from "./_components/google-crm-client";

interface PageProps {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Google CRM (staff console). The shell (header + OAuth-return banners) renders
 * server-side; all data (Gmail messages + Google contacts + connected accounts)
 * is client-side React Query — a local-first SWR surface: instant cached paint,
 * silent background revalidation, a background sync fired on open, plus the
 * manual "Sync now" button. See `GoogleCrmClient`.
 */
export default async function GoogleCrmPage({ params, searchParams }: PageProps) {
  await params;
  const sp = await searchParams;
  const connected = sp["connected"] === "1";
  const errorParam = typeof sp["error"] === "string" ? sp["error"] : null;

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">Google CRM</h1>
        <p className="text-gray-600">
          Connect Google to import Gmail messages and contacts into your CRM.
        </p>
      </div>

      {connected && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-4 text-sm">
          Connected successfully.
        </div>
      )}

      {errorParam && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          OAuth error: {errorParam}
        </div>
      )}

      <GoogleCrmClient />
    </div>
  );
}
