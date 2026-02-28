"use client";

import Image from "next/image";
import Link from "next/link";
import { useClerk, useUser } from "@clerk/nextjs";
import { useState, useRef, useEffect } from "react";
import { BreadcrumbNav } from "./breadcrumb-nav";
import { useMobileSidebar } from "./mobile-sidebar-context";

export function Header() {
  const { signOut } = useClerk();
  const { user } = useUser();
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
      <div className="px-4 py-2.5 flex items-center justify-between">
        {/* Left: Hamburger + Logo + Breadcrumb */}
        <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
          {/* Mobile hamburger */}
          <button
            onClick={toggleMobileSidebar}
            className="md:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <Link href="/" className="flex items-center gap-2 pr-4 border-r border-gray-200">
            <Image src="/logo-head.jpg" alt="distribute" width={28} height={28} className="rounded-md" />
            <span className="font-display font-bold text-lg text-brand-600 hidden sm:block">distribute</span>
          </Link>

          <div className="hidden sm:block min-w-0 flex-1">
            <BreadcrumbNav />
          </div>
        </div>

        {/* Right: Docs + User menu */}
        <div className="flex items-center gap-3">
          <a
            href="https://docs.distribute.you"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-brand-600 transition hidden sm:block"
          >
            Docs
          </a>

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
                <button
                  onClick={() => signOut({ redirectUrl: "/sign-in" })}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
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
