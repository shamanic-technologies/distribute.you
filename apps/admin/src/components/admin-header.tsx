"use client";

import { UserButton } from "@clerk/nextjs";

export function AdminHeader() {
  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0">
      <a href="/" className="text-lg font-bold text-gray-900">
        admin<span className="text-blue-600">.distribute.you</span>
      </a>
      <UserButton afterSignOutUrl="/" />
    </header>
  );
}
