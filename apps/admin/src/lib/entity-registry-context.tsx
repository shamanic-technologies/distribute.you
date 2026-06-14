"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { fetchEntityRegistry, type EntityRegistry } from "@/lib/api";

interface EntityRegistryContextValue {
  registry: EntityRegistry;
  isLoading: boolean;
}

const EntityRegistryContext = createContext<EntityRegistryContextValue>({
  registry: {},
  isLoading: true,
});

export function EntityRegistryProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useAuthQuery(
    ["entityRegistry"],
    () => fetchEntityRegistry(),
    { staleTime: 10 * 60 * 1000 },
  );

  const registry = data?.registry ?? {};

  return (
    <EntityRegistryContext.Provider value={{ registry, isLoading }}>
      {children}
    </EntityRegistryContext.Provider>
  );
}

export function useEntityRegistry() {
  return useContext(EntityRegistryContext);
}
