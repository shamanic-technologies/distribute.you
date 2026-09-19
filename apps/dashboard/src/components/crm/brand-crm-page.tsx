"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { getCrmPipeline, listCrmConnections, listCrmContacts, type CrmConnection } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { MaturityBadge } from "@/components/maturity-badge";
import { DashboardPage } from "@/components/dashboard-page";
import { CrmContactsTable } from "@/components/crm/crm-contacts-table";
import { CrmPipelineBoard } from "@/components/crm/crm-pipeline-board";
import { friendlyDateTime } from "@/lib/friendly-datetime";

/** How many contacts one page of this table holds. */
const CONTACTS_PAGE = 200;

/**
 * The client's own CRM, read-only.
 *
 * BETA on both halves: the nav entry is gated in `context-sidebar.tsx` and the
 * body is gated here. A nav gate alone leaves the URL reachable by typing it,
 * which is not a gate but a hidden link.
 *
 * Everything on this page belongs to the CLIENT. It is not our pipeline, not our
 * cost and not our outcome, so nothing here is a metric of ours, nothing here is
 * re-derived from what crm-service serves, and nothing here writes back: no
 * service between here and their CRM has a write path to it.
 */
export function BrandCrmPage({ brandId }: { brandId: string }) {
  const isBeta = useIsBetaUser();
  const params = useParams<{ orgId?: string }>();
  const orgId = params?.orgId ?? null;

  const connQ = useAuthQuery(["crmConnections", brandId], () => listCrmConnections(brandId));
  const connection = connQ.data?.connections[0] ?? null;
  const live = Boolean(connection);

  const contactsQ = useAuthQuery(
    ["crmContacts", brandId],
    () => listCrmContacts(brandId, { limit: CONTACTS_PAGE }),
    { enabled: live },
  );
  const pipelineQ = useAuthQuery(["crmPipeline", brandId], () => getCrmPipeline(brandId), {
    enabled: live,
  });

  if (!isBeta) {
    return (
      <div className="p-4 md:p-8">
        <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center">
          <h1 className="text-base font-medium text-gray-900">Not available</h1>
          <p className="mt-1 text-sm text-gray-500">
            This page is still in beta and is not open on your account yet.
          </p>
        </div>
      </div>
    );
  }

  const settingsHref = orgId ? `/orgs/${orgId}/brands/${brandId}/settings#integrations` : null;
  // Reveal on SETTLE, never success-only: a failed read must state that rather
  // than hold a skeleton for ever.
  const connSettled = !connQ.isPending || connQ.isError;

  return (
    <DashboardPage width="wide">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">CRM</h1>
        <MaturityBadge level="beta" />
      </div>
      <p className="mb-8 text-sm text-gray-500">
        Your own customer records, read out of the system you already run on. Nothing here is
        written back to it.
      </p>

      {!connSettled ? (
        <div className="h-32 animate-pulse rounded-xl border border-gray-200 bg-gray-50" />
      ) : !connection ? (
        <NotConnected settingsHref={settingsHref} errored={connQ.isError} />
      ) : (
        <div className="space-y-10">
          <ConnectionHealth connection={connection} settingsHref={settingsHref} />

          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Pipeline</h2>
            {pipelineQ.isError ? (
              <Unavailable what="pipeline" />
            ) : pipelineQ.data ? (
              <CrmPipelineBoard view={pipelineQ.data} />
            ) : (
              <div className="h-40 animate-pulse rounded-xl border border-gray-200 bg-gray-50" />
            )}
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-baseline gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Contacts</h2>
              {contactsQ.data && contactsQ.data.contacts.length === CONTACTS_PAGE ? (
                // Says which rows the search below is searching, so nobody reads
                // "no match" as "this person is not in my CRM".
                <span className="text-xs text-gray-500">
                  showing the first {CONTACTS_PAGE}
                </span>
              ) : null}
            </div>
            {contactsQ.isError ? (
              <Unavailable what="contacts" />
            ) : contactsQ.data ? (
              <CrmContactsTable contacts={contactsQ.data.contacts} />
            ) : (
              <div className="h-40 animate-pulse rounded-xl border border-gray-200 bg-gray-50" />
            )}
          </section>
        </div>
      )}
    </DashboardPage>
  );
}

function Unavailable({ what }: { what: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
      <p className="text-sm text-gray-500">
        We could not read your {what} just now. It should come back on its own.
      </p>
    </div>
  );
}

function NotConnected({
  settingsHref,
  errored,
}: {
  settingsHref: string | null;
  errored: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      {errored ? (
        // "We could not check" is not "nothing is connected", and saying the
        // second would tell a connected customer their CRM had been dropped.
        <p className="text-sm text-gray-500">
          We could not check your connection just now. It should come back on its own.
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-700">
            Connect your CRM to read your contacts and your sales pipeline here.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Nothing on this page is written back to your CRM. It is read-only.
          </p>
          {settingsHref ? (
            <Link
              href={settingsHref}
              className="mt-4 inline-flex rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Connect your CRM
            </Link>
          ) : null}
        </>
      )}
    </div>
  );
}

function ConnectionHealth({
  connection,
  settingsHref,
}: {
  connection: CrmConnection;
  settingsHref: string | null;
}) {
  const paused = connection.status !== "active";
  const tone = connection.lastError
    ? "border-amber-200 bg-amber-50"
    : paused
      ? "border-gray-200 bg-gray-50"
      : "border-green-200 bg-green-50";
  const label = connection.lastError ? "Needs attention" : paused ? "Paused" : "Connected";

  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-gray-900">{label}</span>
        <span className="text-sm text-gray-600">
          {connection.synced && connection.lastSyncedAt
            ? `Last read ${friendlyDateTime(connection.lastSyncedAt)}`
            : "Waiting for the first read"}
        </span>
        {settingsHref ? (
          <Link href={settingsHref} className="ml-auto text-sm font-medium text-brand-600 hover:underline">
            Manage
          </Link>
        ) : null}
      </div>
      {connection.lastError ? (
        <p className="mt-2 text-sm text-amber-800">{connection.lastError}</p>
      ) : null}
    </div>
  );
}
