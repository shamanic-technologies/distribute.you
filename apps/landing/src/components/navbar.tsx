"use client";

import { useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LinkButton } from "./link-button";
import { PROD_URLS } from "@/lib/env-urls";

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const urls = PROD_URLS;
  const links = [
    { label: "Pricing", href: urls.pricing },
    { label: "Performance", href: urls.performance },
    { label: "Benchmarks", href: urls.benchmarks },
    { label: "Docs", href: urls.docs },
  ];

  function isCurrent(href: string) {
    return href.startsWith("/") && pathname === href;
  }

  return (
    <nav className="dy-nav">
      <div className="dy-nav-inner">
        <a href="/" className="dy-nav-logo">
          <Image
            src="/landing/logo/logo-distribute.svg"
            alt="distribute"
            width={24}
            height={24}
            priority
          />
          <span>distribute</span>
          <span className="dy-chip">BETA</span>
        </a>

        <div className="dy-nav-links">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              aria-current={isCurrent(link.href) ? "page" : undefined}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="dy-nav-actions">
          <a href={urls.signIn} className="dy-button-ghost">
            Sign in
          </a>
          <LinkButton href={urls.signUp} className="dy-button-primary">
            Start free
          </LinkButton>
        </div>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="dy-nav-menu md:hidden"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {menuOpen && (
        <div className="dy-nav-mobile md:hidden">
          <div className="dy-shell space-y-1 py-3">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="block rounded-lg px-3 py-2 text-sm"
                aria-current={isCurrent(link.href) ? "page" : undefined}
              >
                {link.label}
              </a>
            ))}
            <a href={urls.signIn} className="block rounded-lg px-3 py-2 text-sm">
              Sign in
            </a>
            <div className="border-t border-[var(--dy-border-hi)] pt-3">
              <LinkButton
                href={urls.signUp}
                className="dy-button-primary w-full"
              >
                Start free
              </LinkButton>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
