"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAuthQuery } from "./use-auth-query";
import { getApp, type App } from "./api";

interface AppContextValue {
  app: App | null;
  isLoading: boolean;
  hasApp: boolean;
}

const AppContext = createContext<AppContextValue>({
  app: null,
  isLoading: true,
  hasApp: false,
});

export function AppContextProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useAuthQuery(
    ["app"],
    (token) => getApp(token)
  );

  const app = data?.app ?? null;

  return (
    <AppContext.Provider value={{ app, isLoading, hasApp: app !== null }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
