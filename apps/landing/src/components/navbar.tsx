import Image from "next/image";
import { PROD_URLS } from "@/lib/env-urls";

/**
 * The homepage's floating pill nav (`public/landing/index-v2.html`), for the React
 * pages that cannot be served from that HTML (investors, terms, privacy, blog). Same
 * links in the same order, same two actions on the right, and the same behaviour
 * below 960px: the links fold away and the two actions stay, so an existing customer
 * can log in at every width. Below 640px it takes the homepage's compact sizes too, or
 * the pill is wider than a 320px phone. No burger, because the homepage has none.
 */
const LINKS = [
  { label: "How it works", href: "/#how" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Compare", href: "/compare" },
  { label: "FAQ", href: "/#faq" },
];

export function Navbar() {
  const urls = PROD_URLS;
  return (
    <div className="sticky top-3.5 z-50 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex h-[58px] w-full max-w-[1120px] items-center gap-1.5 rounded-full border border-[#ececec] bg-white/80 pl-4 pr-2.5 max-[640px]:h-[52px] max-[640px]:pl-3.5 max-[640px]:pr-2 shadow-[0_1px_2px_rgba(10,10,10,0.04),0_10px_30px_-18px_rgba(10,10,10,0.3)] backdrop-blur-xl">
        <a href="/" className="inline-flex shrink-0 items-center gap-2 text-[20px] tracking-[-0.03em] text-[#0a0a0a] max-[640px]:gap-[7px] max-[640px]:text-[17px]">
          <Image src="/landing/v2/assets/logo-mark.svg" alt="" width={26} height={26} className="rounded-md max-[640px]:h-[22px] max-[640px]:w-[22px]" />
          distribute.you
        </a>
        <nav className="ml-5 hidden gap-0.5 min-[960px]:flex">
          {LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="rounded-full px-3 py-2 text-[15px] text-[#333] transition hover:bg-[#fafafa] hover:text-[#0a0a0a]"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <a
            href={urls.signIn}
            className="inline-flex h-10 items-center whitespace-nowrap rounded-full px-4 text-[15px] font-medium text-[#333] transition hover:bg-[#fafafa] max-[640px]:px-2 max-[640px]:text-[14px]"
          >
            Log in
          </a>
          <a
            href={urls.signUp}
            className="inline-flex h-10 items-center whitespace-nowrap rounded-full bg-[#0a0a0a] px-4 text-[15px] font-medium text-white max-[640px]:px-3 max-[640px]:text-[14px] transition hover:bg-[#2563eb]"
          >
            Start free
          </a>
        </div>
      </div>
    </div>
  );
}
