"use client";

import Image from "next/image";
import Link from "next/link";
import { useClerk, useUser } from "@clerk/nextjs";
import { useState, useRef, useEffect } from "react";
import { MobileTenantChip } from "./tenant-switcher";
import { HeaderPageContext } from "./header-page-context";
import { ThemeToggle } from "./theme-toggle";
import { useMobileSidebar } from "./mobile-sidebar-context";
import { CHROME_ROW_HEIGHT } from "@/lib/chrome-row";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { MaturityBadge } from "./maturity-badge";

export function Header() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const isBeta = useIsBetaUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { toggle: toggleMobileSidebar } = useMobileSidebar();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      {/* A FIXED row height shared with the sidebar's tenant-switcher block
          (`CHROME_ROW_HEIGHT`). In the L-shaped shell the two sit side by side,
          so an auto height derived from whatever control happens to be tallest
          (`py-2.5` around a 36px account button ≈ 57px) never lines up with a
          hand-tuned sidebar value. One token, both rows, seam gone. */}
      <div className={`px-4 flex items-center justify-between ${CHROME_ROW_HEIGHT}`}>
        {/* Left: hamburger + tenant chip (mobile only) */}
        <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
          <button
            onClick={toggleMobileSidebar}
            className="md:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* The product mark, the wordmark and the breadcrumb do NOT live in the
              top bar. Tenant identity + switching sit at the top of the sidebar
              (`TenantSwitcher`), which is where the research put them — NN/g
              rates a breadcrumb useless at 2 levels, and Notion/Slack/Linear
              (single-product SaaS) carry no product logo in the bar at all. The
              bar keeps only universal actions (theme, account), per Atlassian.
              On mobile the sidebar is a drawer, so the chip carries identity and
              opens the same switcher menu.

              PAGE CONTEXT is the exception: a campaign has no name anywhere in
              the sidebar, and several sit under one brand, so the bar names the
              one you drilled into. It renders on campaign routes only. */}
          <MobileTenantChip />
          <HeaderPageContext />
        </div>

        {/* Right: User menu */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-50 transition"
            >
              {user?.imageUrl ? (
                <Image
                  src={user.imageUrl}
                  alt={user.firstName || "User"}
                  width={28}
                  height={28}
                  className="rounded-full"
                />
              ) : (
                <div className="w-7 h-7 bg-brand-100 rounded-full flex items-center justify-center">
                  <span className="text-brand-600 font-medium text-sm">
                    {user?.firstName?.[0] || "U"}
                  </span>
                </div>
              )}
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg border border-gray-200 shadow-xl py-1 z-[60]">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-700">{user?.fullName}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
                </div>
                {isBeta && (
                  <Link
                    href="/account"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                  >
                    Profile
                    <MaturityBadge level="beta" />
                  </Link>
                )}
                <button
                  onClick={() => signOut({ redirectUrl: "/sign-in" })}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition border-t border-gray-100"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
