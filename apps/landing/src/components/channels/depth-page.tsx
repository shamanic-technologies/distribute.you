import type { ReactNode } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

/**
 * The shell every channel-catalogue page renders inside.
 *
 * A page is a cross-section of the world: sky at the top where the fruit hangs,
 * soil at the bottom where a seed goes. The descent lives on this wrapper and
 * not on <body>, because the root layout owns <body> and is shared with pages
 * that are not a descent.
 *
 * The stylesheet is linked here rather than imported into globals so it costs
 * nothing on the pages that do not use it. React hoists the tag into <head>.
 */
export function DepthPage({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="/landing/css/depth.css?v=1" />
      <div className="depth">
        <Navbar />
        {children}
        <Footer />
      </div>
    </>
  );
}

/**
 * One band of the descent. `strata` is what re-skins everything inside it, so a
 * card in here needs no depth-specific class of its own.
 */
export function Stratum({
  strata,
  horizon,
  children,
  id,
}: {
  strata: "sky" | "canopy" | "branch" | "trunk" | "root" | "soil";
  /** Put this on the FIRST dark band of the page: it draws the crossing. */
  horizon?: boolean;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      data-strata={strata}
      className={`px-6 py-20 sm:py-24${horizon ? " horizon" : ""}`}
    >
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

/**
 * A figure and what it is. Reads its colours from whatever stratum it sits in,
 * which is the whole point of the token remap.
 */
export function Stat({
  value,
  label,
  hint,
}: {
  value: string;
  label: string;
  hint?: string;
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div
        className="text-3xl font-semibold tracking-tight"
        style={{ color: "var(--text)" }}
      >
        {value}
      </div>
      <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      {hint ? (
        <div className="mt-2 text-xs" style={{ color: "var(--faint)" }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The terminal call to action. It lives in the soil on every page, because the
 * last thing a reader meets is the ground they plant in.
 */
export function Seed({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="seed" href={href}>
      {children}
    </a>
  );
}
