import Image from "next/image";
import type { ReactNode } from "react";
import { URLS } from "@distribute/content";

interface FooterProps {
  /** Optional context-specific note rendered at the bottom of the footer. */
  disclaimer?: ReactNode;
}

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

const COLUMNS: FooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Performance", href: "/performance" },
      { label: "Benchmarks", href: `${URLS.mcp}/benchmarks`, external: true },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation", href: URLS.docs, external: true },
      { label: "API reference", href: URLS.apiDocs, external: true },
      { label: "MCP server", href: URLS.mcp, external: true },
      { label: "GitHub", href: URLS.github, external: true },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Investors", href: "/investors" },
      { label: "Twitter / X", href: URLS.twitter, external: true },
      { label: "Sign in", href: URLS.signIn, external: true },
      { label: "Sign up", href: URLS.signUp, external: true },
    ],
  },
];

function FooterLinkItem({ link }: { link: FooterLink }) {
  if (link.external) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-gray-400 hover:text-white transition"
      >
        {link.label}
      </a>
    );
  }
  return (
    <a href={link.href} className="text-sm text-gray-400 hover:text-white transition">
      {link.label}
    </a>
  );
}

export function Footer({ disclaimer }: FooterProps) {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-gray-950 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        {/* Top brand block */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8 mb-12">
          <div className="max-w-md">
            <div className="flex items-center gap-2 mb-4">
              <Image
                src="/logo-head.jpg"
                alt="distribute"
                width={28}
                height={28}
                className="rounded-lg"
              />
              <a
                href="/"
                className="font-display font-bold text-white text-xl hover:text-brand-400 transition"
              >
                distribute
              </a>
              <span className="text-[10px] text-brand-400 font-medium bg-brand-500/10 px-1.5 py-0.5 rounded uppercase">
                beta
              </span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              AI outreach automation for solo founders and micro-SaaS builders. Drop
              a URL, set a budget, get qualified replies.
            </p>
            <p className="text-sm text-gray-500 leading-relaxed">
              Built by{" "}
              <a
                href="https://twitter.com/kevinlourd"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-300"
              >
                @kevinlourd
              </a>{" "}
              and contributors.
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-8 flex-1 md:max-w-2xl">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h4 className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-3">
                  {col.title}
                </h4>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={`${col.title}-${link.label}`}>
                      <FooterLinkItem link={link} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom strip */}
        <div className="border-t border-gray-900 pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-gray-600">
          <span>
            © {year} distribute. MIT License. 100% open source.
          </span>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <a href="/privacy" className="hover:text-gray-400 transition">
              Privacy
            </a>
            <a href="/terms" className="hover:text-gray-400 transition">
              Terms
            </a>
            <a href="https://status.distribute.you" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition">
              Status
            </a>
          </div>
        </div>

        {/* Optional context-specific disclaimer */}
        {disclaimer && (
          <div className="border-t border-gray-900 mt-6 pt-6 text-xs text-gray-600 leading-relaxed max-w-3xl">
            {disclaimer}
          </div>
        )}
      </div>
    </footer>
  );
}
