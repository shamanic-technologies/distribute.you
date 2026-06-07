import type { Metadata } from "next";
import { DyNav } from "@/components/dy-nav";
import { DyFooter } from "@/components/dy-footer";
import { DyReveal } from "@/components/dy-reveal";
import { PROD_URLS } from "@/lib/env-urls";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "distribute: 100 sales calls in 30 days. AI cold email, done for you.",
  description: "Drop your URL. We send cold emails to your ideal customers, qualify replies with AI, and forward only the buyers to your Gmail. 10x your pipeline without hiring an SDR. $25 free credits.",
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
        text: "distribute runs cold email outreach for you. Drop your product URL, set a budget, and we find buyers, write the emails, send them, qualify every reply with AI, and forward only buyer conversations to your Gmail.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need a sending domain or warmed mailbox?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. We send from our own pre-warmed agency infrastructure. You skip the 3-week setup. Launch in 5 minutes.",
      },
    },
    {
      "@type": "Question",
      name: "How much does it cost to start?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "$25 welcome credits. No subscription. No credit card. Pay only when emails go out. Average $1.42 per qualified buyer reply.",
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
              AI cold email, done for you
            </div>

            <h1 className="t-hero dy-a2">
              100 sales calls<br />in 30 days.
            </h1>

            <p className="dy-hero-sub dy-a3">
              Drop your website URL. We email your ideal customers, AI reads every reply, and only buyers land in your Gmail. You read 5 emails, not 200. No SDR. No setup. No subscription.
            </p>

            <div className="dy-hero-actions dy-a4">
              <a href={PROD_URLS.signUp} className="dy-btn dy-btn-p dy-btn-lg">Start free, $25 credits</a>
              <a href="#pricing" className="dy-btn dy-btn-g dy-btn-lg">See pricing</a>
            </div>
            <p className="dy-hero-note dy-a4">No subscription. No credit card. Launch in 5 minutes.</p>
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="dy-wrap dy-hero-dash-wrap">
          <div className="dy-hero-ui-outer dy-a5">
            <div className="dy-hero-ui-glow" aria-hidden />

            <div className="dy-hero-ui" role="img" aria-label="distribute dashboard showing cold email campaign performance">
              {/* Sidebar */}
              <nav className="dy-uid-sidebar" aria-hidden>
                <div className="dy-uid-logo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo-distribute.svg" alt="" className="dy-uid-logo-img" />
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
                    <span className="dy-uid-badge-count">3</span>
                  </li>
                  <li>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M5 7h6M5 10h4" /></svg>
                    Buyers
                  </li>
                  <li>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4l6 5 6-5" /><rect x="2" y="4" width="12" height="9" rx="1.5" /></svg>
                    Emails
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
                  <div className="dy-uid-upgrade-sub">Top up your credits and book more calls.</div>
                  <button type="button" className="dy-uid-upgrade-btn">Add credits</button>
                </div>
              </nav>

              {/* Main */}
              <div className="dy-uid-main" aria-hidden>
                <div className="dy-uid-topbar">
                  <span className="dy-uid-topbar-title">Cold email outreach</span>
                  <div className="dy-uid-topbar-right">
                    <div className="dy-uid-date-pill">
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="12" rx="1.5" /><path d="M5 2v2M11 2v2M2 7h12" /></svg>
                      Last 30 days
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
                    <div className="dy-uid-kpi-lbl">Qualified buyers</div>
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
                    <div className="dy-uid-kpi-lbl">Meetings booked</div>
                    <div className="dy-uid-kpi-row">
                      <span className="dy-uid-kpi-n">47</span>
                      <div className="dy-uid-kpi-icon">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="11" rx="1.5" /><path d="M5 2v3M11 2v3M2 7h12" /></svg>
                      </div>
                    </div>
                    <div>
                      <span className="dy-uid-kpi-delta dy-up">+9</span>
                      <span className="dy-uid-kpi-vs">this week</span>
                    </div>
                  </div>
                  <div className="dy-uid-kpi">
                    <div className="dy-uid-kpi-lbl">Cost per buyer</div>
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
                      <span className="dy-uid-chart-title">Qualified buyers over time</span>
                      <span className="dy-uid-chart-total">239 total · Jun 2025</span>
                    </div>
                    <div className="dy-uid-chart-tooltip">
                      Jun 1 &nbsp;·&nbsp; <strong>48 buyers</strong> this month &nbsp;·&nbsp; 31 last month
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
                      <div className="dy-uid-widget-title">Reply types <span>last 30d</span></div>
                      <div className="dy-uid-bars">
                        <div className="dy-uid-bar-row">
                          <span className="dy-uid-bar-label">Buyers</span>
                          <div className="dy-uid-bar-track">
                            <div className="dy-uid-bar-fill" style={{ width: "68%" }} />
                          </div>
                          <span className="dy-uid-bar-val">68%</span>
                        </div>
                        <div className="dy-uid-bar-row">
                          <span className="dy-uid-bar-label">Curious</span>
                          <div className="dy-uid-bar-track">
                            <div className="dy-uid-bar-fill dy-green" style={{ width: "44%" }} />
                          </div>
                          <span className="dy-uid-bar-val">44%</span>
                        </div>
                        <div className="dy-uid-bar-row">
                          <span className="dy-uid-bar-label">Pass</span>
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
                        <th>Campaign</th>
                        <th>Sent</th>
                        <th>Buyers</th>
                        <th>$ / buyer</th>
                        <th>Meetings</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td><span className="dy-uid-product">SaaS founders, US</span></td><td><span className="dy-uid-meta">3,200</span></td><td><span className="dy-uid-val">88</span></td><td><span className="dy-uid-meta">$1.04</span></td><td><span className="dy-uid-meta">22</span></td><td><span className="dy-uid-status dy-green">Scale</span></td></tr>
                      <tr><td><span className="dy-uid-product">Agency owners, EU</span></td><td><span className="dy-uid-meta">2,800</span></td><td><span className="dy-uid-val">62</span></td><td><span className="dy-uid-meta">$1.29</span></td><td><span className="dy-uid-meta">15</span></td><td><span className="dy-uid-status dy-green">Scale</span></td></tr>
                      <tr><td><span className="dy-uid-product">Real estate, US</span></td><td><span className="dy-uid-meta">1,900</span></td><td><span className="dy-uid-val">28</span></td><td><span className="dy-uid-meta">$2.04</span></td><td><span className="dy-uid-meta">7</span></td><td><span className="dy-uid-status dy-amber">Watch</span></td></tr>
                      <tr><td><span className="dy-uid-product">Ecom DTC, UK</span></td><td><span className="dy-uid-meta">800</span></td><td><span className="dy-uid-val">4</span></td><td><span className="dy-uid-meta">$8.75</span></td><td><span className="dy-uid-meta">1</span></td><td><span className="dy-uid-status dy-red">Kill</span></td></tr>
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
                <span className="dy-stat-lbl">per buyer reply on average</span>
              </div>
              <div className="dy-stat">
                <span className="dy-stat-val">10x</span>
                <span className="dy-stat-lbl">more outbound than 1 SDR</span>
              </div>
              <div className="dy-stat">
                <span className="dy-stat-val">5 min</span>
                <span className="dy-stat-lbl">to launch your first campaign</span>
              </div>
              <div className="dy-stat">
                <span className="dy-stat-val">$25</span>
                <span className="dy-stat-lbl">free to start, no card</span>
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
            <h2 className="t-h2">From your URL to 100 buyer conversations</h2>
            <p className="t-body">Three steps. No setup. No software to learn. No SDR to hire.</p>
          </div>
          <div className="dy-steps-grid">
            <div className="dy-step dy-r dy-d1">
              <span className="dy-step-num">01 / drop</span>
              <h3 className="t-h3">Paste your website URL</h3>
              <p>We read your product, figure out who your buyers are, and write your campaign. You write nothing. You log in, paste a link, set a budget. Done.</p>
            </div>
            <div className="dy-step dy-r dy-d2">
              <span className="dy-step-num">02 / send</span>
              <h3 className="t-h3">We email your buyers</h3>
              <p>Pre-warmed inboxes start sending the same day. Every email is personalized to the person and the company. No spam folder. No domain setup. Just buyers in their inbox.</p>
            </div>
            <div className="dy-step dy-r dy-d3">
              <span className="dy-step-num">03 / read</span>
              <h3 className="t-h3">Buyer replies land in Gmail</h3>
              <p>AI reads every reply. Only real buyers reach your inbox, ready to answer. You read 5 emails a day instead of 200. The other 195 never bother you.</p>
            </div>
          </div>
        </div>
      </section>

      {/* EMAIL */}
      <section className="dy-s-email">
        <div className="dy-wrap">
          <div className="dy-email-split">
            <div className="dy-email-split-left dy-r">
              <span className="t-lbl">What lands in your inbox</span>
              <h2 className="t-h2">The only emails worth your time</h2>
              <p className="t-body">AI qualifies every reply before it reaches you. The buyers come through with their full message, ready to answer. The noise stays out.</p>

              <div className="dy-email-features">
                <div className="dy-email-feat">
                  <div className="dy-email-feat-icon">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8l3 3 7-7" /></svg>
                  </div>
                  <div className="dy-email-feat-text">
                    <h4>Only buyers, never noise</h4>
                    <p>AI reads every reply and keeps only the ones from real buyers. Out-of-office, unsubscribes, vague brush-offs never reach you.</p>
                  </div>
                </div>
                <div className="dy-email-feat">
                  <div className="dy-email-feat-icon">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4l6 5 6-5" /><rect x="2" y="4" width="12" height="9" rx="1.5" /></svg>
                  </div>
                  <div className="dy-email-feat-text">
                    <h4>Sent straight to Gmail</h4>
                    <p>Buyer replies forward to your existing Gmail. Same threading, same Send button. You reply from your normal inbox.</p>
                  </div>
                </div>
                <div className="dy-email-feat">
                  <div className="dy-email-feat-icon">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3v10M3 8l5 5 5-5" /></svg>
                  </div>
                  <div className="dy-email-feat-text">
                    <h4>Daily wins, no surprises</h4>
                    <p>Every morning: how many emails went out, how many buyers replied, and what each buyer cost. You see results, not dashboards.</p>
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
                <span className="dy-email-compose-title">Gmail: buyer reply</span>
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.65rem", color: "var(--dy-muted)" }}>3 new today</span>
              </div>

              <div className="dy-email-compose-field">
                <span className="dy-email-compose-field-label">From</span>
                <span className="dy-email-compose-field-val">Marcus Chen, Loopify.io &nbsp;<span style={{ background: "var(--dy-accent-dim)", color: "var(--dy-accent)", fontFamily: "JetBrains Mono, monospace", fontSize: "0.65rem", padding: "0.1rem 0.4rem", borderRadius: 100, border: "1px solid var(--dy-accent-brd)" }}>buyer</span></span>
              </div>
              <div className="dy-email-compose-field">
                <span className="dy-email-compose-field-label">Subj</span>
                <span className="dy-email-compose-field-val" style={{ color: "var(--dy-text)", fontWeight: 500 }}>Re: interested in a demo this week</span>
              </div>
              <div className="dy-email-compose-field" style={{ borderBottom: "none" }}>
                <span className="dy-email-compose-field-label" style={{ color: "var(--dy-muted)", fontSize: "0.65rem" }}>Cost</span>
                <span className="dy-email-compose-field-val" style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.78rem", color: "var(--dy-green)" }}>$0.94 to land this buyer</span>
              </div>

              <div className="dy-email-compose-body">
                {`Hi,

Saw your message about cutting our onboarding time. We are 14 people and onboarding still takes 3 weeks. Where can I book 15 minutes this week?

Marcus`}
              </div>

              <div className="dy-email-compose-footer">
                <div className="dy-email-ai-badge">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3l1.5 3.5L13 8l-3.5 1.5L8 13l-1.5-3.5L3 8l3.5-1.5z" /></svg>
                  Verified buyer
                </div>
                <span className="dy-email-stats">47 sent today · 3 buyers · $1.26 avg</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARE */}
      <section className="dy-s-compare">
        <div className="dy-wrap">
          <div className="dy-sec-intro dy-r">
            <span className="t-lbl">What we replace</span>
            <h2 className="t-h2">The 3 months you skip</h2>
            <p className="t-body">Cold email used to mean buying tools, hiring an SDR, warming inboxes for 3 weeks, and reading hundreds of replies a week. Not anymore.</p>
          </div>
          <div className="dy-compare dy-r">
            <div className="dy-cmp-bad">
              <div className="dy-cmp-head">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" /></svg>
                Without distribute
              </div>
              <ul className="dy-cmp-list">
                <li><span className="dy-cmp-icon">✕</span><span>Hire an SDR for $5,000 a month plus commission</span></li>
                <li><span className="dy-cmp-icon">✕</span><span>Buy a list tool, an email tool, a warmup tool, a CRM</span></li>
                <li><span className="dy-cmp-icon">✕</span><span>Set up a new sending domain and warm it for 3 weeks</span></li>
                <li><span className="dy-cmp-icon">✕</span><span>Write the cold emails yourself, hope they convert</span></li>
                <li><span className="dy-cmp-icon">✕</span><span>Read 200 replies a week to find the 5 real buyers</span></li>
                <li><span className="dy-cmp-icon">✕</span><span>Lose 3 months before your first booked meeting</span></li>
              </ul>
            </div>
            <div className="dy-cmp-good">
              <div className="dy-cmp-head">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 6l3 3 6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
                With distribute
              </div>
              <ul className="dy-cmp-list">
                <li><span className="dy-cmp-icon">✓</span><span>Paste your website URL</span></li>
                <li><span className="dy-cmp-icon">✓</span><span>Set a budget you control</span></li>
                <li><span className="dy-cmp-icon">✓</span><span>Reply to buyers from your Gmail</span></li>
              </ul>
              <div className="dy-cmp-foot">
                <p className="dy-cmp-note">Everything else, we run for you.</p>
                <a href={PROD_URLS.signUp} className="dy-btn dy-btn-p">Start free, $25 credits</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="dy-s-pricing" id="pricing">
        <div className="dy-wrap">
          <div className="dy-price-layout dy-r">
            <div>
              <span className="t-lbl" style={{ color: "var(--dy-accent)", display: "block", marginBottom: "0.875rem" }}>Pricing</span>
              <h2 className="t-h2" style={{ marginBottom: "1rem" }}>Pay per email. Stop anytime.</h2>
              <p className="t-body" style={{ color: "var(--dy-sub)", marginBottom: "0.875rem" }}>No subscription. No seats. You pay $0.036 per email sent and $1.42 on average for every buyer reply. Cheaper than 1 hour of an SDR.</p>
              <div className="dy-price-checks">
                <div className="dy-price-check"><span className="dy-price-check-icon">✓</span><span className="dy-price-check-text">Pre-warmed inboxes. Skip the 3-week setup.</span></div>
                <div className="dy-price-check"><span className="dy-price-check-icon">✓</span><span className="dy-price-check-text">AI reads every reply. Only buyers reach your Gmail.</span></div>
                <div className="dy-price-check"><span className="dy-price-check-icon">✓</span><span className="dy-price-check-text">$25 free credits. Enough to test the first 700 emails.</span></div>
                <div className="dy-price-check"><span className="dy-price-check-icon">✓</span><span className="dy-price-check-text">Stop or pause anytime. Your money sits unused, not spent.</span></div>
              </div>
              <a href={PROD_URLS.signUp} className="dy-btn dy-btn-p" style={{ marginTop: "2rem", display: "inline-flex" }}>Start free, $25 credits</a>
            </div>
            <div>
              <div className="dy-price-card">
                <div className="dy-price-card-head">Cold email outreach</div>
                <div className="dy-price-row"><span className="dy-price-label">Find a buyer in our database</span><span className="dy-price-value">$0.012</span></div>
                <div className="dy-price-row"><span className="dy-price-label">Write a personalized email with AI</span><span className="dy-price-value">$0.018</span></div>
                <div className="dy-price-row"><span className="dy-price-label">Send the email from a warmed inbox</span><span className="dy-price-value">$0.004</span></div>
                <div className="dy-price-row"><span className="dy-price-label">AI reads the reply and qualifies it</span><span className="dy-price-value">$0.002</span></div>
                <div className="dy-price-card-foot">
                  <div>
                    <div className="dy-price-foot-l">Per email sent</div>
                    <div className="dy-price-foot-sub">avg $1.42 per qualified buyer</div>
                  </div>
                  <span className="dy-price-foot-v">$0.036</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="dy-s-cta">
        <div className="dy-wrap">
          <div className="dy-r">
            <h2 className="t-hero">100 sales calls.<br />30 days. Go.</h2>
            <p>$25 free credits. No subscription. No credit card. Launch in 5 minutes.</p>
            <a href={PROD_URLS.signUp} className="dy-btn dy-btn-p dy-btn-lg">Start free, $25 credits</a>
          </div>
        </div>
      </section>

      <DyFooter />
    </div>
  );
}
