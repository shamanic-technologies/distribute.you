"use client";

import { useState } from "react";
import {
  PIPELINE, STAGE_META, OUTCOME_TOTALS, MOCK_CAMPAIGNS,
  type PipeLead, type Stage, type Funnel, type MockCampaign,
} from "@/lib/mock-data";
import type { Brand } from "./onboarding-overlay";
import {
  OverviewIcon, InfoIcon, ChevronDownIcon, ChevronLeftIcon, PlusIcon, UserIcon,
  CardIcon, GearIcon, LogoutIcon, CheckIcon, CloseIcon, CalendarIcon, CartIcon,
  MenuIcon, LeadsIcon, CampaignIcon,
} from "./icons";

type Tab =
  | "overview" | "signups" | "meetings" | "purchases" | "campaigns" | "help"
  | "settings-brand" | "settings-org" | "settings-account" | "settings-billing" | "settings-campaign";

const TAB_TITLES: Record<Tab, string> = {
  overview:            "Overview",
  signups:             "Signups",
  meetings:            "Meetings Booked",
  purchases:           "Purchases",
  campaigns:           "Campaigns",
  help:                "Help",
  "settings-brand":    "Brand settings",
  "settings-org":      "Org settings",
  "settings-account":  "My account",
  "settings-billing":  "Billing",
  "settings-campaign": "Campaign settings",
};

// Sub-tabs per settings page — each renders its own panel (see SettingsSubNav consumers).
const SETTINGS_SUBTABS: Partial<Record<Tab, string[]>> = {
  "settings-account":  ["Profile", "Notifications", "Security"],
  "settings-billing":  ["Plan", "Payment", "Invoices"],
  "settings-brand":    ["General", "Audience & ICP", "Tracking"],
  "settings-org":      ["General", "Team", "Integrations"],
  "settings-campaign": ["General", "Budget", "Targeting", "Funnel"],
};

type PageKey = "signups" | "meetings" | "purchases";
interface PageCfg {
  key: PageKey; title: string; funnel: Funnel; entry: Stage; terminal: Stage;
  confirmLabel: string; revertLabel: string; staleDays: number; staleNote: string; value: number;
}
const PAGE_CFG: Record<PageKey, PageCfg> = {
  signups:   { key: "signups",   title: "Signups",         funnel: "website", entry: "visited",   terminal: "signed-up",      confirmLabel: "Mark as signed up", revertLabel: "Revert to visited",        staleDays: 14,  staleNote: "no signup in 14 days",     value: 120  },
  purchases: { key: "purchases", title: "Purchases",       funnel: "website", entry: "signed-up", terminal: "purchased",      confirmLabel: "Mark as purchased", revertLabel: "Revert to signed up",      staleDays: 180, staleNote: "no purchase in 6 months",  value: 1400 },
  meetings:  { key: "meetings",  title: "Meetings Booked", funnel: "meeting", entry: "replied",   terminal: "meeting-booked", confirmLabel: "Mark as booked",    revertLabel: "Revert to positive reply", staleDays: 30,  staleNote: "no meeting in 1 month",    value: 480  },
};

const hostnameOf = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const fmtUsd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

const isStale     = (l: PipeLead, c: PageCfg) => l.stage === c.entry && l.daysAgo > c.staleDays;
const isConfirmed = (l: PipeLead, c: PageCfg) => l.stage === c.terminal;
function expectedRev(l: PipeLead, c: PageCfg): number {
  if (isConfirmed(l, c)) return c.value;
  if (isStale(l, c)) return 0;
  return l.prob * c.value;
}
function cfgForLead(l: PipeLead): PageCfg {
  if (l.funnel === "meeting") return PAGE_CFG.meetings;
  if (l.stage === "purchased" || l.stage === "signed-up") return PAGE_CFG.purchases;
  return PAGE_CFG.signups;
}

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

function LiveBadge() {
  return (
    <span className="app-live app-live-body">
      <span className="app-live-dot" /> live
    </span>
  );
}

function Breadcrumb({ tab, campaignName, subLabel }: { tab: Tab; campaignName: string | null; subLabel?: string | null }) {
  if (tab.startsWith("settings-")) {
    return (
      <span className="app-topbar-title">
        <span className="app-breadcrumb-parent">Settings</span>
        <span className="app-breadcrumb-sep"> › </span>
        <span className={subLabel ? "app-breadcrumb-parent" : "app-breadcrumb-current"}>{TAB_TITLES[tab]}</span>
        {subLabel && (
          <>
            <span className="app-breadcrumb-sep"> › </span>
            <span className="app-breadcrumb-current">{subLabel}</span>
          </>
        )}
      </span>
    );
  }
  if (campaignName) {
    if (tab === "overview") return <span className="app-topbar-title">{campaignName}</span>;
    return (
      <span className="app-topbar-title">
        <span className="app-breadcrumb-parent">{campaignName}</span>
        <span className="app-breadcrumb-sep"> › </span>
        <span className="app-breadcrumb-current">{TAB_TITLES[tab] ?? tab}</span>
      </span>
    );
  }
  return <span className="app-topbar-title">{TAB_TITLES[tab] ?? "Overview"}</span>;
}

