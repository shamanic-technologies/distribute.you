"use client";

import { createContext, useContext } from "react";

/** Opens the navigation drawer below `lg`, from any page's top bar. */
export const V2NavContext = createContext<() => void>(() => {});
export function useOpenV2Nav() {
  return useContext(V2NavContext);
}
