"use client";

import { useState } from "react";
import { LinkButton } from "./link-button";
import { URLS } from "@mcpfactory/content";

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2">
          <span className="font-display font-bold text-xl text-gray-900">distribute</span>
          <span className="text-[10px] text-primary-500 font-medium bg-primary-50 px-1.5 py-0.5 rounded">.eu</span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <a
            href={URLS.docs}
            className="text-gray-500 hover:text-gray-900 text-sm transition"
          >
            Docs
          </a>
          <a
            href={URLS.signIn}
            className="text-gray-500 hover:text-gray-900 text-sm transition"
          >
            Sign In
          </a>
          <LinkButton
            href={URLS.signUp}
            className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition"
          >
            Get Started
          </LinkButton>
        </div>

        {/* Mobile nav */}
        <div className="flex md:hidden items-center gap-2">
          <LinkButton
            href={URLS.signUp}
            className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
          >
            Start
          </LinkButton>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="max-w-6xl mx-auto px-4 py-3 space-y-1">
            <a
              href={URLS.docs}
              className="block px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm"
            >
              Docs
            </a>
            <a
              href={URLS.signIn}
              className="block px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm"
            >
              Sign In
            </a>
            <div className="pt-2 border-t border-gray-100">
              <LinkButton
                href={URLS.signUp}
                className="w-full bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 text-center block"
              >
                Get Started
              </LinkButton>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
