"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listFeatures, type Feature } from "@/lib/api";

interface FeaturesContextValue {
  features: Feature[];
  isLoading: boolean;
  getFeature: (slug: string) => Feature | undefined;
}

const FeaturesContext = createContext<FeaturesContextValue>({
  features: [],
  isLoading: true,
  getFeature: () => undefined,
});

export function FeaturesProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useAuthQuery(
    ["features"],
    () => listFeatures(),
    { staleTime: 5 * 60 * 1000 },
  );

  const features = data?.features ?? [];

  const getFeature = (slug: string) => features.find((f) => f.slug === slug);

  return (
    <FeaturesContext.Provider value={{ features, isLoading, getFeature }}>
      {children}
    </FeaturesContext.Provider>
  );
}

export function useFeatures() {
  return useContext(FeaturesContext);
}
