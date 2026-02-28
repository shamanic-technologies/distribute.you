import Image from "next/image";
import Link from "next/link";
import { LinkButton } from "./link-button";
import { URLS } from "@distribute/content";

export function Header() {
  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-head.jpg" alt="distribute" width={32} height={32} className="rounded-md" />
            <span className="font-display font-bold text-lg text-brand-600">
              distribute
            </span>
            <span className="text-gray-400 font-light">Docs</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <a
            href={URLS.landing}
            className="text-sm text-gray-600 hover:text-brand-600 transition"
          >
            Home
          </a>
          <a
            href={URLS.apiDocs}
            className="text-sm text-gray-600 hover:text-brand-600 transition"
          >
            API Reference
          </a>
          <a
            href={URLS.github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-600 hover:text-brand-600 transition"
          >
            GitHub
          </a>
          <LinkButton
            href={URLS.signUp}
            external
            className="text-sm bg-brand-500 text-white px-4 py-2 rounded-full font-medium hover:bg-brand-600 shadow-sm"
          >
            Get Started
          </LinkButton>
        </div>
      </div>
    </header>
  );
}
