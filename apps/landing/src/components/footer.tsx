import Image from "next/image";
import type { ReactNode } from "react";
import { COMPETITORS } from "@/lib/competitors";
import { PROD_URLS } from "@/lib/env-urls";

interface FooterProps {
  /** Optional context-specific note rendered under the columns. */
  disclaimer?: ReactNode;
}

/**
 * The homepage footer (`public/landing/index-v2.html`) for the React pages. The four
 * columns are the homepage's, in its order; the Compare column is read from the
 * competitor catalogue like every other footer on the apex, so a competitor added
 * there appears here without a second edit.
 */
const PRODUCT = [
  { label: "How it works", href: "/#how" },
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
];

const COMPANY = [
  { label: "About", href: "/about" },
  { label: "Investors", href: "/investors" },
  { label: "Contact", href: "/contact" },
  { label: "Blog", href: "/blog" },
];

const LEGAL = [
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Developers", href: "/developers" },
];

function Column({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h4 className="mb-3.5 text-[18px] tracking-[-0.02em] text-[#0a0a0a]">{title}</h4>
      <ul className="grid gap-2">
        {links.map((l) => (
          <li key={l.href}>
            <a href={l.href} className="text-sm text-[#6b6b6b] transition hover:text-[#0a0a0a]">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer({ disclaimer }: FooterProps) {
  const compare = [
    ...COMPETITORS.map((c) => ({ label: `distribute.you vs ${c.name}`, href: `/compare/${c.slug}` })),
    { label: "All comparisons", href: "/compare" },
    { label: "Alternatives", href: "/alternatives" },
  ];
  void PROD_URLS;
  return (
    <footer className="border-t border-[#ececec] bg-white text-[#6b6b6b]">
      <div className="mx-auto max-w-[1120px] px-6 py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <a href="/" className="inline-flex items-center gap-2 text-[20px] tracking-[-0.03em] text-[#0a0a0a]">
              <Image src="/landing/v2/assets/logo-mark.svg" alt="" width={26} height={26} className="rounded-md" />
              distribute.you
            </a>
            <p className="mt-3 max-w-[260px] text-sm text-[#6b6b6b]">
              The AI-native acquisition agency
            </p>
          </div>
          <Column title="Product" links={PRODUCT} />
          <Column title="Compare" links={compare} />
          <Column title="Company" links={COMPANY} />
          <Column title="Legal" links={LEGAL} />
        </div>
        <div className="mt-12 flex justify-between text-[13px] text-[#919191]">
          <span>© 2026 distribute.you</span>
        </div>
        {disclaimer && (
          <div className="mt-6 max-w-3xl border-t border-[#ececec] pt-6 text-xs leading-relaxed text-[#919191]">
            {disclaimer}
          </div>
        )}
      </div>
    </footer>
  );
}
