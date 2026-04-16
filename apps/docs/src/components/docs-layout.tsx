"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LinkButton } from "./link-button";
import { Sidebar } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { URLS } from "@distribute/content";

export function DocsLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50">
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
              <Image src="/logo-head.jpg" alt="distribute" width={28} height={28} className="rounded-lg" />
              <span className="font-bold text-base text-gray-900">distribute</span>
              <span className="text-[10px] text-brand-500 font-medium bg-brand-50 px-1.5 py-0.5 rounded uppercase hidden sm:inline">beta</span>
              <span className="text-gray-400 font-light text-sm hidden sm:inline ml-1">Docs</span>
            </Link>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <ThemeToggle />
            <a
              href={URLS.landing}
              className="text-sm text-gray-500 hover:text-gray-900 transition hidden sm:block"
            >
              Home
            </a>
            <a
              href={URLS.performance}
              className="text-sm text-gray-500 hover:text-gray-900 transition hidden md:block"
            >
              Performance
            </a>
            <a
              href={URLS.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-gray-900 transition hidden sm:block"
            >
              GitHub
            </a>
            <LinkButton
              href={URLS.signUp}
              external
              className="text-sm bg-gray-900 text-white px-3 md:px-5 py-1.5 md:py-2 rounded-lg font-medium hover:bg-gray-800 transition"
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
        <div className="hidden md:flex flex-shrink-0 overflow-hidden">
          <Sidebar />
        </div>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </>
  );
}
