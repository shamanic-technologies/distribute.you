"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useOrganization } from "@clerk/nextjs";
import { getBillingAccount } from "@/lib/api";

type CreditStatus = "loading" | "ready" | "error";

export function OnboardingCreditGate({ children }: { children: ReactNode }) {
  const { organization, isLoaded } = useOrganization();
  const initializedOrgId = useRef<string | null>(null);
  const [status, setStatus] = useState<CreditStatus>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
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
  }, [attempt, isLoaded, organization?.id]);

  if (status === "ready") return <>{children}</>;

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
