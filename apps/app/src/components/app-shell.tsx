"use client";

import { useState } from "react";
import { PIPELINE, STAGE_META, OUTCOME_TOTALS, type PipeLead, type Stage, type Funnel } from "@/lib/mock-data";
import type { Brand } from "./onboarding-overlay";
import {
  OverviewIcon, InfoIcon, ChevronDownIcon, ChevronLeftIcon, PlusIcon, UserIcon,
  CardIcon, GearIcon, LogoutIcon, CheckIcon, CloseIcon, CalendarIcon, CartIcon,
} from "./icons";

type Tab = "overview" | "signups" | "meetings" | "purchases" | "help" | "account" | "billing" | "brand-settings";

const TAB_TITLES: Record<Tab, string> = {
  overview: "Overview",
  signups: "Signups",
  meetings: "Meetings Booked",
  purchases: "Purchases",
  help: "Help",
  account: "Account",
  billing: "Billing",
  "brand-settings": "Brand settings",
};

// Per-page funnel config. entry = the measured/inferred stage (carries a probability),
// terminal = the confirmed stage. Stale once an entry-stage row exceeds staleDays.
type PageKey = "signups" | "meetings" | "purchases";
interface PageCfg {
  key: PageKey; title: string; funnel: Funnel; entry: Stage; terminal: Stage;
  confirmLabel: string; revertLabel: string; staleDays: number; staleNote: string; value: number;
}
const PAGE_CFG: Record<PageKey, PageCfg> = {
  signups:   { key: "signups",   title: "Signups",         funnel: "website", entry: "visited",   terminal: "signed-up",      confirmLabel: "Mark as signed up", revertLabel: "Revert to visited",       staleDays: 14,  staleNote: "no signup in 14 days",      value: 120 },
  purchases: { key: "purchases", title: "Purchases",       funnel: "website", entry: "signed-up", terminal: "purchased",      confirmLabel: "Mark as purchased", revertLabel: "Revert to signed up",     staleDays: 180, staleNote: "no purchase in 6 months",   value: 1400 },
  meetings:  { key: "meetings",  title: "Meetings Booked", funnel: "meeting", entry: "replied",   terminal: "meeting-booked", confirmLabel: "Mark as booked",    revertLabel: "Revert to positive reply", staleDays: 30,  staleNote: "no meeting in 1 month",     value: 480 },
};

const hostnameOf = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const fmtUsd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

const isStale = (l: PipeLead, c: PageCfg) => l.stage === c.entry && l.daysAgo > c.staleDays;
const isConfirmed = (l: PipeLead, c: PageCfg) => l.stage === c.terminal;
function expectedRev(l: PipeLead, c: PageCfg): number {
  if (isConfirmed(l, c)) return c.value;
  if (isStale(l, c)) return 0;
  return l.prob * c.value;
}
/** Pick the page a lead belongs to (used for Overview row clicks). */
function cfgForLead(l: PipeLead): PageCfg {
  if (l.funnel === "meeting") return PAGE_CFG.meetings;
  if (l.stage === "purchased" || l.stage === "signed-up") return PAGE_CFG.purchases;
  return PAGE_CFG.signups;
}

