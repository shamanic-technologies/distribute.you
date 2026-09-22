"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  connectCrm,
  disconnectCrm,
  deleteBrandKey,
  listBrandKeys,
  listCrmConnections,
  setBrandKey,
  type CrmConnection,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { MaturityBadge } from "@/components/maturity-badge";
import { CompanyLogo } from "@/components/company-logo";
import { INTEGRATIONS, missingFields, type IntegrationDef } from "@/lib/integrations";
import {
  connectErrorMessage,
  credentialErrorMessage,
  disconnectErrorMessage,
} from "@/lib/integration-write";

/**
 * The third-party accounts a brand has connected.
 *
 * BETA, and gated as a SUB-ELEMENT of a GA page: the section disappears for
 * everyone else and the badge rides the heading it does render. Gating the whole
 * Settings page would hide surfaces that are GA.
 *
 * CONNECTING IS TWO WRITES, and it is worth knowing why rather than folding them:
 * the credential goes to key-service (the fleet's credential store, which owns
 * every third-party secret) and the connection goes to crm-service, which then
 * resolves that credential itself and PROVES it against the vendor before it
 * writes anything. So a wrong token is refused at connect time, in the vendor's
 * own words, instead of failing quietly on the first sync. A credential stored
 * without a successful connect is inert, and reconnecting overwrites it.
 */
export function BrandIntegrationsCard({ brandId }: { brandId: string }) {
  const isBeta = useIsBetaUser();
  if (!isBeta) return null;
  return <IntegrationsSection brandId={brandId} />;
}

function IntegrationsSection({ brandId }: { brandId: string }) {
  const queryClient = useQueryClient();
  const params = useParams<{ orgId?: string }>();
  const orgId = params?.orgId ?? null;

  const keysQ = useAuthQuery(["brandKeys", brandId], () => listBrandKeys(brandId));
  const connQ = useAuthQuery(["crmConnections", brandId], () => listCrmConnections(brandId));

  const storedProviders = new Set((keysQ.data?.keys ?? []).map((k) => k.provider));
  const connections = connQ.data?.connections ?? [];
  // Reveal on SETTLE, never success-only: a failed read must degrade to the rows
  // reading "not connected" rather than skeleton for ever.
  const settled =
    (!keysQ.isPending || keysQ.isError) && (!connQ.isPending || connQ.isError);

  return (
    <section id="integrations" className="mb-10 scroll-mt-24">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>
        <MaturityBadge level="beta" />
      </div>
      <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
        {INTEGRATIONS.map((def) => (
          <IntegrationRow
            key={def.slug}
            def={def}
            brandId={brandId}
            orgId={orgId}
            settled={settled}
            credentialStored={storedProviders.has(def.slug)}
            connection={connections[0] ?? null}
            onChanged={() => {
              queryClient.invalidateQueries({ queryKey: ["brandKeys", brandId] });
              queryClient.invalidateQueries({ queryKey: ["crmConnections", brandId] });
            }}
          />
        ))}
      </div>
    </section>
  );
}

