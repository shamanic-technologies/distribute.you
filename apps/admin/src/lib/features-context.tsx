"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listFeatures, fetchStatsRegistry, type Feature, type StatsRegistry } from "@/lib/api";

interface FeaturesContextValue {
  features: Feature[];
  isLoading: boolean;
  getFeature: (slug: string) => Feature | undefined;
  registry: StatsRegistry;
  registryLoading: boolean;
}

const FeaturesContext = createContext<FeaturesContextValue>({
  features: [],
  isLoading: true,
  getFeature: () => undefined,
  registry: {},
  registryLoading: true,
});

export function FeaturesProvider({ children }: { children: ReactNode }) {
  // Expose loading via isPending, NOT isLoading. The org-consistency gate in
  // useAuthQuery disables these queries (enabled:false) until Clerk's active org
  // resolves and matches the URL org. A disabled v5 query reports isLoading:false
  // but isPending:true. Consumers gate "Feature not found" cards and skeletons on
  // these flags; sourcing them from isLoading would flash the not-found state
  // during the org-settle window. isPending stays true until each query resolves.
  const { data, isPending: isLoading } = useAuthQuery(
    ["features"],
    () => listFeatures(),
    { staleTime: 5 * 60 * 1000 },
  );

  const { data: registryData, isPending: registryLoading } = useAuthQuery(
    ["statsRegistry"],
    () => fetchStatsRegistry(),
    { staleTime: 10 * 60 * 1000 },
  );

  const features = data?.features ?? [];
  const registry = registryData?.registry ?? {};

  const getFeature = (slug: string) =>
    features.find((f) => f.slug === slug);

  return (
    <FeaturesContext.Provider value={{ features, isLoading, getFeature, registry, registryLoading }}>
      {children}
    </FeaturesContext.Provider>
  );
}

export function useFeatures() {
  return useContext(FeaturesContext);
}
