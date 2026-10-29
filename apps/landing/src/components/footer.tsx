import Image from "next/image";
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
      <h4 className="mb-3.5 text-[18px] tracking-[-0.02em] text-[#0a0a0a]">{title}</h4>
      <ul className="grid gap-0.5">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <a href={l.href} className="inline-block py-1 text-sm text-[#6b6b6b] transition hover:text-[#0a0a0a]">
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
    <footer className="border-t border-[#ececec] bg-white text-[#6b6b6b]">
      <div className="mx-auto max-w-[1120px] px-6 py-16">
        <div data-footer={m.variant} className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
          <div className="col-span-full flex flex-wrap items-center gap-x-6 gap-y-2">
            <a href="/" className="inline-flex items-center gap-2 text-[20px] tracking-[-0.03em] text-[#0a0a0a]">
              <Image src="/landing/v2/assets/logo-mark.svg" alt="" width={26} height={26} className="rounded-md" />
              distribute.you
            </a>
            <p className="text-sm text-[#6b6b6b]">{WHY}</p>
            {m.bridge && (
              <a href={m.bridge.href} className="text-sm font-medium text-[#2563eb] md:ml-auto">
                {m.bridge.label}
              </a>
            )}
          </div>
          {m.columns.map((c) => (
            <Column key={c.title} title={c.title} links={c.indexLinks ? [...indexLinks, ...c.links] : c.links} />
          ))}
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
