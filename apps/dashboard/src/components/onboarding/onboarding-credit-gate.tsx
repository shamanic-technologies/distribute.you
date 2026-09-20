"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { getBillingAccount } from "@/lib/api";

type CreditStatus = "loading" | "ready" | "error";

/**
 * The ONE route this gate may not run on, and the reason is the whole of it.
 *
 * `/onboarding/claim` is where an anonymous org is re-pointed at the identity
 * the person has just signed up with. Reading anything on the authenticated
 * path before that happens brings an org into being FOR that identity — the
 * gateway resolves (org, user) and client-service creates the row — so the
 * claim then finds its target identity already held and refuses
 * `external_id_taken`, permanently. Retrying cannot help: the row it collides
 * with is the one our own read created.
 *
 * This gate is not one of several racers. It renders a spinner INSTEAD of its
 * children, so its read always completes before the claim page has mounted:
 * the claim could never win. Measured in production 2026-09-20 — 28 anonymous
 * orgs, one claim, and that one a scripted probe with no gate above it. The
 * first real person to reach the claim lost ten minutes of setup to it.
 *
 * Skipping here loses nothing it was for: the welcome credit was seeded on the
 * anonymous org while they worked, and this route renders no step that spends.
 */
const CLAIM_PATH = "/onboarding/claim";

export function OnboardingCreditGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { organization, isLoaded } = useOrganization();
  const initializedOrgId = useRef<string | null>(null);
  const [status, setStatus] = useState<CreditStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const skip = pathname === CLAIM_PATH;

  useEffect(() => {
    if (skip) return;
    if (!isLoaded) return;
    if (!organization?.id) {
      setStatus("ready");
      return;
    }
    if (initializedOrgId.current === organization.id) {
      setStatus("ready");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    getBillingAccount()
      .then(() => {
        if (cancelled) return;
        initializedOrgId.current = organization.id;
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[dashboard] failed to initialize onboarding welcome credits:", err);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, isLoaded, organization?.id, skip]);

  if (skip || status === "ready") return <>{children}</>;

  if (status === "error") {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
        <p className="text-sm font-medium text-gray-900">Unable to initialize signup credits.</p>
        <p className="mt-1 max-w-sm text-sm text-gray-500">
          Please retry before continuing so AI setup has wallet credit available.
        </p>
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
    </div>
  );
}