/* ══════════════════════════════════════════════
   APP SHELL
═══════════════════════════════════════════════ */
export function AppShell({ brand, hidden, onReset }: { brand: Brand; hidden: boolean; onReset: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");

  const [leads, setLeads] = useState<PipeLead[]>(PIPELINE);
  const [openId, setOpenId] = useState<number | null>(null);
  const openLead = leads.find((l) => l.id === openId) ?? null;

  const [brands, setBrands] = useState<Brand[]>([brand]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<MockCampaign | null>(null);
  const [subTab, setSubTab] = useState(0); // active settings sub-tab index (reset on every nav)

  const activeBrand = brands[activeIdx] ?? brand;
  const userEmail = `adam@${hostnameOf(activeBrand.url)}`;
  const [workspaceName] = useState(() => hostnameOf(brand.url) || brand.name);

  // Leads filtered to the active campaign (or all in brand mode)
  const visibleLeads = activeCampaign
    ? leads.filter((l) => activeCampaign.leadIds.includes(l.id))
    : leads;

  // KPI totals — campaign-scoped or global
  const totals = activeCampaign ? {
    signups:         visibleLeads.filter(l => l.funnel === "website" && (l.stage === "signed-up" || l.stage === "purchased")).length,
    meetings:        visibleLeads.filter(l => l.funnel === "meeting" && l.stage === "meeting-booked").length,
    purchases:       visibleLeads.filter(l => l.stage === "purchased").length,
    pipelineRevenue: visibleLeads.reduce((s, l) => s + expectedRev(l, cfgForLead(l)), 0),
  } : OUTCOME_TOTALS;

  const closeMenus = () => { setBrandMenuOpen(false); setUserMenuOpen(false); };

  function selectBrand(i: number) { setActiveIdx(i); setBrandMenuOpen(false); setNavOpen(false); setTab("overview"); setSubTab(0); setActiveCampaign(null); }
  function addBrand() {
    const url = newUrl.trim();
    if (!url) return;
    const norm = /^https?:\/\//.test(url) ? url : `https://${url}`;
    setBrands((b) => [...b, { name: hostnameOf(norm), url: norm }]);
    setActiveIdx(brands.length);
    setNewUrl(""); setAddOpen(false); setTab("overview"); setSubTab(0); setActiveCampaign(null);
  }
  function goSub(t: Tab) { setTab(t); setSubTab(0); setUserMenuOpen(false); setNavOpen(false); }

  function enterCampaign(c: MockCampaign) { setActiveCampaign(c); setTab("overview"); setSubTab(0); setNavOpen(false); }
  function exitCampaign() { setActiveCampaign(null); setTab("campaigns"); setSubTab(0); }

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
    <li key={key}>
      <a href="#" className={tab === key ? "active" : ""} onClick={(e) => { e.preventDefault(); setTab(key); setSubTab(0); setNavOpen(false); }}>
        {icon} {label}
        {count !== undefined && <span className="app-nav-count">{count}</span>}
      </a>
    </li>
  );

  return (
    <div className={`app-shell${hidden ? " app-hidden" : ""}`}>
      {/* ── Sidebar ── */}
      <aside className={`app-sidebar${navOpen ? " open" : ""}`}>

        {/* Workspace → Brand → Campaign hierarchy */}
        <div className="app-workspace-header">
          <div className="app-workspace-row">
            <span className="app-workspace-icon">{workspaceName.slice(0, 1).toUpperCase()}</span>
            <span className="app-workspace-name">{workspaceName}</span>
          </div>

          <div className="app-brand-row">
            <button className="app-brand-trigger" onClick={() => { setBrandMenuOpen((v) => !v); setUserMenuOpen(false); }}>
              <BrandAvatar brand={activeBrand} size={16} />
              <span className="app-brand-name">{activeBrand.name}</span>
              <ChevronDownIcon className="app-brand-caret" width={11} height={11} />
            </button>
            {brandMenuOpen && (
              <div className="app-menu app-brand-menu">
                <div className="app-menu-label">Brands</div>
                {brands.map((b, i) => (
                  <button key={b.url + i} className="app-menu-item" onClick={() => selectBrand(i)}>
                    <BrandAvatar brand={b} size={18} />
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

          {activeCampaign && (
            <div className="app-campaign-row">
              <button className="app-campaign-back" onClick={exitCampaign} title="Back to all campaigns">
                <ChevronLeftIcon width={11} height={11} />
              </button>
              <span className="app-campaign-name">{activeCampaign.name}</span>
            </div>
          )}
        </div>

        {/* Main nav */}
        <ul className="app-nav">
          {navItem("overview",  <OverviewIcon />,  "Overview")}
          {navItem("signups",   <UserIcon />,      "Signups",         totals.signups)}
          {navItem("meetings",  <CalendarIcon />,  "Meetings Booked", totals.meetings)}
          {navItem("purchases", <CartIcon />,      "Purchases",       totals.purchases)}
          {!activeCampaign && navItem("campaigns", <CampaignIcon />, "Campaigns", MOCK_CAMPAIGNS.length)}
        </ul>

        {/* Campaign settings button (campaign mode only) */}
        {activeCampaign && (
          <div className="app-campaign-settings-block">
            <button
              className={`app-campaign-settings-link${tab === "settings-campaign" ? " active" : ""}`}
              onClick={() => { setTab("settings-campaign"); setSubTab(0); setNavOpen(false); }}
            >
              <GearIcon width={14} height={14} /> Campaign settings
            </button>
          </div>
        )}

        {/* Footer */}
        <ul className="app-nav app-nav-footer">
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
              <button className="app-menu-item" onClick={() => goSub("settings-account")}><UserIcon width={15} height={15} /> My account</button>
              <button className="app-menu-item" onClick={() => goSub("settings-brand")}><GearIcon width={15} height={15} /> Brand settings</button>
              <button className="app-menu-item" onClick={() => goSub("settings-org")}><LeadsIcon width={15} height={15} /> Org settings</button>
              <button className="app-menu-item" onClick={() => goSub("settings-billing")}><CardIcon width={15} height={15} /> Billing</button>
              <div className="app-menu-sep" />
              <button className="app-menu-item app-menu-danger" onClick={onReset}><LogoutIcon width={15} height={15} /> Sign out</button>
            </div>
          )}
        </div>
      </aside>

      {(brandMenuOpen || userMenuOpen) && <div className="app-menu-backdrop" onClick={closeMenus} />}
      {navOpen && <div className="app-nav-backdrop" onClick={() => setNavOpen(false)} />}

      {/* ── Main ── */}
      <main className="app-main">
        <div className="app-topbar">
          <button className="app-burger" onClick={() => setNavOpen(true)} aria-label="Open menu">
            <MenuIcon width={18} height={18} />
          </button>
          <Breadcrumb tab={tab} campaignName={activeCampaign?.name ?? null} subLabel={SETTINGS_SUBTABS[tab]?.[subTab] ?? null} />
          <div className="app-topbar-right" />
        </div>

        <div className="app-content">
          {tab === "overview"          && <OverviewTab leads={visibleLeads} onOpen={setOpenId} totals={totals} />}
          {tab === "signups"           && <PipelinePage cfg={PAGE_CFG.signups}   leads={visibleLeads} onOpen={setOpenId} campaignMode={!!activeCampaign} />}
          {tab === "meetings"          && <PipelinePage cfg={PAGE_CFG.meetings}  leads={visibleLeads} onOpen={setOpenId} campaignMode={!!activeCampaign} />}
          {tab === "purchases"         && <PipelinePage cfg={PAGE_CFG.purchases} leads={visibleLeads} onOpen={setOpenId} campaignMode={!!activeCampaign} />}
          {tab === "campaigns"         && !activeCampaign && <CampaignsPage campaigns={MOCK_CAMPAIGNS} leads={leads} onSelect={enterCampaign} />}
          {tab === "help"              && <HelpTab />}
          {tab === "settings-account"  && <AccountTab email={userEmail} sub={subTab} setSub={setSubTab} />}
          {tab === "settings-billing"  && <BillingTab sub={subTab} setSub={setSubTab} />}
          {tab === "settings-brand"    && <BrandSettingsTab brand={activeBrand} sub={subTab} setSub={setSubTab} />}
          {tab === "settings-org"      && <OrgSettingsTab email={userEmail} sub={subTab} setSub={setSubTab} />}
          {tab === "settings-campaign" && activeCampaign && <CampaignSettingsPage campaign={activeCampaign} sub={subTab} setSub={setSubTab} />}
        </div>
      </main>

      {/* Add brand modal */}
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

/* ══════════════════════════════════════════════
   CAMPAIGNS LIST PAGE
═══════════════════════════════════════════════ */
function CampaignsPage({ campaigns, leads, onSelect }: {
  campaigns: MockCampaign[];
  leads: PipeLead[];
  onSelect: (c: MockCampaign) => void;
}) {
  const liveCount  = campaigns.filter(c => c.status === "live").length;
  const liveBudget = campaigns.filter(c => c.status === "live").reduce((s, c) => s + c.budgetPerDay, 0);

  function cStats(c: MockCampaign) {
    const cl = leads.filter(l => c.leadIds.includes(l.id));
    return {
      signups:   cl.filter(l => l.funnel === "website" && (l.stage === "signed-up" || l.stage === "purchased")).length,
      meetings:  cl.filter(l => l.funnel === "meeting" && l.stage === "meeting-booked").length,
      purchases: cl.filter(l => l.stage === "purchased").length,
      revenue:   cl.reduce((s, l) => s + expectedRev(l, cfgForLead(l)), 0),
    };
  }

  const totalPurchases = campaigns.reduce((s, c) => s + cStats(c).purchases, 0);

  return (
    <div>
      <div className="kpi-strip" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="kpi-card">
          <div className="kpi-label">Active campaigns</div>
          <div className="kpi-val accent">{liveCount}</div>
          <div className="kpi-meta">{campaigns.length - liveCount} paused</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Daily budget</div>
          <div className="kpi-val">${liveBudget}</div>
          <div className="kpi-meta">across live campaigns</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total purchases</div>
          <div className="kpi-val green">{totalPurchases}</div>
          <div className="kpi-meta">confirmed</div>
        </div>
      </div>

      <div className="leads-panel">
        <div className="leads-header">
          <span className="leads-title">Campaigns</span>
          <span className="leads-count">{campaigns.length} total</span>
        </div>
        <table className="leads-table">
          <thead><tr>
            <th>Campaign</th><th>Status</th><th>Budget</th>
            <th>Signups</th><th>Meetings</th><th>Purchases</th><th>Pipeline</th>
          </tr></thead>
          <tbody>
            {campaigns.map(c => {
              const s = cStats(c);
              return (
                <tr key={c.id} onClick={() => onSelect(c)}>
                  <td><div className="lead-org-name">{c.name}</div></td>
                  <td>
                    {c.status === "live"
                      ? <span className="pipe-status pipe-green">● live</span>
                      : <span className="pipe-status" style={{ background: "var(--surface-hi)", color: "var(--muted)", borderColor: "var(--border-hi)" }}>○ paused</span>}
                  </td>
                  <td style={monoCell}>{c.budgetPerDay > 0 ? `$${c.budgetPerDay}/day` : "—"}</td>
                  <td style={monoCell}>{s.signups}</td>
                  <td style={monoCell}>{s.meetings}</td>
                  <td style={monoCell}>{s.purchases}</td>
                  <td style={monoCell}>{fmtUsd(s.revenue)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   PIPELINE TABLE
═══════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════
   PIPELINE PAGE (Signups / Meetings / Purchases)
═══════════════════════════════════════════════ */
function CampaignSettingsPanel({ cfg, onClose }: { cfg: PageCfg; onClose: () => void }) {
  return (
    <div className="campaign-settings-panel">
      <div className="campaign-settings-head">
        <span className="leads-title" style={{ fontSize: "var(--fs-sm)" }}>Campaign settings — {cfg.title}</span>
        <button className="app-modal-close" onClick={onClose}><CloseIcon width={11} height={11} /></button>
      </div>
      <div className="ob-field-table" style={{ marginBottom: "1rem" }}>
        <SettingRow label="Budget"   value="$58 / day" />
        <SettingRow label="Status"   value="live" />
        <SettingRow label="Audience" value="Founders and AI teams at early-stage SaaS" />
        <SettingRow label="Goal"     value={`${cfg.title} — ${cfg.confirmLabel}`} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-p" style={{ fontSize: "var(--fs-xs)", padding: "0.35rem 0.75rem" }}>Save changes</button>
      </div>
    </div>
  );
}

function PipelinePage({ cfg, leads, onOpen, campaignMode }: {
  cfg: PageCfg; leads: PipeLead[]; onOpen: (id: number) => void; campaignMode?: boolean;
}) {
  const [sub, setSub] = useState<"active" | "stale">("active");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const mine = leads.filter((l) => l.funnel === cfg.funnel && (l.stage === cfg.entry || l.stage === cfg.terminal));
  const stale  = mine.filter((l) =>  isStale(l, cfg));
  const active = mine.filter((l) => !isStale(l, cfg));
  const rows = sub === "active" ? active : stale;
  const expectedTotal = active.reduce((s, l) => s + expectedRev(l, cfg), 0);

  return (
    <div className="leads-panel">
      <div className="leads-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <span className="leads-title">{cfg.title}</span>
          <span className="leads-count">{fmtUsd(expectedTotal)} expected</span>
          <LiveBadge />
        </div>
        {!campaignMode && (
          <button
            className={`btn btn-g campaign-settings-btn${settingsOpen ? " active" : ""}`}
            onClick={() => setSettingsOpen((v) => !v)}
            title="Campaign settings"
          >
            <GearIcon width={13} height={13} /> Settings
          </button>
        )}
      </div>

      {!campaignMode && settingsOpen && <CampaignSettingsPanel cfg={cfg} onClose={() => setSettingsOpen(false)} />}

      <div className="leads-tabs">
        <button className={`leads-tab${sub === "active" ? " active" : ""}`} onClick={() => setSub("active")}>Active <span className="app-nav-count">{active.length}</span></button>
        <button className={`leads-tab${sub === "stale"  ? " active" : ""}`} onClick={() => setSub("stale")}>Stale <span className="app-nav-count">{stale.length}</span></button>
      </div>
      {sub === "stale" && <div className="pipe-stale-note">Stale = {cfg.staleNote} → counted as 0% probability.</div>}
      {rows.length
        ? <PipelineTable rows={rows} cfg={cfg} onOpen={onOpen} />
        : <div className="empty-state"><p>{sub === "stale" ? "Nothing stale — every lead is still in play." : "Nothing here yet."}</p></div>}
    </div>
  );
}

/* ══════════════════════════════════════════════
   EVENT-HISTORY DRAWER
═══════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════
   OVERVIEW
═══════════════════════════════════════════════ */
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
      <text x="30" y="134" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="var(--muted)">Day 1</text>
      <text x="177.7" y="134" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="var(--muted)">Day 4</text>
      <text x="325.4" y="134" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="var(--green)">today</text>
      <text x="473.1" y="134" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="var(--muted)">Day 10</text>
      <text x="670" y="134" textAnchor="end" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="var(--muted)">Day 14</text>
    </svg>
  );
}

type Totals = { signups: number; meetings: number; purchases: number; pipelineRevenue: number };

function OverviewTab({ leads, onOpen, totals }: { leads: PipeLead[]; onOpen: (id: number) => void; totals: Totals }) {
  const recent = [...leads].sort((a, b) => a.daysAgo - b.daysAgo).slice(0, 5);
  return (
    <div>
      <div className="overview-live-row">
        <LiveBadge />
        <span className="overview-live-label">Campaign running — distribute is actively sending outreach</span>
      </div>

      <div className="kpi-strip">
        <div className="kpi-card">
          <div className="kpi-label">Sign Ups <KpiInfo tip="Expected signups from your website visits" /></div>
          <div className="kpi-val">{totals.signups}</div>
          <div className="kpi-meta"><span className="kpi-delta up">+18%</span> vs last week</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Meetings Booked <KpiInfo tip="Expected meetings booked from your positive replies" /></div>
          <div className="kpi-val purple">{totals.meetings}</div>
          <div className="kpi-meta"><span className="kpi-delta up">27%</span> booking rate</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Purchases <KpiInfo tip="Expected purchases from signups and meetings booked" /></div>
          <div className="kpi-val green">{totals.purchases}</div>
          <div className="kpi-meta"><span className="kpi-delta up">2.2%</span> purchase rate</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pipeline revenue <KpiInfo tip="Expected revenue from purchases" /></div>
          <div className="kpi-val green">{fmtUsd(totals.pipelineRevenue)}</div>
          <div className="kpi-meta">This month</div>
        </div>
      </div>

      <div className="chart-roi-wrap">
        <div className="app-chart-wrap">
          <div className="chart-header">
            <div>
              <div className="chart-title">Pipeline revenue over time</div>
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

/* ══════════════════════════════════════════════
   HELP
═══════════════════════════════════════════════ */
const HELP_ITEMS = [
  { q: "What does distribute actually measure?", a: "Only two things for sure: website visits and positive email replies. Signups, meetings, and purchases are inferred with a probability until you confirm them." },
  { q: "Why does a lead show a probability?",    a: "A 'Visited website' lead hasn't signed up yet — we estimate how likely they are to convert, and show the expected revenue (probability × deal value)." },
  { q: "What happens to stale leads?",           a: "A visit with no signup in 14 days, a signup with no purchase in 6 months, or a reply with no meeting in 1 month drops to 0% and moves to the Stale tab." },
  { q: "Can I correct a status?",               a: "Yes — open any lead and mark it signed up / purchased / booked, or revert it back. The expected revenue recomputes instantly." },
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

/* ══════════════════════════════════════════════
   SETTINGS — SHARED UTILS
═══════════════════════════════════════════════ */
function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="ob-field-row">
      <div className="ob-field-key">{label}</div>
      <div className="ob-field-val"><input defaultValue={value} /></div>
    </div>
  );
}

function SettingsHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="leads-header">
      <span className="leads-title">{title}</span>
      {action}
    </div>
  );
}

function SaveBtn() {
  return <button className="btn btn-p" style={{ fontSize: "var(--fs-xs)", padding: "0.35rem 0.75rem" }}>Save changes</button>;
}

/** Functional settings sub-nav: each item swaps the panel below. */
function SettingsSubNav({ items, active, onPick }: { items: string[]; active: number; onPick: (i: number) => void }) {
  return (
    <div className="settings-sub-nav">
      {items.map((it, i) => (
        <button key={it} className={`settings-sub-nav-item${i === active ? " active" : ""}`} onClick={() => onPick(i)}>{it}</button>
      ))}
    </div>
  );
}

/** Toggle row used in Notifications / Integrations panels. */
function ToggleRow({ label, desc, on }: { label: string; desc: string; on: boolean }) {
  const [checked, setChecked] = useState(on);
  return (
    <div className="settings-toggle-row">
      <div>
        <div className="settings-toggle-label">{label}</div>
        <div className="settings-toggle-desc">{desc}</div>
      </div>
      <button className={`settings-switch${checked ? " on" : ""}`} onClick={() => setChecked((v) => !v)} aria-pressed={checked}>
        <span className="settings-switch-knob" />
      </button>
    </div>
  );
}

const panelPad: React.CSSProperties = { padding: "1.5rem" };

/* ══════════════════════════════════════════════
   SETTINGS — MY ACCOUNT
═══════════════════════════════════════════════ */
interface SettingsTabProps { sub: number; setSub: (n: number) => void }

function AccountTab({ email, sub, setSub }: { email: string } & SettingsTabProps) {
  return (
    <div className="leads-panel" style={{ maxWidth: 640 }}>
      <SettingsHeader title="My account" action={<SaveBtn />} />
      <SettingsSubNav items={SETTINGS_SUBTABS["settings-account"]!} active={sub} onPick={setSub} />

      {sub === 0 && (
        <div style={panelPad}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
            <div className="app-sidebar-avatar" style={{ width: "3rem", height: "3rem", fontSize: "1rem" }}>AN</div>
            <div>
              <div style={{ fontSize: "var(--fs-md)", fontWeight: 700, color: "var(--text)" }}>Adam Nasri</div>
              <div style={{ fontSize: "var(--fs-sm)", color: "var(--muted)" }}>{email}</div>
            </div>
          </div>
          <div className="ob-field-table">
            <SettingRow label="Full name" value="Adam Nasri" />
            <SettingRow label="Email"     value={email} />
            <SettingRow label="Role"      value="Founder" />
            <SettingRow label="Time zone" value="America / New York" />
          </div>
        </div>
      )}

      {sub === 1 && (
        <div style={panelPad}>
          <ToggleRow label="Weekly summary"     desc="A digest of pipeline, outcomes and spend every Monday." on />
          <ToggleRow label="New positive reply" desc="Email me the moment a lead replies positively." on />
          <ToggleRow label="Stale lead alert"   desc="Notify when a lead goes stale and drops to 0%." on={false} />
          <ToggleRow label="Budget warnings"    desc="Tell me when a campaign nears its daily cap." on />
          <ToggleRow label="Product updates"    desc="Occasional news about new features." on={false} />
        </div>
      )}

      {sub === 2 && (
        <div style={panelPad}>
          <div className="ob-field-table" style={{ marginBottom: "1.5rem" }}>
            <SettingRow label="Current password" value="••••••••••" />
            <SettingRow label="New password"     value="" />
            <SettingRow label="Confirm password" value="" />
          </div>
          <ToggleRow label="Two-factor authentication" desc="Require a one-time code at sign-in." on={false} />
          <ToggleRow label="Active sessions"           desc="1 device · this browser · New York, US." on />
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   SETTINGS — BILLING
═══════════════════════════════════════════════ */
const INVOICES = [
  { date: "Jun 1, 2026",  amount: "$58.00", status: "Paid" },
  { date: "May 1, 2026",  amount: "$58.00", status: "Paid" },
  { date: "Apr 1, 2026",  amount: "$29.00", status: "Paid" },
];

const PLAN_TIERS = [
  { name: "Starter",     price: "$29 / day",  note: "~5 closes / mo",  current: false },
  { name: "Recommended", price: "$58 / day",  note: "~10 closes / mo", current: true  },
  { name: "Growth",      price: "$115 / day", note: "~20 closes / mo", current: false },
];

function BillingTab({ sub, setSub }: SettingsTabProps) {
  return (
    <div style={{ maxWidth: 720 }}>
      <div className="kpi-strip">
        <div className="kpi-card"><div className="kpi-label">Current plan</div><div className="kpi-val">Recommended</div><div className="kpi-meta">$58 / day budget</div></div>
        <div className="kpi-card"><div className="kpi-label">Spent this month</div><div className="kpi-val accent">$412</div><div className="kpi-meta">of ~$1,740 cap</div></div>
        <div className="kpi-card"><div className="kpi-label">Auto top-up</div><div className="kpi-val green">On</div><div className="kpi-meta">+$100 below $20</div></div>
      </div>

      <div className="leads-panel">
        <SettingsHeader title="Billing" action={<SaveBtn />} />
        <SettingsSubNav items={SETTINGS_SUBTABS["settings-billing"]!} active={sub} onPick={setSub} />

        {sub === 0 && (
          <div style={panelPad}>
            <div className="billing-tier-grid">
              {PLAN_TIERS.map((t) => (
                <div key={t.name} className={`billing-tier${t.current ? " current" : ""}`}>
                  {t.current && <span className="billing-tier-badge">Current</span>}
                  <div className="billing-tier-name">{t.name}</div>
                  <div className="billing-tier-price">{t.price}</div>
                  <div className="billing-tier-note">{t.note}</div>
                  <button className={`btn ${t.current ? "btn-g" : "btn-p"}`} style={{ width: "100%", justifyContent: "center", marginTop: "0.75rem", fontSize: "var(--fs-xs)" }} disabled={t.current}>
                    {t.current ? "Active" : "Switch"}
                  </button>
                </div>
              ))}
            </div>
            <div className="settings-toggle-row" style={{ marginTop: "1.25rem" }}>
              <div>
                <div className="settings-toggle-label">Auto top-up</div>
                <div className="settings-toggle-desc">Add $100 when the balance drops below $20.</div>
              </div>
              <span className="pipe-status pipe-green">On</span>
            </div>
          </div>
        )}

        {sub === 1 && (
          <div style={panelPad}>
            <div className="billing-card-row">
              <CardIcon width={20} height={20} />
              <span style={{ fontSize: "var(--fs-sm)", color: "var(--text)", fontWeight: 600 }}>Visa •••• 4242</span>
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--muted)", marginLeft: "auto" }}>expires 08 / 28</span>
              <button className="btn btn-g" style={{ fontSize: "var(--fs-xs)", padding: "0.3rem 0.7rem" }}>Update</button>
            </div>
            <div className="ob-field-table" style={{ marginTop: "1.25rem" }}>
              <SettingRow label="Billing email" value="billing@prompthub.ai" />
              <SettingRow label="Company name" value="Prompthub Inc." />
              <SettingRow label="Tax / VAT ID" value="—" />
              <SettingRow label="Country"      value="United States" />
            </div>
          </div>
        )}

        {sub === 2 && (
          <table className="leads-table">
            <thead><tr><th>Date</th><th>Amount</th><th>Status</th><th>Invoice</th></tr></thead>
            <tbody>
              {INVOICES.map((inv) => (
                <tr key={inv.date}>
                  <td className="lead-date">{inv.date}</td>
                  <td style={monoCell}>{inv.amount}</td>
                  <td><span className="pipe-status pipe-green">{inv.status}</span></td>
                  <td style={{ fontSize: "var(--fs-xs)", color: "var(--accent)" }}>Download</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   SETTINGS — BRAND
═══════════════════════════════════════════════ */
function BrandSettingsTab({ brand, sub, setSub }: { brand: Brand } & SettingsTabProps) {
  return (
    <div className="leads-panel" style={{ maxWidth: 640 }}>
      <SettingsHeader title="Brand settings" action={<SaveBtn />} />
      <SettingsSubNav items={SETTINGS_SUBTABS["settings-brand"]!} active={sub} onPick={setSub} />

      {sub === 0 && (
        <div style={panelPad}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <BrandAvatar brand={brand} size={40} />
            <div>
              <div style={{ fontSize: "var(--fs-md)", fontWeight: 700, color: "var(--text)" }}>{brand.name}</div>
              <div style={{ fontSize: "var(--fs-sm)", color: "var(--accent)", fontFamily: "'JetBrains Mono', monospace" }}>{hostnameOf(brand.url)}</div>
            </div>
          </div>
          <div className="ob-field-table">
            <SettingRow label="Brand name"  value={brand.name} />
            <SettingRow label="URL"         value={brand.url} />
            <SettingRow label="One-liner"   value="A collaborative prompt library for AI teams" />
            <SettingRow label="Value"       value="Cut prompt iteration time by 60% with a shared, versioned library" />
          </div>
        </div>
      )}

      {sub === 1 && (
        <div style={panelPad}>
          <div className="ob-field-table">
            <SettingRow label="Target audience" value="Founders and AI / ML teams at early-stage SaaS" />
            <SettingRow label="Company size"    value="2–50 employees" />
            <SettingRow label="Geography"       value="North America, Western Europe" />
            <SettingRow label="Job titles"      value="Founder, CTO, Head of AI, ML Engineer" />
            <SettingRow label="Avg deal value"  value="$1,400" />
            <SettingRow label="Exclusions"      value="Agencies, students, competitors" />
          </div>
        </div>
      )}

      {sub === 2 && (
        <div style={panelPad}>
          <p className="ob-sub" style={{ fontSize: "var(--fs-sm)", marginBottom: "1rem" }}>
            We measure two real signals — website visits and positive replies. Everything downstream is inferred until confirmed.
          </p>
          <div className="ob-field-table">
            <SettingRow label="Tracking domain" value={hostnameOf(brand.url)} />
            <SettingRow label="Tracking pixel"  value="<script src=&quot;https://t.distribute.you/p.js&quot;>" />
            <SettingRow label="Signup event"    value="signup_completed" />
            <SettingRow label="Purchase event"  value="purchase_completed" />
          </div>
          <div className="settings-toggle-row" style={{ marginTop: "1rem" }}>
            <div>
              <div className="settings-toggle-label">Pixel status</div>
              <div className="settings-toggle-desc">Last visit received 3 minutes ago.</div>
            </div>
            <span className="pipe-status pipe-green">● connected</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   SETTINGS — ORG
═══════════════════════════════════════════════ */
const TEAM_MEMBERS = [
  { initials: "AN", name: "Adam Nasri",  role: "Owner",  status: "Active",  emailLocal: "adam" },
  { initials: "KL", name: "Kevin Lourd", role: "Admin",  status: "Active",  emailLocal: "kevin" },
  { initials: "JD", name: "Jordan Diaz", role: "Member", status: "Invited", emailLocal: "jordan" },
];

const INTEGRATIONS = [
  { name: "Gmail",     desc: "Forward qualified replies to your inbox.",   connected: true  },
  { name: "Slack",     desc: "Post new outcomes to a channel.",            connected: true  },
  { name: "HubSpot",   desc: "Sync leads and pipeline to your CRM.",       connected: false },
  { name: "Salesforce", desc: "Push closed-won deals to opportunities.",   connected: false },
  { name: "Webhook",   desc: "Send every event to your own endpoint.",     connected: false },
];

function OrgSettingsTab({ email, sub, setSub }: { email: string } & SettingsTabProps) {
  const domain = email.split("@")[1] ?? "example.com";
  return (
    <div className="leads-panel" style={{ maxWidth: 680 }}>
      <SettingsHeader title="Workspace settings" action={<SaveBtn />} />
      <SettingsSubNav items={SETTINGS_SUBTABS["settings-org"]!} active={sub} onPick={setSub} />

      {sub === 0 && (
        <div style={panelPad}>
          <div className="ob-field-table">
            <SettingRow label="Workspace name" value={domain} />
            <SettingRow label="Plan"           value="Recommended" />
            <SettingRow label="Time zone"      value="America / New York" />
            <SettingRow label="Website"        value={`https://${domain}`} />
            <SettingRow label="Brands"         value="1 active" />
          </div>
        </div>
      )}

      {sub === 1 && (
        <>
          <div className="leads-header" style={{ borderTop: "1px solid var(--border)" }}>
            <span className="leads-count">{TEAM_MEMBERS.length} members</span>
            <button className="btn btn-g" style={{ fontSize: "var(--fs-xs)", padding: "0.35rem 0.75rem" }}>+ Invite</button>
          </div>
          <table className="leads-table">
            <thead><tr><th>Member</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>
              {TEAM_MEMBERS.map((m) => (
                <tr key={m.emailLocal}>
                  <td><div className="lead-org"><div className="app-sidebar-avatar" style={{ width: "1.75rem", height: "1.75rem", fontSize: "0.6rem", borderRadius: "50%" }}>{m.initials}</div><div><div className="lead-org-name">{m.name}</div><div className="lead-contact">{m.emailLocal}@{domain}</div></div></div></td>
                  <td style={{ fontSize: "var(--fs-sm)", color: "var(--sub)" }}>{m.role}</td>
                  <td>{m.status === "Active"
                    ? <span className="pipe-status pipe-green">Active</span>
                    : <span className="pipe-status pipe-amber">Invited</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {sub === 2 && (
        <div style={panelPad}>
          {INTEGRATIONS.map((it) => (
            <div key={it.name} className="settings-toggle-row">
              <div>
                <div className="settings-toggle-label">{it.name}</div>
                <div className="settings-toggle-desc">{it.desc}</div>
              </div>
              {it.connected
                ? <span className="pipe-status pipe-green">● connected</span>
                : <button className="btn btn-g" style={{ fontSize: "var(--fs-xs)", padding: "0.3rem 0.7rem" }}>Connect</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   SETTINGS — CAMPAIGN
═══════════════════════════════════════════════ */
const FUNNEL_STEPS = [
  { step: "Visited website", measured: true,  note: "Measured — tracking pixel" },
  { step: "Signed up",       measured: false, note: "Inferred — confirm to lock" },
  { step: "Purchased",       measured: false, note: "Inferred — confirm to lock" },
  { step: "Positive reply",  measured: true,  note: "Measured — inbox signal" },
  { step: "Meeting booked",  measured: false, note: "Inferred — confirm to lock" },
];

function CampaignSettingsPage({ campaign, sub, setSub }: { campaign: MockCampaign } & SettingsTabProps) {
  return (
    <div className="leads-panel" style={{ maxWidth: 640 }}>
      <SettingsHeader title="Campaign settings" action={<SaveBtn />} />
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1.5rem 0" }}>
        <span style={{ fontSize: "var(--fs-md)", fontWeight: 700, color: "var(--text)" }}>{campaign.name}</span>
        {campaign.status === "live"
          ? <span className="pipe-status pipe-green" style={{ fontSize: "var(--fs-xs)" }}>● live</span>
          : <span className="pipe-status" style={{ fontSize: "var(--fs-xs)", background: "var(--surface-hi)", color: "var(--muted)", borderColor: "var(--border-hi)" }}>○ paused</span>}
      </div>
      <SettingsSubNav items={SETTINGS_SUBTABS["settings-campaign"]!} active={sub} onPick={setSub} />

      {sub === 0 && (
        <div style={panelPad}>
          <div className="ob-field-table">
            <SettingRow label="Name"   value={campaign.name} />
            <SettingRow label="Status" value={campaign.status} />
            <SettingRow label="Goal"   value="Signups · Meetings · Purchases" />
            <SettingRow label="Created" value="Jun 1, 2026" />
          </div>
        </div>
      )}

      {sub === 1 && (
        <div style={panelPad}>
          <div className="ob-field-table">
            <SettingRow label="Daily budget"   value={`$${campaign.budgetPerDay} / day`} />
            <SettingRow label="Monthly cap"    value={`$${campaign.budgetPerDay * 30}`} />
            <SettingRow label="Cost / contact" value="$0.07" />
            <SettingRow label="Auto top-up"    value="On — +$100 below $20" />
          </div>
        </div>
      )}

      {sub === 2 && (
        <div style={panelPad}>
          <div className="ob-field-table">
            <SettingRow label="Audience"     value="Founders and AI / ML teams at early-stage SaaS" />
            <SettingRow label="Geography"    value="North America" />
            <SettingRow label="Company size" value="2–50 employees" />
            <SettingRow label="Job titles"   value="Founder, CTO, Head of AI" />
          </div>
        </div>
      )}

      {sub === 3 && (
        <div style={panelPad}>
          <p className="ob-sub" style={{ fontSize: "var(--fs-sm)", marginBottom: "1rem" }}>
            Only the measured steps are tracked for sure — the rest are inferred with a probability until you confirm them.
          </p>
          {FUNNEL_STEPS.map((f) => (
            <div key={f.step} className="settings-toggle-row">
              <div>
                <div className="settings-toggle-label">{f.step}</div>
                <div className="settings-toggle-desc">{f.note}</div>
              </div>
              {f.measured
                ? <span className="pipe-status pipe-green">measured</span>
                : <span className="pipe-status pipe-amber">inferred</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
