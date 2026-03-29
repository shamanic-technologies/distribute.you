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
  const { data, isLoading } = useAuthQuery(
    ["features"],
    () => listFeatures(),
    { staleTime: 5 * 60 * 1000 },
  );

  const { data: registryData, isLoading: registryLoading } = useAuthQuery(
    ["statsRegistry"],
    () => fetchStatsRegistry(),
    { staleTime: 10 * 60 * 1000 },
  );

  const features = data?.features ?? [];
  const registry = registryData?.registry ?? {};

  // URLs use dynasty slugs; match dynastySlug first, then versioned slug for internal lookups
  const getFeature = (slug: string) =>
    features.find((f) => f.dynastySlug === slug) ??
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
