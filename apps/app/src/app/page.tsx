"use client";

import { useState } from "react";
import { OnboardingOverlay, type Brand } from "@/components/onboarding-overlay";
import { AppShell } from "@/components/app-shell";

const DEFAULT_BRAND: Brand = { name: "prompthub.ai", url: "https://prompthub.ai" };

export default function Page() {
  const [onboarded, setOnboarded] = useState(false);
  const [brand, setBrand] = useState<Brand>(DEFAULT_BRAND);
  // Bump on reset so the overlay remounts fresh at step 1.
  const [runId, setRunId] = useState(0);

  return (
    <>
      <OnboardingOverlay
        key={runId}
        hidden={onboarded}
        onComplete={(b) => { setBrand(b); setOnboarded(true); }}
      />
      <AppShell
        brand={brand}
        hidden={!onboarded}
        onReset={() => { setOnboarded(false); setRunId((n) => n + 1); }}
      />
    </>
  );
}
