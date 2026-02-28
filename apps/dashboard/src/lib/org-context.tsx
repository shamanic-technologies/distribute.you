"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAuthQuery } from "./use-auth-query";
import { listOrgs, type Org } from "./api";

interface OrgContextValue {
  org: Org | null;
  isLoading: boolean;
  hasOrg: boolean;
  isError: boolean;
}

const OrgContext = createContext<OrgContextValue>({
  org: null,
  isLoading: true,
  hasOrg: false,
  isError: false,
});

export function OrgContextProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, isError } = useAuthQuery(
    ["orgs"],
    (token) => listOrgs(token),
    { retry: 2 }
  );

  const org = data?.orgs?.[0] ?? null;

  return (
    <OrgContext.Provider value={{ org, isLoading, hasOrg: org !== null, isError }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}
