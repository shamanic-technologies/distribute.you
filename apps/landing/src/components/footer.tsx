import type { ReactNode } from "react";
import Image from "next/image";
import { URLS } from "@distribute/content";

interface FooterProps {
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
      { label: "Benchmarks", href: "/benchmarks" },
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
  return (
    <a
      href={link.href}
      target={link.external ? "_blank" : undefined}
      rel={link.external ? "noopener noreferrer" : undefined}
      className="text-sm"
    >
      {link.label}
    </a>
  );
}

export function Footer({ disclaimer }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="v2-footer">
      <div className="v2-footer-grid">
        <div>
          <a href="/" className="v2-nav-logo">
            <Image
              src="/landing-v2/logo/logo-distribute.svg"
              alt=""
              width={24}
              height={24}
            />
            <span>distribute</span>
            <span className="v2-chip">BETA</span>
          </a>
          <p className="mt-3 max-w-xs text-sm leading-7">
            AI cold email, done for you. Drop a URL, set a budget, get
            qualified replies.
          </p>
          <p className="v2-mono mt-3 text-sm">
            Built by{" "}
            <a href="https://twitter.com/kevinlourd" target="_blank" rel="noopener noreferrer">
              @kevinlourd
            </a>{" "}
            and contributors.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h4>{col.title}</h4>
            <ul>
              {col.links.map((link) => (
                <li key={`${col.title}-${link.label}`}>
                  <FooterLinkItem link={link} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="v2-footer-bottom">
        <span>© {year} distribute. MIT License. 100% open source.</span>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="https://status.distribute.you" target="_blank" rel="noopener noreferrer">
            Status
          </a>
        </div>
      </div>

      {disclaimer && (
        <div className="v2-shell border-t border-[var(--v2-border)] py-5 text-xs leading-relaxed">
          {disclaimer}
        </div>
      )}
    </footer>
  );
}