function StatusPill({
  settled,
  connection,
  credentialStored,
}: {
  settled: boolean;
  connection: CrmConnection | null;
  credentialStored: boolean;
}) {
  if (!settled) {
    return <span className="h-5 w-24 animate-pulse rounded-full bg-gray-100" />;
  }
  if (connection) {
    const paused = connection.status !== "active";
    const cfg = paused
      ? { box: "border-gray-200 bg-gray-50 text-gray-600", label: "Paused" }
      : connection.lastError
        ? { box: "border-amber-200 bg-amber-50 text-amber-700", label: "Needs attention" }
        : { box: "border-green-200 bg-green-50 text-green-700", label: "Connected" };
    return (
      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.box}`}>
        {cfg.label}
      </span>
    );
  }
  if (credentialStored) {
    // The honest middle state: the key landed, the connection did not. Saying
    // "not connected" would hide a credential the customer already gave us.
    return (
      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        Not finished
      </span>
    );
  }
  return (
    <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">
      Not connected
    </span>
  );
}

function IntegrationRow({
  def,
  brandId,
  orgId,
  settled,
  credentialStored,
  connection,
  onChanged,
}: {
  def: IntegrationDef;
  brandId: string;
  orgId: string | null;
  settled: boolean;
  credentialStored: boolean;
  connection: CrmConnection | null;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const connect = useMutation({
    mutationFn: async () => {
      // 1. The credential, to the store that owns credentials.
      try {
        await setBrandKey(brandId, def.slug, values.token ?? "");
      } catch (err) {
        console.error("[integrations] storing the credential failed", err);
        throw new Error(credentialErrorMessage(err));
      }
      // 2. The connection. crm-service resolves the credential it was just given
      //    and proves it against the vendor, so THIS is what can refuse.
      try {
        return await connectCrm(brandId, values.locationId ?? "");
      } catch (err) {
        console.error("[integrations] connecting failed", err);
        throw new Error(connectErrorMessage(err));
      }
    },
    onSuccess: () => {
      setOpen(false);
      setValues({});
      setError(null);
      onChanged();
    },
    onError: (err: Error) => setError(err.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (connection) {
        try {
          await disconnectCrm(connection.id, brandId);
        } catch (err) {
          console.error("[integrations] disconnecting failed", err);
          const msg = disconnectErrorMessage(err);
          if (msg) throw new Error(msg);
        }
      }
      await deleteBrandKey(brandId, def.slug).catch((err) => {
        // The connection is already gone by here, which is what was asked for.
        // A credential left behind is inert and is overwritten on reconnect, so
        // this is logged loudly rather than shown as a failure of the action.
        console.error("[integrations] removing the credential failed", err);
      });
    },
    onSuccess: () => {
      setConfirmingRemove(false);
      setError(null);
      onChanged();
    },
    onError: (err: Error) => setError(err.message),
  });

  const blocked = missingFields(def, values);
  const busy = connect.isPending || remove.isPending;

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white p-1">
          <CompanyLogo domain={def.domain} name={def.name} size={28} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-900">{def.name}</span>
            <StatusPill settled={settled} connection={connection} credentialStored={credentialStored} />
          </div>
          <p className="mt-0.5 text-sm text-gray-500">{def.blurb}</p>

          {connection?.lastError ? (
            <p className="mt-2 text-sm text-amber-700">{connection.lastError}</p>
          ) : null}

          {connection && orgId ? (
            <Link
              href={`/orgs/${orgId}/brands/${brandId}/crm`}
              className="mt-2 inline-flex text-sm font-medium text-brand-600 hover:underline"
            >
              Open your {def.surfaceLabel}
            </Link>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {connection || credentialStored ? (
            confirmingRemove ? (
              <>
                <button
                  type="button"
                  onClick={() => remove.mutate()}
                  disabled={busy}
                  className={`rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 ${busy ? "cursor-wait" : "hover:bg-red-100"}`}
                >
                  {remove.isPending ? "Removing..." : "Yes, disconnect"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(false)}
                  className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Keep it
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingRemove(true)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Disconnect
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              {open ? "Cancel" : "Connect"}
            </button>
          )}
        </div>
      </div>

      {confirmingRemove ? (
        <p className="mt-3 text-sm text-gray-600">
          This stops the syncing and removes what we mirrored. Nothing in your{" "}
          {def.name} account changes.
        </p>
      ) : null}

      {open ? (
        <form
          className="mt-4 space-y-4 border-t border-gray-100 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            connect.mutate();
          }}
        >
          {def.fields.map((f) => (
            <label key={f.key} className="block">
              <span className="text-sm font-medium text-gray-700">{f.label}</span>
              <input
                type={f.secret ? "password" : "text"}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                autoComplete="off"
                spellCheck={false}
                className="mt-1 w-full max-w-md rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-300/40"
              />
              <span className="mt-1 block text-xs text-gray-500">{f.help}</span>
            </label>
          ))}

          <p className="text-xs text-gray-500">
            <a
              href={def.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand-600 hover:underline"
            >
              Where to find these in {def.name}
            </a>
          </p>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={blocked.length > 0 || busy}
              className={`rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white ${
                busy ? "cursor-wait" : "hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed"
              }`}
            >
              {connect.isPending ? "Checking with " + def.name + "..." : "Connect"}
            </button>
            {blocked.length > 0 ? (
              <span className="text-xs text-gray-500">
                Still needed: {blocked.map((f) => f.label).join(", ")}
              </span>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
