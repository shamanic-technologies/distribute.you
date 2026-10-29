"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";

/**
 * The docs body under the site's own nav: the section sidebar on the left (a drawer
 * below 768px), the page on the right. The site nav and footer come from the landing's
 * chrome (`app/docs/layout.tsx`), so the docs no longer carry a header of their own.
 */
export function DocsLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-7xl gap-2 px-4 pt-6">
      <div className="hidden md:block">
        <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto">
          <Sidebar />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-expanded={sidebarOpen}
          className="mb-2 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 md:hidden"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Docs menu
        </button>
        {sidebarOpen && (
          <div className="mb-4 md:hidden" onClick={() => setSidebarOpen(false)}>
            <Sidebar />
          </div>
        )}
        <main>{children}</main>
      </div>
    </div>
  );
}
