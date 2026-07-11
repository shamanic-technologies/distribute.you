import Link from "next/link";
import { DyThemeToggle } from "./dy-theme-toggle";
import { DyNavScroll } from "./dy-nav-scroll";
import { PROD_URLS } from "@/lib/env-urls";

export function DyNav() {
  return (
    <>
      <DyNavScroll />
      <nav id="dy-nav" className="dy-nav">
        <div className="dy-nav-inner">
          <Link href="/" className="dy-nav-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-distribute.svg" alt="distribute" className="dy-nav-logo-img" />
            distribute <span className="dy-nav-chip">beta</span>
          </Link>
          <ul className="dy-nav-links">
            <li><Link href="/pricing">Pricing</Link></li>
            <li><Link href="/performance">Performance</Link></li>
            <li><Link href="/benchmarks">Benchmarks</Link></li>
          </ul>
          <div className="dy-nav-right">
            <DyThemeToggle />
            <a href={PROD_URLS.signIn} className="dy-btn dy-btn-g">Sign in</a>
            <a href={PROD_URLS.signUp} className="dy-btn dy-btn-p">Start free</a>
          </div>
        </div>
      </nav>
    </>
  );
}
