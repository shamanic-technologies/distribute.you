import Image from "next/image";
import Script from "next/script";
import type { ReactNode } from "react";
import { fetchIndexList } from "@/lib/fleet-indexes";
import { WHY, footerModel } from "@/lib/site-chrome";

interface FooterProps {
  /** Optional context-specific note rendered under the columns. */
  disclaimer?: ReactNode;
  /** The page's path: an outcome page gets its own variant, every other page the home one. */
  path?: string;
}

/**
 * The homepage footer for the React pages. It holds no link of its own: the columns come
 * from `footerModel` (`lib/site-chrome.ts`), which reads the page catalogue, the competitor
 * catalogue and the best-for list, exactly like the footer the static pages render.
 */
function Column({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h4 className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-[#b5b5b5]">{title}</h4>
      <ul className="grid gap-0.5">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <a href={l.href} className="inline-block py-1 text-sm text-[#b5b5b5] transition hover:text-white">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function Footer({ disclaimer, path = "" }: FooterProps) {
  const m = footerModel(path);
  // One link per index the service serves, read live like the rendered footers.
  const indexList = m.columns.some((c) => c.indexLinks) ? await fetchIndexList(3_000) : null;
  const indexLinks = (indexList?.indexes ?? []).map((i) => ({ label: i.name, href: `/indexes/${i.slug}` }));
  return (
    <footer
      className="relative isolate overflow-hidden bg-black pb-[clamp(120px,15vw,210px)] text-[#b5b5b5]"
      style={{ backgroundImage: "radial-gradient(rgba(225, 235, 245, 0.07) 0.8px, transparent 1.1px)", backgroundSize: "6px 6px" }}
    >
      {/* The dark closing chapter (treg.to): the dot field draws after hydration, the giant
          wordmark is cropped by the page edge. Same script as the static pages. */}
      <div className="relative z-[1] mx-auto max-w-[1120px] px-6 pt-16">
        <div data-footer={m.variant} className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
          <div className="col-span-full flex flex-wrap items-center gap-x-6 gap-y-2">
            <a href="/" className="inline-flex items-center gap-2 text-[20px] tracking-[-0.03em] text-[#f7f8f7]">
              <Image src="/landing/v2/assets/logo-mark.svg" alt="" width={26} height={26} className="rounded-md" />
              distribute.you
            </a>
            <p className="text-sm text-[#969696]">{WHY}</p>
            {m.bridge && (
              <a href={m.bridge.href} className="text-sm font-medium text-[#9db8ff] md:ml-auto">
                {m.bridge.label}
              </a>
            )}
          </div>
          {m.columns.map((c) => (
            <Column key={c.title} title={c.title} links={c.indexLinks ? [...indexLinks, ...c.links] : c.links} />
          ))}
        </div>
        <div className="mt-12 flex justify-between font-mono text-[12px] text-[#969696]">
          <span>© 2026 distribute.you</span>
        </div>
        {disclaimer && (
          <div className="mt-6 max-w-3xl border-t border-white/10 pt-6 text-xs leading-relaxed text-[#969696]">
            {disclaimer}
          </div>
        )}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-0.28em] left-1/2 -translate-x-1/2 select-none whitespace-nowrap text-[clamp(72px,14.5vw,230px)] font-medium leading-none tracking-[-0.04em] text-white/[0.05]"
      >
        distribute.you
      </div>
      <Script src="/landing/v2/footer-field.js?v=1" strategy="lazyOnload" />
    </footer>
  );
}
