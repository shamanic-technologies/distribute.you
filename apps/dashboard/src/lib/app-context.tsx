"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAuthQuery } from "./use-auth-query";
import { getApp, type App } from "./api";

interface AppContextValue {
  app: App | null;
  isLoading: boolean;
  hasApp: boolean;
  isError: boolean;
}

const AppContext = createContext<AppContextValue>({
  app: null,
  isLoading: true,
  hasApp: false,
  isError: false,
});

export function AppContextProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, isError } = useAuthQuery(
    ["app"],
    (token) => getApp(token),
    { retry: 2 }
  );

  const app = data?.app ?? null;

  return (
    <AppContext.Provider value={{ app, isLoading, hasApp: app !== null, isError }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