/** Brand logo via favicon service, initials fallback on error. */
function BrandAvatar({ brand, size = 24 }: { brand: Brand; size?: number }) {
  const [failed, setFailed] = useState(false);
  const domain = hostnameOf(brand.url);
  const initials = brand.name.replace(/^https?:\/\//, "").slice(0, 2).toUpperCase();
  if (failed || !domain) {
    return <span className="app-brand-avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>{initials}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="app-brand-avatar-img" style={{ width: size, height: size }}
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" onError={() => setFailed(true)} />
  );
}

const monoCell: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace", fontSize: "var(--fs-xs)", color: "var(--muted)" };

function StageChip({ stage }: { stage: Stage }) {
  const { label, tone } = STAGE_META[stage];
  return <span className={`pipe-status pipe-${tone}`}>{label}</span>;
}

export function AppShell({ brand, hidden, onReset }: { brand: Brand; hidden: boolean; onReset: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");

  // Pipeline lead state (mutable — confirm/revert acts on it).
  const [leads, setLeads] = useState<PipeLead[]>(PIPELINE);
  const [openId, setOpenId] = useState<number | null>(null);
  const openLead = leads.find((l) => l.id === openId) ?? null;

  // Multi-brand mock state.
  const [brands, setBrands] = useState<Brand[]>([brand]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");

  const activeBrand = brands[activeIdx] ?? brand;
  const userEmail = `adam@${hostnameOf(activeBrand.url)}`;

  const closeMenus = () => { setBrandMenuOpen(false); setUserMenuOpen(false); };

  function selectBrand(i: number) { setActiveIdx(i); setBrandMenuOpen(false); setTab("overview"); }
  function addBrand() {
    const url = newUrl.trim();
    if (!url) return;
    const norm = /^https?:\/\//.test(url) ? url : `https://${url}`;
    setBrands((b) => [...b, { name: hostnameOf(norm), url: norm }]);
    setActiveIdx(brands.length);
    setNewUrl(""); setAddOpen(false); setTab("overview");
  }
  function goSub(t: Tab) { setTab(t); setUserMenuOpen(false); }

  function confirmStage(l: PipeLead, c: PageCfg) {
    setLeads((ls) => ls.map((x) => x.id === l.id ? {
      ...x, stage: c.terminal, daysAgo: 0, prob: 1,
      events: [{ ts: "just now", label: STAGE_META[c.terminal].label, tone: STAGE_META[c.terminal].tone }, ...x.events],
    } : x));
  }
  function revertStage(l: PipeLead, c: PageCfg) {
    setLeads((ls) => ls.map((x) => x.id === l.id ? {
      ...x, stage: c.entry, prob: x.prob || 0.25,
      events: [{ ts: "just now", label: `Reverted to ${STAGE_META[c.entry].label}`, tone: "muted" }, ...x.events],
    } : x));
  }

  const navItem = (key: Tab, icon: React.ReactNode, label: string, count?: number) => (
    <li>
      <a href="#" className={tab === key ? "active" : ""} onClick={(e) => { e.preventDefault(); setTab(key); }}>
        {icon} {label}
        {count !== undefined && <span className="app-nav-count">{count}</span>}
      </a>
    </li>
  );

  return (
    <div className={`app-shell${hidden ? " app-hidden" : ""}`}>
      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="app-brand-switcher">
          <button className="app-brand-trigger" onClick={() => { setBrandMenuOpen((v) => !v); setUserMenuOpen(false); }}>
            <BrandAvatar brand={activeBrand} size={26} />
            <div className="app-brand-meta">
              <div className="app-brand-name">{activeBrand.name}</div>
              <div className="app-brand-url">{hostnameOf(activeBrand.url)}</div>
            </div>
            <ChevronDownIcon className="app-brand-caret" width={14} height={14} />
          </button>
          {brandMenuOpen && (
            <div className="app-menu app-brand-menu">
              <div className="app-menu-label">Brands</div>
              {brands.map((b, i) => (
                <button key={b.url + i} className="app-menu-item" onClick={() => selectBrand(i)}>
                  <BrandAvatar brand={b} size={20} />
                  <span className="app-menu-item-name">{b.name}</span>
                  {i === activeIdx && <CheckIcon className="app-menu-check" width={13} height={13} />}
                </button>
              ))}
              <div className="app-menu-sep" />
              <button className="app-menu-item app-menu-add" onClick={() => { setBrandMenuOpen(false); setAddOpen(true); }}>
                <PlusIcon width={14} height={14} /> Add brand
              </button>
            </div>
          )}
        </div>

        <ul className="app-nav">
          {navItem("overview", <OverviewIcon />, "Overview")}
          {navItem("signups", <UserIcon />, "Signups", OUTCOME_TOTALS.signups)}
          {navItem("meetings", <CalendarIcon />, "Meetings Booked", OUTCOME_TOTALS.meetings)}
          {navItem("purchases", <CartIcon />, "Purchases", OUTCOME_TOTALS.purchases)}
        </ul>

        <ul className="app-nav app-nav-footer">
          {navItem("brand-settings", <GearIcon />, "Settings")}
          {navItem("help", <InfoIcon />, "Help")}
        </ul>

        <div className="app-sidebar-bottom">
          <button className="app-sidebar-user" onClick={() => { setUserMenuOpen((v) => !v); setBrandMenuOpen(false); }}>
            <div className="app-sidebar-avatar">AN</div>
            <div className="app-sidebar-user-meta">
              <div className="app-sidebar-uname">Adam Nasri</div>
              <div className="app-sidebar-uemail">{userEmail}</div>
            </div>
            <ChevronDownIcon className="app-user-caret" width={14} height={14} />
          </button>
          {userMenuOpen && (
            <div className="app-menu app-user-menu">
              <div className="app-menu-userhead">
                <div className="app-sidebar-avatar">AN</div>
                <div>
                  <div className="app-sidebar-uname">Adam Nasri</div>
                  <div className="app-sidebar-uemail">{userEmail}</div>
                </div>
              </div>
              <div className="app-menu-sep" />
              <button className="app-menu-item" onClick={() => goSub("account")}><UserIcon width={15} height={15} /> Account</button>
              <button className="app-menu-item" onClick={() => goSub("billing")}><CardIcon width={15} height={15} /> Billing</button>
              <button className="app-menu-item" onClick={() => goSub("brand-settings")}><GearIcon width={15} height={15} /> Brand settings</button>
              <div className="app-menu-sep" />
              <button className="app-menu-item app-menu-danger" onClick={onReset}><LogoutIcon width={15} height={15} /> Sign out</button>
            </div>
          )}
        </div>
      </aside>

      {(brandMenuOpen || userMenuOpen) && <div className="app-menu-backdrop" onClick={closeMenus} />}

      {/* Main */}
      <main className="app-main">
        <div className="app-topbar">
          <span className="app-topbar-title">{TAB_TITLES[tab]}</span>
          <div className="app-topbar-right">
            <div className="app-date-pill">Jun 1 – Jun 7, 2026</div>
            <div className="app-live"><span className="app-live-dot" /> live</div>
            <button className="btn btn-p">+ New campaign</button>
          </div>
        </div>

        <div className="app-content">
          {tab === "overview" && <OverviewTab leads={leads} onOpen={setOpenId} />}
          {tab === "signups" && <PipelinePage cfg={PAGE_CFG.signups} leads={leads} onOpen={setOpenId} />}
          {tab === "meetings" && <PipelinePage cfg={PAGE_CFG.meetings} leads={leads} onOpen={setOpenId} />}
          {tab === "purchases" && <PipelinePage cfg={PAGE_CFG.purchases} leads={leads} onOpen={setOpenId} />}
          {tab === "help" && <HelpTab />}
          {tab === "account" && <AccountTab email={userEmail} />}
          {tab === "billing" && <BillingTab />}
          {tab === "brand-settings" && <BrandSettingsTab brand={activeBrand} />}
        </div>
      </main>

      {addOpen && (
        <div className="app-modal-overlay" onClick={() => setAddOpen(false)}>
          <div className="app-modal" onClick={(e) => e.stopPropagation()}>
            <div className="app-modal-head">
              <span className="app-modal-title">Add a brand</span>
              <button className="app-modal-close" onClick={() => setAddOpen(false)}><CloseIcon width={12} height={12} /></button>
            </div>
            <p className="ob-sub" style={{ fontSize: "var(--fs-sm)", marginBottom: "1rem" }}>Drop the product URL — we read the site and spin up a new workspace.</p>
            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label className="form-label" htmlFor="add-brand-url">Product URL</label>
              <input id="add-brand-url" className="form-input" type="url" placeholder="https://yourproduct.com" value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addBrand(); }} autoFocus />
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button className="btn btn-g" onClick={() => setAddOpen(false)}>Cancel</button>
              <button className="btn btn-p" onClick={addBrand} disabled={!newUrl.trim()}>Add brand →</button>
            </div>
          </div>
        </div>
      )}

      <EventDrawer
        lead={openLead}
        cfg={openLead ? cfgForLead(openLead) : null}
        onClose={() => setOpenId(null)}
        onConfirm={confirmStage}
        onRevert={revertStage}
      />
    </div>
  );
}

/* ── Pipeline table ── */
function ProbCell({ l, c }: { l: PipeLead; c: PageCfg }) {
  if (isConfirmed(l, c)) return <span className="pipe-prob-confirmed"><CheckIcon width={12} height={12} /> confirmed</span>;
  const pct = isStale(l, c) ? 0 : Math.round(l.prob * 100);
  return (
    <div className="pipe-prob">
      <div className="pipe-prob-bar"><div className="pipe-prob-fill" style={{ width: `${pct}%` }} /></div>
      <span className="pipe-prob-n">{pct}%</span>
    </div>
  );
}

function PipelineTable({ rows, cfg, onOpen }: { rows: PipeLead[]; cfg: PageCfg; onOpen: (id: number) => void }) {
  return (
    <table className="leads-table">
      <thead><tr><th>Company</th><th>Status</th><th>Probability</th><th>Expected revenue</th><th>Last activity</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} onClick={() => onOpen(r.id)}>
            <td>
              <div className="lead-org">
                <div className={`lead-org-logo tone-${STAGE_META[r.stage].tone}`}>{r.initials}</div>
                <div>
                  <div className="lead-org-name">{r.company}</div>
                  <div className="lead-contact">{r.contact}</div>
                </div>
              </div>
            </td>
            <td><StageChip stage={r.stage} /></td>
            <td><ProbCell l={r} c={cfg} /></td>
            <td style={monoCell}>{fmtUsd(expectedRev(r, cfg))}</td>
            <td className="lead-date">{r.daysAgo === 0 ? "today" : `${r.daysAgo}d ago`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── Signups / Meetings / Purchases ── */
function PipelinePage({ cfg, leads, onOpen }: { cfg: PageCfg; leads: PipeLead[]; onOpen: (id: number) => void }) {
  const [sub, setSub] = useState<"active" | "stale">("active");
  const mine = leads.filter((l) => l.funnel === cfg.funnel && (l.stage === cfg.entry || l.stage === cfg.terminal));
  const stale = mine.filter((l) => isStale(l, cfg));
  const active = mine.filter((l) => !isStale(l, cfg));
  const rows = sub === "active" ? active : stale;
  const expectedTotal = active.reduce((s, l) => s + expectedRev(l, cfg), 0);

  return (
    <div className="leads-panel">
      <div className="leads-header">
        <div>
          <span className="leads-title">{cfg.title}</span>
          <span className="leads-count">{fmtUsd(expectedTotal)} expected</span>
        </div>
      </div>
      <div className="leads-tabs">
        <button className={`leads-tab${sub === "active" ? " active" : ""}`} onClick={() => setSub("active")}>Active <span className="app-nav-count">{active.length}</span></button>
        <button className={`leads-tab${sub === "stale" ? " active" : ""}`} onClick={() => setSub("stale")}>Stale <span className="app-nav-count">{stale.length}</span></button>
      </div>
      {sub === "stale" && <div className="pipe-stale-note">Stale = {cfg.staleNote} → counted as 0% probability.</div>}
      {rows.length
        ? <PipelineTable rows={rows} cfg={cfg} onOpen={onOpen} />
        : <div className="empty-state"><p>{sub === "stale" ? "Nothing stale — every lead is still in play." : "Nothing here yet."}</p></div>}
    </div>
  );
}

/* ── Event-history drawer ── */
function EventDrawer({ lead, cfg, onClose, onConfirm, onRevert }: {
  lead: PipeLead | null; cfg: PageCfg | null;
  onClose: () => void; onConfirm: (l: PipeLead, c: PageCfg) => void; onRevert: (l: PipeLead, c: PageCfg) => void;
}) {
  const open = !!lead && !!cfg;
  return (
    <>
      <div className={`lead-drawer-overlay${open ? " open" : ""}`} onClick={onClose} />
      <div className={`lead-drawer${open ? " open" : ""}`}>
        {lead && cfg && (
          <>
            <div className="drawer-header">
              <button className="drawer-back" onClick={onClose}><ChevronLeftIcon width={14} height={14} /> Back</button>
              <button className="drawer-close" onClick={onClose}><CloseIcon width={12} height={12} /></button>
            </div>
            <div className="drawer-lead-info">
              <div className={`drawer-org-logo tone-${STAGE_META[lead.stage].tone}`}>{lead.initials}</div>
              <div style={{ flex: 1 }}>
                <div className="drawer-org-name">{lead.company}</div>
                <div className="drawer-contact">{lead.contact}</div>
                <div className="drawer-meta">
                  <StageChip stage={lead.stage} /> · {fmtUsd(expectedRev(lead, cfg))} expected
                  {!isConfirmed(lead, cfg) && ` · ${isStale(lead, cfg) ? 0 : Math.round(lead.prob * 100)}% likely`}
                </div>
              </div>
            </div>

            <div className="drawer-thread">
              <div className="drawer-thread-title">Event history</div>
              <div className="pipe-timeline">
                {lead.events.map((e, i) => (
                  <div className="pipe-tl-row" key={i}>
                    <div className="pipe-tl-rail">
                      <span className={`pipe-tl-dot tone-${e.tone ?? "muted"}`} />
                      {i < lead.events.length - 1 && <span className="pipe-tl-line" />}
                    </div>
                    <div className="pipe-tl-body">
                      <div className="pipe-tl-label">{e.label}</div>
                      <div className="pipe-tl-ts">{e.ts}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="drawer-actions">
              {isConfirmed(lead, cfg) ? (
                <button className="btn btn-g" style={{ flex: 1, justifyContent: "center" }} onClick={() => onRevert(lead, cfg)}>{cfg.revertLabel}</button>
              ) : (
                <button className="btn btn-p" style={{ flex: 1, justifyContent: "center" }} onClick={() => onConfirm(lead, cfg)}>{cfg.confirmLabel}</button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ── Overview ── */
function KpiInfo({ tip }: { tip: string }) {
  return (
    <span className="kpi-info-tip">
      <InfoIcon width={11} height={11} />
      <span className="kpi-info-bubble">{tip}</span>
    </span>
  );
}

function PipelineChart() {
  return (
    <svg className="pipe-chart-svg" viewBox="0 0 700 140" style={{ width: "100%", display: "block", overflow: "visible" }}>
      <line x1="30" y1="120" x2="670" y2="120" stroke="var(--muted)" strokeWidth="1" opacity="0.25" />
      <path fill="var(--green)" fillOpacity="0.08" stroke="none" d="M325.4,84.1 L374.6,75.3 L423.8,65.7 L473.1,55.5 L522.3,45.2 L571.5,34.9 L620.8,25.4 L670,15.9 L670,120 L325.4,120 Z" />
      <path fill="var(--green)" fillOpacity="0.16" stroke="none" d="M30,117.8 L79.2,113.4 L128.5,107.5 L177.7,103.1 L226.9,96.5 L276.2,89.9 L325.4,84.1 L325.4,120 L30,120 Z" />
      <path fill="none" stroke="var(--green)" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" d="M325.4,84.1 L374.6,75.3 L423.8,65.7 L473.1,55.5 L522.3,45.2 L571.5,34.9 L620.8,25.4 L670,15.9" />
      <path fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M30,117.8 L79.2,113.4 L128.5,107.5 L177.7,103.1 L226.9,96.5 L276.2,89.9 L325.4,84.1" />
      <line x1="325.4" y1="18" x2="325.4" y2="120" stroke="var(--muted)" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
      <circle cx="325.4" cy="84.1" r="3.5" fill="var(--green)" />
      <text x="10" y="134" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="var(--muted)">Jun</text>
      <text x="30" y="134" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="var(--muted)">1</text>
      <text x="177.7" y="134" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="var(--muted)">4</text>
      <text x="325.4" y="134" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="var(--green)">7 · today</text>
      <text x="473.1" y="134" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="var(--muted)">10</text>
      <text x="670" y="134" textAnchor="end" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="var(--muted)">14</text>
    </svg>
  );
}

function OverviewTab({ leads, onOpen }: { leads: PipeLead[]; onOpen: (id: number) => void }) {
  const recent = [...leads].sort((a, b) => a.daysAgo - b.daysAgo).slice(0, 5);
  return (
    <div>
      <div className="kpi-strip">
        <div className="kpi-card">
          <div className="kpi-label">Sign Ups <KpiInfo tip="Expected signups from your website visits" /></div>
          <div className="kpi-val">{OUTCOME_TOTALS.signups}</div>
          <div className="kpi-meta"><span className="kpi-delta up">+18%</span> vs last week</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Meetings Booked <KpiInfo tip="Expected meetings booked from your positive replies" /></div>
          <div className="kpi-val purple">{OUTCOME_TOTALS.meetings}</div>
          <div className="kpi-meta"><span className="kpi-delta up">27%</span> booking rate</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Purchases <KpiInfo tip="Expected purchases from signups and meetings booked" /></div>
          <div className="kpi-val green">{OUTCOME_TOTALS.purchases}</div>
          <div className="kpi-meta"><span className="kpi-delta up">2.2%</span> purchase rate</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pipeline revenue <KpiInfo tip="Expected revenue from purchases" /></div>
          <div className="kpi-val green">{fmtUsd(OUTCOME_TOTALS.pipelineRevenue)}</div>
          <div className="kpi-meta">This month</div>
        </div>
      </div>

      <div className="chart-roi-wrap">
        <div className="app-chart-wrap">
          <div className="chart-header">
            <div>
              <div className="chart-title">Pipeline revenue over time</div>
              <div className="chart-sub">Jun 1 – Jun 14, 2026</div>
            </div>
            <div className="chart-legend">
              <div className="chart-legend-item"><span className="pipe-legend-line solid" /> Actual</div>
              <div className="chart-legend-item"><span className="pipe-legend-line dashed" /> Projected</div>
            </div>
          </div>
          <PipelineChart />
        </div>

        <div className="chart-roi-side">
          <div className="kpi-card">
            <div className="roi-section">
              <div className="kpi-label">Budget spent today</div>
              <div className="kpi-val accent">58%</div>
              <div className="kpi-progress"><div className="kpi-progress-fill" style={{ width: "58%" }} /></div>
            </div>
            <div className="roi-divider" />
            <div className="roi-section">
              <div className="kpi-label">Expected ROI</div>
              <div className="kpi-val green">45x</div>
              <div className="kpi-meta">pipeline / spend</div>
            </div>
            <div className="roi-divider" />
            <div className="roi-section">
              <div className="kpi-label">Exp. revenue</div>
              <div className="kpi-val green">$9,800</div>
              <div className="kpi-meta">7 interested × $1,400</div>
            </div>
            <div className="roi-divider" />
            <div className="roi-section">
              <div className="kpi-label">Cost / contact</div>
              <div className="kpi-val purple">$0.07</div>
              <div className="kpi-meta">per contact reached</div>
            </div>
          </div>
        </div>
      </div>

      <div className="leads-panel">
        <div className="leads-header">
          <div><span className="leads-title">Recent activity</span><span className="leads-count">{recent.length} latest</span></div>
        </div>
        <table className="leads-table">
          <thead><tr><th>Company</th><th>Status</th><th>Expected revenue</th><th>Last activity</th></tr></thead>
          <tbody>
            {recent.map((r) => {
              const c = cfgForLead(r);
              return (
                <tr key={r.id} onClick={() => onOpen(r.id)}>
                  <td>
                    <div className="lead-org">
                      <div className={`lead-org-logo tone-${STAGE_META[r.stage].tone}`}>{r.initials}</div>
                      <div><div className="lead-org-name">{r.company}</div><div className="lead-contact">{r.contact}</div></div>
                    </div>
                  </td>
                  <td><StageChip stage={r.stage} /></td>
                  <td style={monoCell}>{fmtUsd(expectedRev(r, c))}</td>
                  <td className="lead-date">{r.daysAgo === 0 ? "today" : `${r.daysAgo}d ago`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Help ── */
const HELP_ITEMS = [
  { q: "What does distribute actually measure?", a: "Only two things for sure: website visits and positive email replies. Signups, meetings, and purchases are inferred with a probability until you confirm them." },
  { q: "Why does a lead show a probability?", a: "A 'Visited website' lead hasn't signed up yet — we estimate how likely they are to convert, and show the expected revenue (probability × deal value)." },
  { q: "What happens to stale leads?", a: "A visit with no signup in 14 days, a signup with no purchase in 6 months, or a reply with no meeting in 1 month drops to 0% and moves to the Stale tab." },
  { q: "Can I correct a status?", a: "Yes — open any lead and mark it signed up / purchased / booked, or revert it back. The expected revenue recomputes instantly." },
];

function HelpTab() {
  return (
    <div className="leads-panel" style={{ maxWidth: 720 }}>
      <div className="leads-header"><span className="leads-title">Help &amp; FAQ</span></div>
      <div style={{ padding: "0.5rem 0" }}>
        {HELP_ITEMS.map((h) => (
          <div key={h.q} className="help-row">
            <div className="help-q">{h.q}</div>
            <div className="help-a">{h.a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Account ── */
function AccountTab({ email }: { email: string }) {
  return (
    <div className="leads-panel" style={{ maxWidth: 640 }}>
      <div className="leads-header"><span className="leads-title">Your account</span></div>
      <div style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
          <div className="app-sidebar-avatar" style={{ width: "3rem", height: "3rem", fontSize: "1rem" }}>AN</div>
          <div>
            <div style={{ fontSize: "var(--fs-md)", fontWeight: 700, color: "var(--text)" }}>Adam Nasri</div>
            <div style={{ fontSize: "var(--fs-sm)", color: "var(--muted)" }}>{email}</div>
          </div>
        </div>
        <div className="ob-field-table">
          <SettingRow label="Full name" value="Adam Nasri" />
          <SettingRow label="Email" value={email} />
          <SettingRow label="Role" value="Founder" />
        </div>
      </div>
    </div>
  );
}

/* ── Billing ── */
const INVOICES = [
  { date: "Jun 1, 2026", amount: "$58.00", status: "Paid" },
  { date: "May 1, 2026", amount: "$58.00", status: "Paid" },
  { date: "Apr 1, 2026", amount: "$29.00", status: "Paid" },
];

function BillingTab() {
  return (
    <div>
      <div className="kpi-strip">
        <div className="kpi-card"><div className="kpi-label">Current plan</div><div className="kpi-val">Recommended</div><div className="kpi-meta">$58 / day budget</div></div>
        <div className="kpi-card"><div className="kpi-label">Spent this month</div><div className="kpi-val accent">$412</div><div className="kpi-meta">of ~$1,740 cap</div></div>
        <div className="kpi-card"><div className="kpi-label">Auto top-up</div><div className="kpi-val green">On</div><div className="kpi-meta">+$100 below $20</div></div>
      </div>
      <div className="leads-panel" style={{ marginBottom: "2rem", maxWidth: 640 }}>
        <div className="leads-header">
          <span className="leads-title">Payment method</span>
          <button className="btn btn-g" style={{ fontSize: "var(--fs-xs)", padding: "0.35rem 0.75rem" }}>Update</button>
        </div>
        <div style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <CardIcon width={18} height={18} />
          <span style={{ fontSize: "var(--fs-sm)", color: "var(--text)" }}>Visa •••• 4242</span>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--muted)", marginLeft: "auto" }}>expires 08 / 28</span>
        </div>
      </div>
      <div className="leads-panel">
        <div className="leads-header"><span className="leads-title">Invoices</span></div>
        <table className="leads-table">
          <thead><tr><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {INVOICES.map((inv) => (
              <tr key={inv.date}><td className="lead-date">{inv.date}</td><td style={monoCell}>{inv.amount}</td><td><span className="pipe-status pipe-green">{inv.status}</span></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Brand settings ── */
function BrandSettingsTab({ brand }: { brand: Brand }) {
  return (
    <div className="leads-panel" style={{ maxWidth: 640 }}>
      <div className="leads-header">
        <span className="leads-title">Brand settings</span>
        <button className="btn btn-p" style={{ fontSize: "var(--fs-xs)", padding: "0.35rem 0.75rem" }}>Save changes</button>
      </div>
      <div style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <BrandAvatar brand={brand} size={40} />
          <div>
            <div style={{ fontSize: "var(--fs-md)", fontWeight: 700, color: "var(--text)" }}>{brand.name}</div>
            <div style={{ fontSize: "var(--fs-sm)", color: "var(--accent)", fontFamily: "'JetBrains Mono', monospace" }}>{hostnameOf(brand.url)}</div>
          </div>
        </div>
        <div className="ob-field-table">
          <SettingRow label="Brand name" value={brand.name} />
          <SettingRow label="URL" value={brand.url} />
          <SettingRow label="Audience" value="Founders and AI teams at early-stage SaaS building with LLMs" />
          <SettingRow label="Value" value="Cut AI prompt iteration time by 60% with a collaborative prompt library" />
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="ob-field-row">
      <div className="ob-field-key">{label}</div>
      <div className="ob-field-val"><input defaultValue={value} /></div>
    </div>
  );
}
