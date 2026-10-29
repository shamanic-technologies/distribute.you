import Image from "next/image";
import { mobileMenu, navModel } from "@/lib/site-chrome";

/**
 * The homepage's floating pill nav for the React pages (investors, terms, privacy, blog).
 * It holds no link of its own: groups, links and buttons come from `navModel`
 * (`lib/site-chrome.ts`), the model the static pages render, so a page added to the
 * catalogue appears here too. Dropdowns open on hover and on focus (no script); below
 * 960px the links fold into a menu and the two actions stay, so an existing customer can
 * log in at every width.
 */
const TOP = "rounded-full px-3 py-2 text-[15px] text-[#333] transition hover:bg-[#fafafa] hover:text-[#0a0a0a]";
const MENU_LINK = "rounded-[10px] px-2.5 py-2 text-[15px] text-[#0a0a0a] hover:bg-[#fafafa]";

export function Navbar({ path = "" }: { path?: string }) {
  const m = navModel(path);
  const [primary, ...rest] = m.ctas;
  return (
    <div className="sticky top-3.5 z-50 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex h-[58px] w-full max-w-[1120px] items-center gap-1.5 rounded-full border border-[#ececec] bg-white/80 pl-4 pr-2.5 max-[640px]:h-[52px] max-[640px]:pl-3.5 max-[640px]:pr-2 shadow-[0_1px_2px_rgba(10,10,10,0.04),0_10px_30px_-18px_rgba(10,10,10,0.3)] backdrop-blur-xl">
        <a href="/" className="inline-flex shrink-0 items-center gap-2 text-[20px] tracking-[-0.03em] text-[#0a0a0a] max-[640px]:gap-[7px] max-[640px]:text-[17px]">
          <Image src="/landing/v2/assets/logo-mark.svg" alt="" width={26} height={26} className="rounded-md max-[640px]:h-[22px] max-[640px]:w-[22px]" />
          distribute.you
        </a>
        <nav className="ml-5 hidden items-center gap-0.5 min-[960px]:flex">
          {m.groups.map((g) => (
            <div key={g.label} className="group relative">
              <a href={g.href} aria-haspopup="true" className={`inline-flex items-center gap-1.5 ${TOP}`}>
                {g.label}
                <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" className="opacity-55 transition group-hover:rotate-180 group-focus-within:rotate-180 motion-reduce:transition-none">
                  <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <div className="invisible absolute left-[-8px] top-full z-[60] translate-y-1.5 pt-3 opacity-0 transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 motion-reduce:transition-none">
                <div
                  className={`rounded-[18px] border border-[#ececec] bg-white p-2 shadow-[0_1px_2px_rgba(10,10,10,0.04),0_24px_48px_-24px_rgba(10,10,10,0.35)] ${
                    g.featured ? "grid w-[560px] grid-cols-[1fr_200px] gap-2" : "w-[340px]"
                  }`}
                >
                  <div>
                    {g.items.map((i) => (
                      <a key={i.href + i.label} href={i.href} className="grid gap-0.5 rounded-xl px-3 py-2.5 transition hover:bg-[#fafafa]">
                        <b className="text-[15px] font-medium text-[#0a0a0a]">{i.label}</b>
                        {i.description && <span className="text-[13px] leading-snug text-[#6b6b6b]">{i.description}</span>}
                      </a>
                    ))}
                  </div>
                  {g.featured && (
                    <a href={g.featured.cta.href} className="grid content-end gap-1.5 rounded-xl border border-[#dbe6ff] bg-[#eef3ff] p-4">
                      <b className="text-[17px] font-medium tracking-[-0.02em] text-[#0a0a0a]">{g.featured.title}</b>
                      <span className="text-[13px] text-[#6b6b6b]">{g.featured.line}</span>
                      <em className="text-[14px] font-medium not-italic text-[#2563eb]">{g.featured.cta.label}</em>
                    </a>
                  )}
                  {g.extra && (
                    <div className="col-span-full mt-1.5 flex flex-wrap gap-0.5 border-t border-[#ececec] pt-2">
                      {g.extra.map((l) => (
                        <a key={l.href + l.label} href={l.href} className="rounded-xl px-2.5 py-1.5 text-[13px] text-[#6b6b6b] transition hover:bg-[#fafafa] hover:text-[#0a0a0a]">
                          {l.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {m.links.map((l) => (
            <a key={l.href} href={l.href} className={TOP}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <a
            href={m.signIn.href}
            className="inline-flex h-10 items-center whitespace-nowrap rounded-full px-4 text-[15px] font-medium text-[#333] transition hover:bg-[#fafafa] max-[640px]:px-2 max-[640px]:text-[14px]"
          >
            {m.signIn.label}
          </a>
          {rest.map((c) => (
            <a
              key={c.href}
              href={c.href}
              className="hidden h-10 items-center whitespace-nowrap rounded-full border border-[#e0e0e0] bg-white px-4 text-[15px] font-medium text-[#0a0a0a] transition hover:border-[#bbb] min-[1100px]:inline-flex"
            >
              {c.label}
            </a>
          ))}
          <a
            href={primary.href}
            className="inline-flex h-10 items-center whitespace-nowrap rounded-full bg-[#0a0a0a] px-4 text-[15px] font-medium text-white max-[640px]:px-3 max-[640px]:text-[14px] transition hover:bg-[#2563eb]"
          >
            {primary.label}
          </a>
          <details className="relative min-[960px]:hidden">
            <summary aria-label="Menu" className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full text-[#333] [&::-webkit-details-marker]:hidden max-[640px]:h-9 max-[640px]:w-9">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </summary>
            <nav className="absolute right-0 top-[calc(100%+12px)] max-h-[calc(100dvh-100px)] w-[min(320px,calc(100vw-32px))] overflow-y-auto rounded-[18px] border border-[#ececec] bg-white px-2 pb-3 pt-2 shadow-[0_24px_48px_-24px_rgba(10,10,10,0.35)]">
              {mobileMenu(m).map((g, gi) => (
                <div key={g.label ?? gi} className="grid border-b border-[#ececec] py-1.5 last:border-b-0">
                  {g.label && <p className="px-2.5 pb-0.5 pt-1.5 text-[13px] font-medium text-[#919191]">{g.label}</p>}
                  {g.links.map((i) => (
                    <a key={i.href} href={i.href} className={MENU_LINK}>
                      {i.label}
                    </a>
                  ))}
                </div>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </div>
  );
}
