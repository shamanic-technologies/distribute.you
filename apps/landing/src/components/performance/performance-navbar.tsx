"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { resolveUrls } from "@/lib/env-urls";

export function PerformanceNavbar({ host }: { host: string }) {
  const urls = useMemo(() => resolveUrls(host), [host]);

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/performance" className="flex items-center gap-2 font-display font-bold text-xl text-gray-800">
            <Image src="/logo-head.jpg" alt="distribute" width={28} height={28} className="rounded-lg" />
            distribute <span className="text-brand-500">Performance</span>
          </Link>
          <div className="hidden md:flex items-center gap-4 text-sm">
            <Link href="/performance/brands" className="text-gray-600 hover:text-brand-600 transition">
              By Brand
            </Link>
            <Link href="/performance/models" className="text-gray-600 hover:text-brand-600 transition">
              By Workflow
            </Link>
            <Link href="/performance/prompts" className="text-gray-600 hover:text-brand-600 transition">
              By Prompt
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <a
            href="/"
            className="text-gray-500 hover:text-brand-600 transition"
          >
            distribute
          </a>
          <a
            href={urls.signUp}
            className="px-4 py-2 bg-brand-500 text-white rounded-full hover:bg-brand-600 transition text-sm font-medium"
          >
            Get Started
          </a>
        </div>
      </div>
    </nav>
  );
}
