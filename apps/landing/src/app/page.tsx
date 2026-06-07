import type { Metadata } from "next";
import { DyNav } from "@/components/dy-nav";
import { DyFooter } from "@/components/dy-footer";
import { DyReveal } from "@/components/dy-reveal";
import { PROD_URLS } from "@/lib/env-urls";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "distribute: AI outreach automation for solo founders | $1.42/reply",
  description: "Add your product URL, set a budget. We find prospects, write cold emails, qualify replies, and forward only the ones worth your time. $25 free.",
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What does distribute do?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "distribute runs sales cold email outreach for you. Add your URL and budget; we find prospects, write emails, send sequences, qualify replies with AI, and forward qualified buyers to Gmail.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need a sending domain or warmed mailbox?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. distribute handles sending infrastructure, prospect sourcing, copy generation, deliverability monitoring, reply triage, and campaign reporting.",
      },
    },
    {
      "@type": "Question",
      name: "How much does it cost to start?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "$25 welcome credits. No subscription. You set the campaign budget before launch and see the exact unit cost breakdown in the dashboard.",
      },
    },
  ],
};

export default function HomePage() {
  return (
    <div className="dy-root">
      <DyReveal />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <a className="dy-skip-link" href="#main-content" style={{ position: "absolute", top: "-100%", left: "1rem", background: "var(--dy-accent)", color: "white", padding: "0.5rem 1.25rem", borderRadius: "0 0 var(--dy-r-md) var(--dy-r-md)", fontWeight: 600, fontSize: "var(--dy-fs-base)", textDecoration: "none", zIndex: 9999 }}>Skip to main content</a>

      <DyNav />

      {/* HERO */}
      <section className="dy-hero">
        <div className="dy-hero-bg" aria-hidden />
        <div className="dy-hero-noise" aria-hidden />

        <div className="dy-wrap">
          <div className="dy-hero-content">
            <div className="dy-hero-eyebrow t-lbl dy-a1">
              <span className="dy-hero-dot" aria-hidden />
              Built for solo founders and micro-SaaS builders
            </div>

            <h1 className="t-hero dy-a2">
              You build.<br />We distribute.
            </h1>

            <p className="dy-hero-sub dy-a3">
              Add your product URL, set a budget. We find the prospects, write the cold emails, send the campaigns, qualify every reply, and forward only the ones worth your time.
            </p>

            <div className="dy-hero-actions dy-a4">
              <a href={PROD_URLS.signUp} className="dy-btn dy-btn-p dy-btn-lg">Start free, $25 credits</a>
              <a href={PROD_URLS.docs} className="dy-btn dy-btn-g dy-btn-lg">Read the docs</a>
            </div>
            <p className="dy-hero-note dy-a4">No subscription. No credit card.</p>
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="dy-wrap dy-hero-dash-wrap">
          <div className="dy-hero-ui-outer dy-a5">
            <div className="dy-hero-ui-glow" aria-hidden />

            <div className="dy-hero-ui" role="img" aria-label="distribute dashboard showing campaign performance across multiple products">
              {/* Sidebar */}
              <nav className="dy-uid-sidebar" aria-hidden>
                <div className="dy-uid-logo">
                  <span style={{ width: "1.25rem", height: "1.25rem", borderRadius: "0.25rem", background: "var(--dy-accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: "0.8rem", letterSpacing: "-0.03em" }}>D</span>
                  <span className="dy-uid-logo-name">distribute</span>
                </div>
                <ul className="dy-uid-nav">
                  <li className="dy-active">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg>
                    Dashboard
                  </li>
                  <li>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8h12M8 2v12" /><circle cx="8" cy="8" r="6" /></svg>
                    Campaigns
                    <span className="dy-uid-badge-count">8</span>
                  </li>
                  <li>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M5 7h6M5 10h4" /></svg>
                    Products
                  </li>
                  <li>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="5" cy="8" r="2" /><circle cx="11" cy="4" r="2" /><circle cx="11" cy="12" r="2" /><path d="M7 7.5l2.5-2.5M7 8.5l2.5 2.5" /></svg>
                    Channels
                  </li>
                  <li>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 12l3-5 3 3 2-4 4 6" /></svg>
                    Analytics
                  </li>
                  <li>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5" /><path d="M5 6h6M5 9h4" /></svg>
                    Billing
                  </li>
                </ul>
                <ul className="dy-uid-nav dy-uid-sidebar-footer">
                  <li>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6" /><path d="M8 5v4l2 2" /></svg>
                    Settings
                  </li>
                  <li>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6" /><path d="M8 7v1m0 3h.01" /></svg>
                    Help
                  </li>
                </ul>
                <div className="dy-uid-upgrade">
                  <div className="dy-uid-upgrade-title">Scale your outreach</div>
                  <div className="dy-uid-upgrade-sub">Get unlimited channels and priority processing.</div>
                  <button type="button" className="dy-uid-upgrade-btn">Upgrade plan</button>
                </div>
              </nav>

              {/* Main */}
              <div className="dy-uid-main" aria-hidden>
                <div className="dy-uid-topbar">
                  <span className="dy-uid-topbar-title">Campaigns</span>
                  <div className="dy-uid-topbar-right">
                    <div className="dy-uid-date-pill">
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="12" rx="1.5" /><path d="M5 2v2M11 2v2M2 7h12" /></svg>
                      Jan 1 to Jun 6, 2025
                    </div>
                    <div className="dy-uid-live">
                      <span className="dy-uid-live-dot" />
                      live
                    </div>
                    <button type="button" className="dy-uid-tb-btn dy-primary">+ New campaign</button>
                    <button type="button" className="dy-uid-tb-btn">↓ Export</button>
                  </div>
                </div>

                <div className="dy-uid-kpis">
                  <div className="dy-uid-kpi">
                    <div className="dy-uid-kpi-lbl">Emails sent</div>
                    <div className="dy-uid-kpi-row">
                      <span className="dy-uid-kpi-n">12,400</span>
                      <div className="dy-uid-kpi-icon">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4l6 5 6-5" /><rect x="2" y="4" width="12" height="9" rx="1.5" /></svg>
                      </div>
                    </div>
                    <div>
                      <span className="dy-uid-kpi-delta dy-up">+18.2%</span>
                      <span className="dy-uid-kpi-vs">vs last period</span>
                    </div>
                  </div>
                  <div className="dy-uid-kpi">
                    <div className="dy-uid-kpi-lbl">Qualified replies</div>
                    <div className="dy-uid-kpi-row">
                      <span className="dy-uid-kpi-n">239</span>
                      <div className="dy-uid-kpi-icon">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8l3 3 7-7" /></svg>
                      </div>
                    </div>
                    <div>
                      <span className="dy-uid-kpi-delta dy-up">+12.1%</span>
                      <span className="dy-uid-kpi-vs">vs last period</span>
                    </div>
                  </div>
                  <div className="dy-uid-kpi">
                    <div className="dy-uid-kpi-lbl">Active products</div>
                    <div className="dy-uid-kpi-row">
                      <span className="dy-uid-kpi-n">8</span>
                      <div className="dy-uid-kpi-icon">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg>
                      </div>
                    </div>
                    <div>
                      <span className="dy-uid-kpi-delta dy-up">+3</span>
                      <span className="dy-uid-kpi-vs">this month</span>
                    </div>
                  </div>
                  <div className="dy-uid-kpi">
                    <div className="dy-uid-kpi-lbl">Avg cost / reply</div>
                    <div className="dy-uid-kpi-row">
                      <span className="dy-uid-kpi-n">$1.42</span>
                      <div className="dy-uid-kpi-icon" style={{ background: "var(--dy-green-dim)" }}>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--dy-green)" }}><path d="M12 4l-8 8M12 4H7M12 4v5" /></svg>
                      </div>
                    </div>
                    <div>
                      <span className="dy-uid-kpi-delta dy-up" style={{ background: "var(--dy-green-dim)", color: "var(--dy-green)" }}>-8.3%</span>
                      <span className="dy-uid-kpi-vs">vs last period</span>
                    </div>
                  </div>
                </div>

                <div className="dy-uid-body">
                  <div className="dy-uid-chart-area">
                    <div className="dy-uid-chart-head">
                      <span className="dy-uid-chart-title">Qualified replies over time</span>
                      <span className="dy-uid-chart-total">239 total · Jun 2025</span>
                    </div>
                    <div className="dy-uid-chart-tooltip">
                      Jun 1, 2025 &nbsp;·&nbsp; <strong>48 replies</strong> this month &nbsp;·&nbsp; 31 last month
                    </div>
                    <svg className="dy-uid-chart-svg" viewBox="0 0 560 100" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="dyChartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" style={{ stopColor: "var(--dy-accent)", stopOpacity: 0.25 }} />
                          <stop offset="100%" style={{ stopColor: "var(--dy-accent)", stopOpacity: 0 }} />
                        </linearGradient>
                      </defs>
                      <line x1="0" y1="25" x2="560" y2="25" style={{ stroke: "var(--dy-border)", strokeWidth: 0.5 }} />
                      <line x1="0" y1="50" x2="560" y2="50" style={{ stroke: "var(--dy-border)", strokeWidth: 0.5 }} />
                      <line x1="0" y1="75" x2="560" y2="75" style={{ stroke: "var(--dy-border)", strokeWidth: 0.5 }} />
                      <path d="M0,95 C30,93 55,90 80,86 C115,80 135,72 160,66 C200,56 225,48 255,40 C295,30 330,22 370,16 C410,10 450,7 490,5 C515,3 540,2 560,2 L560,100 L0,100 Z" fill="url(#dyChartGrad)" />
                      <path d="M0,95 C30,93 55,90 80,86 C115,80 135,72 160,66 C200,56 225,48 255,40 C295,30 330,22 370,16 C410,10 450,7 490,5 C515,3 540,2 560,2" fill="none" style={{ stroke: "var(--dy-accent)", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" }} />
                      <circle cx="490" cy="5" r="3" style={{ fill: "var(--dy-accent)", stroke: "var(--dy-surface)", strokeWidth: 2 }} />
                      <path d="M0,100 C30,98 80,94 160,86 C240,78 330,65 420,45 C480,33 530,25 560,20" fill="none" style={{ stroke: "var(--dy-border-hi)", strokeWidth: 1, strokeDasharray: "4 3" }} />
                    </svg>
                    <div className="dy-uid-chart-x">
                      <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
                    </div>
                  </div>

                  <div className="dy-uid-right">
                    <div className="dy-uid-widget">
                      <div className="dy-uid-widget-title">Top channels <span>last 30d</span></div>
                      <div className="dy-uid-bars">
                        <div className="dy-uid-bar-row">
                          <span className="dy-uid-bar-label">Sales</span>
                          <div className="dy-uid-bar-track">
                            <div className="dy-uid-bar-fill" style={{ width: "68%" }} />
                          </div>
                          <span className="dy-uid-bar-val">68%</span>
                        </div>
                        <div className="dy-uid-bar-row">
                          <span className="dy-uid-bar-label">Press</span>
                          <div className="dy-uid-bar-track">
                            <div className="dy-uid-bar-fill dy-green" style={{ width: "44%" }} />
                          </div>
                          <span className="dy-uid-bar-val">44%</span>
                        </div>
                        <div className="dy-uid-bar-row">
                          <span className="dy-uid-bar-label">VC</span>
                          <div className="dy-uid-bar-track">
                            <div className="dy-uid-bar-fill dy-purple" style={{ width: "22%" }} />
                          </div>
                          <span className="dy-uid-bar-val">22%</span>
                        </div>
                      </div>
                    </div>

                    <div className="dy-uid-widget">
                      <div className="dy-uid-widget-title">Reply rate</div>
                      <div className="dy-uid-gauge-wrap">
                        <svg viewBox="0 0 100 58" className="dy-uid-gauge-svg">
                          <path d="M12,54 A38,38 0 0,1 88,54" fill="none" style={{ stroke: "var(--dy-surface-hi)", strokeWidth: 8, strokeLinecap: "round" }} />
                          <path d="M12,54 A38,38 0 0,1 88,54" fill="none" style={{ stroke: "var(--dy-accent)", strokeWidth: 8, strokeLinecap: "round", strokeDasharray: 119, strokeDashoffset: 43 }} />
                        </svg>
                        <div className="dy-uid-gauge-val">1.92%</div>
                        <div className="dy-uid-gauge-sub">vs 1.4% industry avg</div>
                        <button type="button" className="dy-uid-gauge-btn">View detail</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="dy-uid-table-wrap">
                  <table className="dy-uid-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Sent</th>
                        <th>Replies</th>
                        <th>$ / reply</th>
                        <th>Rating</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td><span className="dy-uid-product">prompthub.ai</span></td><td><span className="dy-uid-meta">3,200</span></td><td><span className="dy-uid-val">88</span></td><td><span className="dy-uid-meta">$1.04</span></td><td><span className="dy-uid-meta">★ 4.9</span></td><td><span className="dy-uid-status dy-green">Scale</span></td></tr>
                      <tr><td><span className="dy-uid-product">mailmesh.com</span></td><td><span className="dy-uid-meta">2,800</span></td><td><span className="dy-uid-val">62</span></td><td><span className="dy-uid-meta">$1.29</span></td><td><span className="dy-uid-meta">★ 4.7</span></td><td><span className="dy-uid-status dy-green">Scale</span></td></tr>
                      <tr><td><span className="dy-uid-product">voiceform.io</span></td><td><span className="dy-uid-meta">1,900</span></td><td><span className="dy-uid-val">28</span></td><td><span className="dy-uid-meta">$2.04</span></td><td><span className="dy-uid-meta">★ 4.3</span></td><td><span className="dy-uid-status dy-amber">Watch</span></td></tr>
                      <tr><td><span className="dy-uid-product">linearclone.dev</span></td><td><span className="dy-uid-meta">800</span></td><td><span className="dy-uid-val">4</span></td><td><span className="dy-uid-meta">$8.75</span></td><td><span className="dy-uid-meta">★ 3.1</span></td><td><span className="dy-uid-status dy-red">Kill</span></td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="dy-hero-ui-fade" aria-hidden />
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="dy-stats-band" id="main-content">
        <div className="dy-wrap">
          <div className="dy-stats-card">
            <div className="dy-stats-inner">
              <div className="dy-stat">
                <span className="dy-stat-val dy-accent">$1.42</span>
                <span className="dy-stat-lbl">avg per qualified reply</span>
              </div>
              <div className="dy-stat">
                <span className="dy-stat-val">9</span>
                <span className="dy-stat-lbl">channels live</span>
              </div>
              <div className="dy-stat">
                <span className="dy-stat-val">$25</span>
                <span className="dy-stat-lbl">free to start</span>
              </div>
              <div className="dy-stat">
                <span className="dy-stat-val">MIT</span>
                <span className="dy-stat-lbl">open source</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section className="dy-s-how">
        <div className="dy-wrap">
          <div className="dy-sec-intro dy-r">
            <span className="t-lbl">How it works</span>
            <h2 className="t-h2">What happens after you paste the URL</h2>
            <p className="t-body">Three steps. No domain warmup. No configuration. No brief to write.</p>
          </div>
          <div className="dy-steps-grid">
            <div className="dy-step dy-r dy-d1">
              <span className="dy-step-num">01 / read</span>
              <h3 className="t-h3">We read your product</h3>
              <p>distribute analyzes your site, reads your positioning, and picks the right workflow for each channel. You write nothing.</p>
            </div>
            <div className="dy-step dy-r dy-d2">
              <span className="dy-step-num">02 / configure</span>
              <h3 className="t-h3">Pick channels, set a budget</h3>
              <p>Toggle sales, press, VCs, hiring, or accelerators. Each channel runs on its own budget. Start with one, add more when you see what responds.</p>
            </div>
            <div className="dy-step dy-r dy-d3">
              <span className="dy-step-num">03 / deliver</span>
              <h3 className="t-h3">Qualified replies land in Gmail</h3>
              <p>AI qualifies every reply. The ones that matter come through with the full thread and the cost logged. Everything else disappears.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PLATFORM BENTO */}
      <section className="dy-s-platform">
        <div className="dy-wrap">
          <div className="dy-sec-intro dy-r">
            <span className="t-lbl">Platform</span>
            <h2 className="t-h2">The full distribution stack, automated</h2>
            <p className="t-body">From URL to qualified reply, every step runs automatically. No domain warmup, no brief to write, no inbox to monitor.</p>
          </div>

          <div className="dy-platform-bento">
            <div className="dy-pb-tile dy-pb-url dy-r dy-d1">
              <span className="dy-pb-label">Step 1</span>
              <h3 className="t-h3">Drop a URL. We read the product.</h3>
              <p>distribute scrapes your site, extracts your positioning, identifies your ICP, and selects the highest-probability channel for your category. No brief. No onboarding call.</p>
              <div className="dy-pb-illus">
                <div className="dy-illus-url">
                  <div className="dy-illus-url-input">
                    <span className="dy-illus-url-prefix">https://</span>
                    <span className="dy-illus-url-text">prompthub.ai</span>
                  </div>
                  <div className="dy-illus-url-arrow">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3v10M3 8l5 5 5-5" /></svg>
                    AI reads and extracts context
                  </div>
                  <div className="dy-illus-url-tags">
                    <span className="dy-illus-tag">ICP: solo founders</span>
                    <span className="dy-illus-tag dy-green">channel: sales-outreach</span>
                    <span className="dy-illus-tag dy-purple">tone: technical</span>
                    <span className="dy-illus-tag">budget: $50</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="dy-pb-tile dy-pb-prospt dy-r dy-d2">
              <div className="dy-pb-prospt-row">
                <div className="dy-pb-prospt-text">
                  <span className="dy-pb-label">Step 2</span>
                  <h3 className="t-h3">AI finds the right people</h3>
                  <p>Apollo, Crunchbase, Muck Rack, LinkedIn: distribute queries the right data source for the channel, filters by fit, and builds the list automatically.</p>
                </div>
                <div className="dy-pb-illus dy-pb-prospt-illus">
                  <div className="dy-illus-nodes">
                    <svg viewBox="0 0 180 155" fill="none">
                      <line x1="90" y1="77" x2="28" y2="28" style={{ stroke: "var(--dy-accent)", strokeOpacity: 0.25, strokeWidth: 1 }} />
                      <line x1="90" y1="77" x2="152" y2="22" style={{ stroke: "var(--dy-accent)", strokeOpacity: 0.2, strokeWidth: 1 }} />
                      <line x1="90" y1="77" x2="162" y2="88" style={{ stroke: "var(--dy-accent)", strokeOpacity: 0.15, strokeWidth: 1 }} />
                      <line x1="90" y1="77" x2="138" y2="140" style={{ stroke: "var(--dy-accent)", strokeOpacity: 0.2, strokeWidth: 1 }} />
                      <line x1="90" y1="77" x2="42" y2="130" style={{ stroke: "var(--dy-accent)", strokeOpacity: 0.18, strokeWidth: 1 }} />
                      <line x1="90" y1="77" x2="18" y2="90" style={{ stroke: "var(--dy-accent)", strokeOpacity: 0.15, strokeWidth: 1 }} />
                      <circle cx="28" cy="28" r="7" style={{ fill: "var(--dy-accent-dim)", stroke: "var(--dy-accent-brd)", strokeWidth: 1.5 }} />
                      <circle cx="152" cy="22" r="9" style={{ fill: "var(--dy-accent-dim)", stroke: "var(--dy-accent-brd)", strokeWidth: 1.5 }} />
                      <circle cx="162" cy="88" r="6" style={{ fill: "var(--dy-surface-hi)", stroke: "var(--dy-border-hi)", strokeWidth: 1 }} />
                      <circle cx="138" cy="140" r="8" style={{ fill: "var(--dy-accent-dim)", stroke: "var(--dy-accent-brd)", strokeWidth: 1.5 }} />
                      <circle cx="42" cy="130" r="6" style={{ fill: "var(--dy-surface-hi)", stroke: "var(--dy-border-hi)", strokeWidth: 1 }} />
                      <circle cx="18" cy="90" r="5" style={{ fill: "var(--dy-accent-dim)", stroke: "var(--dy-accent-brd)", strokeWidth: 1.5 }} />
                      <circle cx="85" cy="10" r="4" style={{ fill: "var(--dy-surface-hi)", stroke: "var(--dy-border-hi)", strokeWidth: 1 }} />
                      <circle cx="90" cy="77" r="14" style={{ fill: "var(--dy-accent)", fillOpacity: 0.2, stroke: "var(--dy-accent)", strokeWidth: 2 }} />
                      <circle cx="90" cy="77" r="6" style={{ fill: "var(--dy-accent)" }} />
                      <text x="28" y="44" style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, fill: "var(--dy-accent)", fillOpacity: 0.8 }}>qualified</text>
                      <text x="145" y="38" style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, fill: "var(--dy-accent)", fillOpacity: 0.8 }}>qualified</text>
                      <text x="125" y="148" style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, fill: "var(--dy-accent)", fillOpacity: 0.8 }}>qualified</text>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="dy-pb-tile dy-pb-email dy-r dy-d3">
              <span className="dy-pb-label">Step 3</span>
              <h3 className="t-h3">Personalized emails, written by AI</h3>
              <p>Claude writes each email from the prospect&apos;s profile, your product context, and the channel&apos;s patterns.</p>
              <ul className="dy-pb-feat-list">
                <li>Subject line tied to the prospect&apos;s pain point</li>
                <li>Opener referencing their company or role</li>
                <li>Body built around your strongest proof point</li>
                <li>CTA matched to the channel&apos;s conversion pattern</li>
              </ul>
              <div className="dy-pb-illus">
                <div className="dy-illus-email">
                  <div className="dy-illus-email-line dy-accent" />
                  <div className="dy-illus-email-line dy-hl" />
                  <div style={{ height: "0.25rem" }} />
                  <div className="dy-illus-email-line dy-long" />
                  <div className="dy-illus-email-line dy-med" />
                  <div className="dy-illus-email-line dy-short" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ICP */}
      <section className="dy-s-icp">
        <div className="dy-wrap">
          <div className="dy-sec-intro dy-r">
            <span className="t-lbl" style={{ color: "oklch(72% 0.200 264)" }}>Who ships with distribute</span>
            <h2 className="t-h2" style={{ color: "oklch(96% 0.005 264)" }}>Designed for one kind of person</h2>
            <p className="t-body" style={{ color: "oklch(65% 0.016 264)" }}>You ship fast and run multiple products. You know distribution matters but you do not have time for it, and you do not want to hire for it.</p>
          </div>
          <div className="dy-icp-bento">
            <div className="dy-icp-tile dy-r dy-d1">
              <span className="dy-icp-glyph">01/</span>
              <h3 className="t-h3">Solo founders with AI tools</h3>
              <p>You build fast with Claude, Cursor, or Lovable. You ship in weeks. You need your first 50 customers before you decide whether to scale or kill the product.</p>
            </div>
            <div className="dy-icp-tile dy-r dy-d2">
              <span className="dy-icp-glyph">×N</span>
              <h3 className="t-h3">Bootstrapped micro-SaaS operators</h3>
              <p>You run 3 to 5 products at once. You want to know which one to double down on this quarter, without doing manual outreach for all of them.</p>
            </div>
            <div className="dy-icp-tile dy-r dy-d3">
              <span className="dy-icp-glyph">?→</span>
              <h3 className="t-h3">Builders testing market fit</h3>
              <p>You have a product and a hypothesis. You want real replies from real prospects before you commit to a direction. Not survey data. Actual conversations.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CHANNELS */}
      <section className="dy-s-channels">
        <div className="dy-wrap">
          <div className="dy-sec-intro dy-r">
            <span className="t-lbl">Channels</span>
            <h2 className="t-h2">9 live channels. One dashboard.</h2>
            <p className="t-body">Each channel runs on competing workflows. The one with the lowest cost per qualified reply runs by default. You can swap at any time.</p>
          </div>

          <div className="dy-channels-bento dy-r">
            <ChannelTile cat="dy-cat-blue" catLabel="Sales" title="Sales outreach" body="Finds prospects, writes personalized cold emails, and tracks every reply across all your products." stack="Apollo · Anthropic · Resend" color="var(--dy-accent)" icon="mail" />
            <ChannelTile cat="dy-cat-amber" catLabel="Press" title="Journalist outreach" body="Pitches journalists who cover your space. Press coverage without a PR agency." stack="Muck Rack · Anthropic · Resend" color="var(--dy-amber)" icon="news" />
            <ChannelTile cat="dy-cat-green" catLabel="Funding" title="VC outreach" body="Reaches investors who back your stage and sector. Cold VC outreach without a warm intro." stack="Crunchbase · Anthropic · Resend" color="var(--dy-green)" icon="growth" />
            <ChannelTile cat="dy-cat-purple" catLabel="Hiring" title="Hiring outreach" body="Contacts candidates who match your stack. Cold recruiting without a recruiter." stack="LinkedIn · Anthropic · Resend" color="var(--dy-purple)" icon="people" />
            <ChannelTile cat="dy-cat-blue" catLabel="Growth" title="Accelerator outreach" body="Applies to YC, Techstars, and 200+ programs. Tracks deadlines automatically." stack="Y Combinator · Anthropic · Resend" color="var(--dy-accent)" icon="rocket" />
            <ChannelTile cat="dy-cat-amber" catLabel="PR" title="PR expert quotes" body="Responds to HARO-style journalist requests with on-brand quotes, automatically." stack="Featured · Anthropic · Resend" color="var(--dy-amber)" icon="quote" />
            <ChannelTile cat="dy-cat-teal" catLabel="Discovery" title="Outlet discovery" body="Finds media outlets worth pitching for your space. Continuously updated as new publications emerge." stack="Firecrawl · Anthropic" color="var(--dy-teal)" icon="globe" />
            <ChannelTile cat="dy-cat-muted" catLabel="Assets" title="Press kit generation" body="Generates a press kit page with bio, screenshots, and contact info for journalists." stack="Anthropic · Vercel" color="var(--dy-sub)" icon="kit" />
            <ChannelTile cat="dy-cat-purple" catLabel="AI visibility" title="AI visibility scoring" body="Tracks your brand across ChatGPT, Claude, Perplexity, and Gemini. Measures your share of AI recommendations." stack="OpenAI · Anthropic · Perplexity" color="var(--dy-purple)" icon="eye" />
          </div>
        </div>
      </section>

      {/* EMAIL */}
      <section className="dy-s-email">
        <div className="dy-wrap">
          <div className="dy-email-split">
            <div className="dy-email-split-left dy-r">
              <span className="t-lbl">What lands in your inbox</span>
              <h2 className="t-h2">The only emails you read</h2>
              <p className="t-body">AI qualifies every reply before it reaches you. The ones worth your time arrive with the full thread and the cost logged, ready to answer.</p>

              <div className="dy-email-features">
                <div className="dy-email-feat">
                  <div className="dy-email-feat-icon">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8l3 3 7-7" /></svg>
                  </div>
                  <div className="dy-email-feat-text">
                    <h4>Qualified before you see it</h4>
                    <p>Claude Haiku reads every reply and classifies it. Only positive, actionable replies come through. The rest never interrupt you.</p>
                  </div>
                </div>
                <div className="dy-email-feat">
                  <div className="dy-email-feat-icon">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4l6 5 6-5" /><rect x="2" y="4" width="12" height="9" rx="1.5" /></svg>
                  </div>
                  <div className="dy-email-feat-text">
                    <h4>Cost logged per reply</h4>
                    <p>Every qualified reply shows what it cost to generate. You know your exact ROI before you hit reply.</p>
                  </div>
                </div>
                <div className="dy-email-feat">
                  <div className="dy-email-feat-icon">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3v10M3 8l5 5 5-5" /></svg>
                  </div>
                  <div className="dy-email-feat-text">
                    <h4>Daily digest included</h4>
                    <p>Every morning: how many emails went out, how many qualified, your cost per reply across every product and channel.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="dy-email-compose dy-r dy-d2">
              <div className="dy-email-compose-bar">
                <div className="dy-email-compose-bar-l">
                  <span className="dy-ec-dot" style={{ background: "#FF5F57" }} />
                  <span className="dy-ec-dot" style={{ background: "#FFBD2E" }} />
                  <span className="dy-ec-dot" style={{ background: "#28CA41" }} />
                </div>
                <span className="dy-email-compose-title">Gmail: distribute qualified replies</span>
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.65rem", color: "var(--dy-muted)" }}>3 new today</span>
              </div>

              <div className="dy-email-compose-field">
                <span className="dy-email-compose-field-label">From</span>
                <span className="dy-email-compose-field-val">Marcus Chen, Loopify.io &nbsp;<span style={{ background: "var(--dy-accent-dim)", color: "var(--dy-accent)", fontFamily: "JetBrains Mono, monospace", fontSize: "0.65rem", padding: "0.1rem 0.4rem", borderRadius: 100, border: "1px solid var(--dy-accent-brd)" }}>qualified</span></span>
              </div>
              <div className="dy-email-compose-field">
                <span className="dy-email-compose-field-label">Subj</span>
                <span className="dy-email-compose-field-val" style={{ color: "var(--dy-text)", fontWeight: 500 }}>Re: prompthub.ai, interested in a demo</span>
              </div>
              <div className="dy-email-compose-field" style={{ borderBottom: "none" }}>
                <span className="dy-email-compose-field-label" style={{ color: "var(--dy-muted)", fontSize: "0.65rem" }}>Cost</span>
                <span className="dy-email-compose-field-val" style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.78rem", color: "var(--dy-green)" }}>$0.94 · sales-outreach · apex-v4</span>
              </div>

              <div className="dy-email-compose-body">
                {`Hi Marcus,

I noticed Loopify is focused on helping agencies manage client workflows. Wanted to share how prompthub.ai helps teams like yours cut prompt iteration time by 60%.

Would love to show you a quick demo. 15 minutes this week?`}
              </div>

              <div className="dy-email-compose-footer">
                <div className="dy-email-ai-badge">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3l1.5 3.5L13 8l-3.5 1.5L8 13l-1.5-3.5L3 8l3.5-1.5z" /></svg>
                  AI-qualified reply
                </div>
                <span className="dy-email-stats">47 sent today · 3 qualified · $1.26 avg</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARE */}
      <section className="dy-s-compare">
        <div className="dy-wrap">
          <div className="dy-sec-intro dy-r">
            <span className="t-lbl">What we handle</span>
            <h2 className="t-h2">The week you skip</h2>
            <p className="t-body">Cold outreach has a setup tax. Most founders pay it once, hate it, and stop. We run the whole stack.</p>
          </div>
          <div className="dy-compare dy-r">
            <div className="dy-cmp-bad">
              <div className="dy-cmp-head">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" /></svg>
                Without distribute
              </div>
              <ul className="dy-cmp-list">
                <li><span className="dy-cmp-icon">✕</span><span>Set up a dedicated sending domain, configure SPF, DKIM, and DMARC</span></li>
                <li><span className="dy-cmp-icon">✕</span><span>Warm mailboxes for 3 to 5 weeks before sending at volume</span></li>
                <li><span className="dy-cmp-icon">✕</span><span>Monitor bounces, blacklists, and sender reputation ongoing</span></li>
                <li><span className="dy-cmp-icon">✕</span><span>Research and build a prospect list for each channel manually</span></li>
                <li><span className="dy-cmp-icon">✕</span><span>Write and A/B test cold email sequences per product</span></li>
                <li><span className="dy-cmp-icon">✕</span><span>Read 200 raw replies to find the 3 that actually matter</span></li>
                <li><span className="dy-cmp-icon">✕</span><span>Wire Apollo, Resend, and Claude into separate services yourself</span></li>
                <li><span className="dy-cmp-icon">✕</span><span>Track cost per reply per product, per channel, by hand</span></li>
              </ul>
            </div>
            <div className="dy-cmp-good">
              <div className="dy-cmp-head">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 6l3 3 6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
                With distribute
              </div>
              <ul className="dy-cmp-list">
                <li><span className="dy-cmp-icon">✓</span><span>Paste your product URL</span></li>
                <li><span className="dy-cmp-icon">✓</span><span>Pick your channels and set a budget</span></li>
                <li><span className="dy-cmp-icon">✓</span><span>Read the replies that matter, already qualified and forwarded to Gmail</span></li>
              </ul>
              <div className="dy-cmp-foot">
                <p className="dy-cmp-note">Everything else runs automatically.</p>
                <a href={PROD_URLS.signUp} className="dy-btn dy-btn-p">Start free, $25 credits</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="dy-s-pricing">
        <div className="dy-wrap">
          <div className="dy-price-layout dy-r">
            <div>
              <span className="t-lbl" style={{ color: "var(--dy-accent)", display: "block", marginBottom: "0.875rem" }}>Pricing</span>
              <h2 className="t-h2" style={{ marginBottom: "1rem" }}>No subscription. Pay per send.</h2>
              <p className="t-body" style={{ color: "var(--dy-sub)", marginBottom: "0.875rem" }}>No monthly fee, no seat cost. Every campaign prices itself before launch, built from public API rates. What you see in the card is exactly what you pay.</p>
              <div className="dy-price-checks">
                <div className="dy-price-check"><span className="dy-price-check-icon">✓</span><span className="dy-price-check-text">Pre-warmed infrastructure. No domain setup, no 3-week warmup window.</span></div>
                <div className="dy-price-check"><span className="dy-price-check-icon">✓</span><span className="dy-price-check-text">AI reads every response. Only positive replies land in Gmail.</span></div>
                <div className="dy-price-check"><span className="dy-price-check-icon">✓</span><span className="dy-price-check-text">Cost tracked per reply, per channel, per product.</span></div>
                <div className="dy-price-check"><span className="dy-price-check-icon">✓</span><span className="dy-price-check-text">Start with $25 free credits. No subscription.</span></div>
              </div>
              <a href="/pricing" className="dy-btn dy-btn-g" style={{ marginTop: "2rem", display: "inline-flex" }}>View all pricing</a>
            </div>
            <div>
              <div className="dy-price-card">
                <div className="dy-price-card-head"><em>sales-outreach</em> · apex-v4</div>
                <div className="dy-price-row"><span className="dy-price-label">Apollo lead enrichment</span><span className="dy-price-value">$0.012</span></div>
                <div className="dy-price-row"><span className="dy-price-label">Email generation (Claude Sonnet 4.6)</span><span className="dy-price-value">$0.018</span></div>
                <div className="dy-price-row"><span className="dy-price-label">Send via agency address (Resend)</span><span className="dy-price-value">$0.004</span></div>
                <div className="dy-price-row"><span className="dy-price-label">Reply classifier (Claude Haiku 4.5)</span><span className="dy-price-value">$0.002</span></div>
                <div className="dy-price-card-foot">
                  <div>
                    <div className="dy-price-foot-l">Per email sent</div>
                    <div className="dy-price-foot-sub">avg $1.42 per qualified reply</div>
                  </div>
                  <span className="dy-price-foot-v">$0.036</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INTEGRATIONS */}
      <section className="dy-s-integrations">
        <div className="dy-wrap">
          <div className="dy-sec-intro dy-r">
            <span className="t-lbl">Integrations</span>
            <h2 className="t-h2">Start from wherever you work</h2>
            <p className="t-body">Dashboard, REST API, or MCP server. Whatever fits your stack.</p>
          </div>
          <div className="dy-int-grid dy-r">
            <div className="dy-int-tile">
              <span className="dy-int-type">Dashboard</span>
              <h3 className="t-h3">app.distribute.you</h3>
              <p>Add a product, pick channels, set a budget. Everything tracked in one place.</p>
              <div className="dy-code-block"><span className="dy-cm">→</span> app.distribute.you/dashboard</div>
            </div>
            <div className="dy-int-tile">
              <span className="dy-int-type">REST API</span>
              <h3 className="t-h3">POST /v1/campaigns</h3>
              <p>Everything you can do in the dashboard, you can do via API. Trigger campaigns from your own code.</p>
              <div className="dy-code-block">{`POST /v1/campaigns
Authorization: Bearer {key}
{"url": "prompthub.ai", "budget": 50}`}</div>
            </div>
            <div className="dy-int-tile">
              <span className="dy-int-type">MCP Server</span>
              <h3 className="t-h3">Claude Code / Cursor</h3>
              <p>Use distribute from Claude Code or any MCP client. One sentence launches a campaign.</p>
              <div className="dy-code-block">{`$ distribute launch sales
  --url prompthub.ai --budget 50

✓ Campaign started (id: c_9fh2)`}</div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="dy-s-cta">
        <div className="dy-wrap">
          <div className="dy-r">
            <h2 className="t-hero">Your next launch<br />comes with distribution.</h2>
            <p>$25 free credits to start. No subscription. No credit card.</p>
            <a href={PROD_URLS.signUp} className="dy-btn dy-btn-p dy-btn-lg">Start free, $25 credits</a>
          </div>
        </div>
      </section>

      <DyFooter />
    </div>
  );
}

