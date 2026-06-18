"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ReportSidebar } from "./sidebar";

interface MobileNavProps {
  basePath: string;
  featureSlug: string;
}

export function MobileNav({ basePath, featureSlug }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the user navigates. Without this, tapping a
  // link inside the drawer would leave the overlay covering the new page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open so the underlying page can't
  // be scrolled behind the overlay (iOS Safari quirk: a position:fixed
  // overlay still lets touch-scroll fall through without this guard).
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition flex-shrink-0"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Always-mounted overlay + drawer: pointer-events + translate are
          toggled so we get a CSS transition rather than a hard pop. */}
      <div
        className={`md:hidden fixed inset-0 z-50 ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div
          className={`absolute inset-0 bg-gray-900/40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
          onClick={() => setOpen(false)}
        />
        <div
          className={`relative h-full w-44 transform transition-transform duration-200 ease-out ${open ? "translate-x-0" : "-translate-x-full"}`}
        >
          <ReportSidebar basePath={basePath} featureSlug={featureSlug} />
        </div>
      </div>
    </>
  );
}
