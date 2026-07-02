import Link from "next/link";
import { PROD_URLS } from "@/lib/env-urls";

export function DyFooter() {
  return (
    <footer className="dy-footer">
      <div className="dy-wrap">
        <div className="dy-ft-grid">
          <div className="dy-ft-brand">
            <Link href="/" className="dy-nav-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-distribute.svg" alt="distribute" className="dy-nav-logo-img" />
              distribute <span className="dy-nav-chip">beta</span>
            </Link>
            <p>Sales cold email outreach for solo founders and micro-SaaS operators. Drop a URL, set a budget, get qualified replies in Gmail.</p>
            <p className="dy-ft-by">Built by <a href="https://twitter.com/kevinlourd">@kevinlourd</a> and contributors.</p>
          </div>
          <div className="dy-ft-col">
            <h4>Product</h4>
            <ul>
              <li><Link href="/pricing">Pricing</Link></li>
              <li><Link href="/performance">Performance</Link></li>
              <li><Link href="/benchmarks">Benchmarks</Link></li>
              <li><Link href="/blog">Blog</Link></li>
            </ul>
          </div>
          <div className="dy-ft-col">
            <h4>Developers</h4>
            <ul>
              <li><a href={PROD_URLS.docs}>Documentation</a></li>
              <li><a href={PROD_URLS.apiDocs}>API reference</a></li>
              <li><a href={PROD_URLS.github}>GitHub</a></li>
            </ul>
          </div>
          <div className="dy-ft-col">
            <h4>Company</h4>
            <ul>
              <li><Link href="/investors">Investors</Link></li>
              <li><a href={PROD_URLS.twitter}>Twitter / X</a></li>
              <li><a href={PROD_URLS.signIn}>Sign in</a></li>
              <li><a href={PROD_URLS.signUp}>Sign up</a></li>
            </ul>
          </div>
        </div>
        <div className="dy-ft-bottom">
          <span className="dy-ft-copy">© 2026 distribute. MIT License. 100% open source.</span>
          <div className="dy-ft-links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
