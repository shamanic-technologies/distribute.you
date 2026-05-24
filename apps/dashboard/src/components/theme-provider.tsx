"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
}>({ theme: "light", toggle: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // Public report routes are client-facing and must render light regardless
    // of the operator's dashboard theme preference. The matching inline
    // <script> in app/layout.tsx already stripped the dark class for these
    // routes; this effect keeps it stripped and prevents the toggle UI (if
    // it ever ships on report) from flipping it back.
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/report/")) {
      document.documentElement.classList.remove("dark");
      setTheme("light");
      return;
    }
    const stored = localStorage.getItem("theme") as Theme | null;
    const initial = stored || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
