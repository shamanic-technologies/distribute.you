import Image from "next/image";
import type { ReactNode } from "react";
import { URLS } from "@distribute/content";
import { StatusIndicator } from "./status-indicator";

interface FooterProps {
  disclaimer?: ReactNode;
}

export function Footer({ disclaimer }: FooterProps) {
  return (
    <footer className="bg-gray-950 text-gray-500 py-10 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Image src="/logo-head.jpg" alt="distribute" width={24} height={24} className="rounded-lg" />
          <a href="/" className="font-display font-bold text-white text-lg hover:text-brand-400 transition">
            distribute
          </a>
          <span className="text-[10px] text-brand-400 font-medium bg-brand-500/10 px-1.5 py-0.5 rounded uppercase">
            beta
          </span>
        </div>
        <p className="text-sm text-gray-600 mb-4">The Stripe of Distribution</p>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          <a href="/pricing" className="hover:text-gray-300 transition">Pricing</a>
          <a href="/performance" className="hover:text-gray-300 transition">Performance</a>
          <a href="/blog" className="hover:text-gray-300 transition">Blog</a>
          <a href={URLS.docs} className="hover:text-gray-300 transition">Docs</a>
          <a href={URLS.apiDocs} className="hover:text-gray-300 transition">API</a>
          <a
            href={URLS.github}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-300 transition"
          >
            GitHub
          </a>
          <a href="/investors" className="hover:text-gray-300 transition">Investors</a>
        </div>
        <div className="flex justify-center mt-5">
          <StatusIndicator />
        </div>
        <div className="mt-6 pt-6 border-t border-gray-800">
          <p className="text-xs text-gray-600 mb-3">Also by our team</p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
            <a
              href="https://pressbeat.io"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-300 transition"
            >
              PressBeat.io — Organic Press on Demand
            </a>
            <a
              href="https://growthagency.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-300 transition"
            >
              GrowthAgency.dev — Growth Agency for Humans
            </a>
            <a
              href="https://growthservice.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-300 transition"
            >
              GrowthService.org — Increase AI Search Ranking
            </a>
          </div>
        </div>
        <p className="text-xs mt-4 text-gray-700">MIT License. Open Source.</p>
        {disclaimer && (
          <p className="text-xs mt-4 text-gray-700 max-w-2xl mx-auto">{disclaimer}</p>
        )}
      </div>
    </footer>
  );
}
