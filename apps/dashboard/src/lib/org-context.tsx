"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useOrganization } from "@clerk/nextjs";

interface OrgContextValue {
  org: { id: string; name: string } | null;
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
  const { organization, isLoaded } = useOrganization();

  const org = organization
    ? { id: organization.id, name: organization.name }
    : null;

  return (
    <OrgContext.Provider
      value={{ org, isLoading: !isLoaded, hasOrg: org !== null, isError: false }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}
