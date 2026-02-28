"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { LinkButton } from "./link-button";
import { Sidebar } from "./sidebar";
import { URLS } from "@mcpfactory/content";

export function DocsLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Close sidebar on route change
  if (typeof window !== "undefined") {
    // eslint-disable-next-line react-hooks/rules-of-hooks
  }

  return (
    <>
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-6">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo-head.jpg" alt="distribute" width={32} height={32} className="rounded-md" />
              <span className="font-display font-bold text-lg text-brand-600">
                distribute
              </span>
              <span className="text-gray-400 font-light hidden sm:inline">Docs</span>
            </Link>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <a
              href={URLS.landing}
              className="text-sm text-gray-600 hover:text-brand-600 transition hidden sm:block"
            >
              Home
            </a>
            <a
              href={URLS.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-600 hover:text-brand-600 transition hidden sm:block"
            >
              GitHub
            </a>
            <LinkButton
              href={URLS.signUp}
              external
              className="text-sm bg-brand-500 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-full font-medium hover:bg-brand-600 shadow-sm"
            >
              <span className="hidden sm:inline">Get Started</span>
              <span className="sm:hidden">Start</span>
            </LinkButton>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Mobile sidebar drawer */}
        <div className={`
          fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out md:hidden
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}>
          <div onClick={() => setSidebarOpen(false)}>
            <Sidebar />
          </div>
        </div>
        
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <Sidebar />
        </div>
        
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </>
  );
}
