import { auth, currentUser } from "@clerk/nextjs/server";
import { ConnectGoogleButton } from "./_components/connect-google-button";
import { SyncNowButton } from "./_components/sync-now-button";
import { MessagesList, type MessagesPage, type GoogleMessage } from "./_components/messages-list";
import { ContactsList, type ContactsPage } from "./_components/contacts-list";
import type { GoogleContactRow } from "./_components/parse-google-contact";

const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const API_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;

interface GoogleAccount {
  email?: string;
  status?: string;
  scopes?: string[];
  connectedAt?: string;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}...` : s;
}

async function callApiService<T>(path: string): Promise<{ ok: true; data: T } | { ok: false; status: number; body: string }> {
  if (!API_KEY) {
    console.error("[dashboard] ADMIN_DISTRIBUTE_API_KEY not set");
    return { ok: false, status: 500, body: "API key not configured" };
  }
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { ok: false, status: 401, body: "Not authenticated" };
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
    "x-external-org-id": orgId,
    "x-external-user-id": userId,
  };
  const user = await currentUser();
  if (user) {
    const email = user.emailAddresses?.[0]?.emailAddress;
    if (email) headers["x-email"] = email;
    if (user.firstName) headers["x-first-name"] = user.firstName;
    if (user.lastName) headers["x-last-name"] = user.lastName;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, status: res.status, body };
  }
  const data = (await res.json()) as T;
  return { ok: true, data };
}

interface PageProps {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function GoogleCrmPage({ params, searchParams }: PageProps) {
  const { orgId } = await params;
  const sp = await searchParams;
  const connected = sp["connected"] === "1";
  const errorParam = typeof sp["error"] === "string" ? sp["error"] : null;

  void orgId;

  const [messagesRes, accountsRes, contactsRes] = await Promise.all([
    callApiService<MessagesPage>("/v1/orgs/google/messages?limit=50"),
    callApiService<{ accounts: GoogleAccount[] }>("/v1/orgs/google/accounts"),
    callApiService<ContactsPage>("/v1/orgs/google/contacts?limit=50"),
  ]);

  const accounts = accountsRes.ok ? accountsRes.data.accounts : [];
  const isConnected = accounts.length > 0;

  const messagesPage: MessagesPage = messagesRes.ok
    ? messagesRes.data
    : { items: [] as GoogleMessage[], nextCursor: null };

  const contactsPage: ContactsPage = contactsRes.ok
    ? contactsRes.data
    : { items: [] as GoogleContactRow[], nextCursor: null };

  const messagesLoadError =
    !messagesRes.ok && messagesRes.status !== 404 && messagesRes.status !== 401
      ? `Failed to load messages (${messagesRes.status}): ${truncate(messagesRes.body, 400)}`
      : null;
  const contactsLoadError =
    !contactsRes.ok && contactsRes.status !== 404 && contactsRes.status !== 401
      ? `Failed to load contacts (${contactsRes.status}): ${truncate(contactsRes.body, 400)}`
      : null;
  if (!messagesRes.ok) {
    console.error(
      "[dashboard] /v1/orgs/google/messages failed",
      messagesRes.status,
      messagesRes.body,
    );
  }
  if (!contactsRes.ok) {
    console.error(
      "[dashboard] /v1/orgs/google/contacts failed",
      contactsRes.status,
      contactsRes.body,
    );
  }
  if (!accountsRes.ok && accountsRes.status !== 404 && accountsRes.status !== 401) {
    console.error(
      "[dashboard] /v1/orgs/google/accounts failed",
      accountsRes.status,
      accountsRes.body,
    );
  }

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

      {messagesLoadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {messagesLoadError}
        </div>
      )}

      {contactsLoadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {contactsLoadError}
        </div>
      )}

      {!isConnected ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-2xl">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="font-medium text-gray-900 mb-1">Connect your Google account</h2>
          <p className="text-sm text-gray-500 mb-4">
            Authorize Distribute to read your Gmail messages and Google Contacts.
          </p>
          <ConnectGoogleButton />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 max-w-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-medium text-gray-900 mb-1">Connected accounts</h2>
                <ul className="space-y-1">
                  {accounts.map((acc, idx) => (
                    <li key={acc.email ?? `account-${idx}`} className="text-sm text-gray-700">
                      {acc.email !== undefined ? (
                        <code className="font-mono text-xs">{acc.email}</code>
                      ) : (
                        <span className="text-red-600 text-xs">
                          Account {idx} missing email field
                        </span>
                      )}
                      {acc.status !== undefined && (
                        <span className="ml-2 text-xs text-gray-500">{acc.status}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <SyncNowButton />
            </div>
          </div>

          <div>
            <h2 className="font-medium text-gray-900 mb-3">Recent Gmail messages</h2>
            <MessagesList initialPage={messagesPage} />
          </div>

          <div>
            <h2 className="font-medium text-gray-900 mb-3">Google contacts</h2>
            <ContactsList initialPage={contactsPage} />
          </div>
        </div>
      )}
    </div>
  );
}