type ChannelTileProps = {
  cat: string;
  catLabel: string;
  title: string;
  body: string;
  stack: string;
  color: string;
  icon: string;
};

function ChannelTile({ cat, catLabel, title, body, stack, color, icon }: ChannelTileProps) {
  return (
    <div className="dy-ch-tile">
      <span className={`dy-ch-cat ${cat}`}>{catLabel}</span>
      <h3 className="t-h3">{title}</h3>
      <p>{body}</p>
      <div className="dy-ch-illus" aria-hidden>
        <ChannelIcon name={icon} color={color} />
      </div>
      <div className="dy-ch-stack">{stack}</div>
    </div>
  );
}

function ChannelIcon({ name, color }: { name: string; color: string }) {
  const common = { fill: "none", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, stroke: "currentColor" };
  switch (name) {
    case "mail":
      return (
        <svg viewBox="0 0 24 24" style={{ color }}>
          <path d="M2 6L8.91302 9.91697C11.4616 11.361 12.5384 11.361 15.087 9.91697L22 6" {...common} />
          <path d="M2.01577 13.4756C2.08114 16.5412 2.11383 18.0739 3.24496 19.2094C4.37608 20.3448 5.95033 20.3843 9.09883 20.4634C11.0393 20.5122 12.9607 20.5122 14.9012 20.4634C18.0497 20.3843 19.6239 20.3448 20.7551 19.2094C21.8862 18.0739 21.9189 16.5412 21.9842 13.4756C22.0053 12.4899 22.0053 11.5101 21.9842 10.5244C21.9189 7.45886 21.8862 5.92609 20.7551 4.79066C19.6239 3.65523 18.0497 3.61568 14.9012 3.53657C12.9607 3.48781 11.0393 3.48781 9.09882 3.53656C5.95033 3.61566 4.37608 3.65521 3.24495 4.79065C2.11382 5.92608 2.08114 7.45885 2.01576 10.5244C1.99474 11.5101 1.99475 12.4899 2.01577 13.4756Z" {...common} />
        </svg>
      );
    case "news":
      return (
        <svg viewBox="0 0 24 24" style={{ color }}>
          <path d="M10.5 8H18.5M10.5 12H13M18.5 12H16M10.5 16H13M18.5 16H16" {...common} />
          <path d="M7 7.5H6C4.11438 7.5 3.17157 7.5 2.58579 8.08579C2 8.67157 2 9.61438 2 11.5V18C2 19.3807 3.11929 20.5 4.5 20.5C5.88071 20.5 7 19.3807 7 18V7.5Z" {...common} />
          <path d="M16 3.5H11C10.07 3.5 9.60504 3.5 9.22354 3.60222C8.18827 3.87962 7.37962 4.68827 7.10222 5.72354C7 6.10504 7 6.57003 7 7.5V18C7 19.3807 5.88071 20.5 4.5 20.5H16C18.8284 20.5 20.2426 20.5 21.1213 19.6213C22 18.7426 22 17.3284 22 14.5V9.5C22 6.67157 22 5.25736 21.1213 4.37868C20.2426 3.5 18.8284 3.5 16 3.5Z" {...common} />
        </svg>
      );
    case "growth":
      return (
        <svg viewBox="0 0 24 24" style={{ color }}>
          <path d="M7 18V16M12 18V15M17 18V13M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z" {...common} />
          <path d="M5.99219 11.4863C8.14729 11.5581 13.0341 11.2328 15.8137 6.82132M13.9923 6.28835L15.8678 5.98649C16.0964 5.95738 16.432 6.13785 16.5145 6.35298L17.0104 7.99142" {...common} />
        </svg>
      );
    case "people":
      return (
        <svg viewBox="0 0 24 24" style={{ color }}>
          <path d="M15 8C15 5.23858 12.7614 3 10 3C7.23858 3 5 5.23858 5 8C5 10.7614 7.23858 13 10 13C12.7614 13 15 10.7614 15 8Z" {...common} />
          <path d="M3 20C3 16.134 6.13401 13 10 13C11.9587 13 13.7295 13.8045 15 15.101" {...common} />
          <path d="M13 18.5C13 18.5 14.3485 19.0067 15 21C15 21 18.1765 16 21 15" {...common} />
        </svg>
      );
    case "rocket":
      return (
        <svg viewBox="0 0 24 24" style={{ color }}>
          <path d="M7.29469 17C3.53045 7.25 8.86313 2.9375 12 2C15.1369 2.9375 20.4696 7.25 16.7053 17C16.1369 16.6875 14.4 16.0625 12 16.0625C9.6 16.0625 7.86313 16.6875 7.29469 17Z" {...common} />
          <path d="M14 9C14 7.89543 13.1046 7 12 7C10.8954 7 10 7.89543 10 9C10 10.1046 10.8954 11 12 11C13.1046 11 14 10.1046 14 9Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M17.5 15.5576C18.9421 15.6908 20.7078 16.0822 21.9814 17C21.9814 17 22.5044 12.0642 18 11" {...common} />
          <path d="M6.5 15.5576C5.05794 15.6908 3.29216 16.0822 2.01858 17C2.01858 17 1.49555 12.0642 6 11" {...common} />
          <path d="M9.5 19C9.5 19 9.91667 21.5 12 22C14.0833 21.5 14.5 19 14.5 19" {...common} />
        </svg>
      );
    case "quote":
      return (
        <svg viewBox="0 0 24 24" style={{ color }}>
          <path d="M21.5 12C21.5 17.2467 17.2467 21.5 12 21.5C10.3719 21.5 8.8394 21.0904 7.5 20.3687C5.63177 19.362 4.37462 20.2979 3.26592 20.4658C3.09774 20.4913 2.93024 20.4302 2.80997 20.31C2.62741 20.1274 2.59266 19.8451 2.6935 19.6074C3.12865 18.5818 3.5282 16.6382 2.98341 15C2.6698 14.057 2.5 13.0483 2.5 12C2.5 6.75329 6.75329 2.5 12 2.5C17.2467 2.5 21.5 6.75329 21.5 12Z" {...common} />
          <path d="M12.1257 12H12.0007M8.125 12H8M16.125 12H16M12.2507 12C12.2507 12.1381 12.1388 12.25 12.0007 12.25C11.8627 12.25 11.7507 12.1381 11.7507 12C11.7507 11.8619 11.8627 11.75 12.0007 11.75C12.1388 11.75 12.2507 11.8619 12.2507 12ZM8.25 12C8.25 12.1381 8.13807 12.25 8 12.25C7.86193 12.25 7.75 12.1381 7.75 12C7.75 11.8619 7.86193 11.75 8 11.75C8.13807 11.75 8.25 11.8619 8.25 12ZM16.25 12C16.25 12.1381 16.1381 12.25 16 12.25C15.8619 12.25 15.75 12.1381 15.75 12C15.75 11.8619 15.8619 11.75 16 11.75C16.1381 11.75 16.25 11.8619 16.25 12Z" {...common} />
        </svg>
      );
    case "globe":
      return (
        <svg viewBox="0 0 24 24" style={{ color }}>
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 12C8 18 12 22 12 22C12 22 16 18 16 12C16 6 12 2 12 2C12 2 8 6 8 12Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M21 15H3" {...common} />
          <path d="M21 9H3" {...common} />
        </svg>
      );
    case "kit":
      return (
        <svg viewBox="0 0 24 24" style={{ color }}>
          <path d="M12 21C7.28595 21 4.92893 21 3.46447 19.5355C2 18.0711 2 15.714 2 11V7.94427C2 6.1278 2 5.21956 2.38032 4.53806C2.65142 4.05227 3.05227 3.65142 3.53806 3.38032C4.21956 3 5.1278 3 6.94427 3C8.10802 3 8.6899 3 9.19926 3.19101C10.3622 3.62712 10.8418 4.68358 11.3666 5.73313L12 7M8 7H16.75C18.8567 7 19.91 7 20.6667 7.50559C20.9943 7.72447 21.2755 8.00572 21.4944 8.33329C22 9.08996 22 10.1433 22 12.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M22 15H15M22 18H15M17.5 21H15" {...common} />
        </svg>
      );
    case "eye":
      return (
        <svg viewBox="0 0 24 24" style={{ color }}>
          <path d="M2 8C2 8 6.47715 3 12 3C17.5228 3 22 8 22 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M21.544 13.045C21.848 13.4713 22 13.6845 22 14C22 14.3155 21.848 14.5287 21.544 14.955C20.1779 16.8706 16.6892 21 12 21C7.31078 21 3.8221 16.8706 2.45604 14.955C2.15201 14.5287 2 14.3155 2 14C2 13.6845 2.15201 13.4713 2.45604 13.045C3.8221 11.1294 7.31078 7 12 7C16.6892 7 20.1779 11.1294 21.544 13.045Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M15 14C15 12.3431 13.6569 11 12 11C10.3431 11 9 12.3431 9 14C9 15.6569 10.3431 17 12 17C13.6569 17 15 15.6569 15 14Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    default:
      return null;
  }
}
