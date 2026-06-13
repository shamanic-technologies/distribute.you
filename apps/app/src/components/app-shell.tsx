"use client";

import { useState } from "react";
import { LEADS, EMAIL_SEQUENCE, type Lead, type LeadStatus } from "@/lib/mock-data";
import type { Brand } from "./onboarding-overlay";
import { StatusChip } from "./status-chip";
import { EmailChart } from "./email-chart";
import { LeadDrawer } from "./lead-drawer";
import { OverviewIcon, LeadsIcon, EmailIcon, CampaignIcon, ChartIcon, InfoIcon, SparkleIcon, ChevronDownIcon, PlusIcon, UserIcon, CardIcon, GearIcon, LogoutIcon, CheckIcon, CloseIcon } from "./icons";

type Tab = "overview" | "leads" | "emails" | "campaign" | "report" | "account" | "billing" | "brand-settings";

const TAB_TITLES: Record<Tab, string> = {
  overview: "Overview",
  leads: "Leads",
  emails: "Emails sent",
  campaign: "Campaign",
  report: "Performance",
  account: "Account",
  billing: "Billing",
  "brand-settings": "Brand settings",
};

const hostnameOf = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

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
    <img
      className="app-brand-avatar-img"
      style={{ width: size, height: size }}
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}

const monoCell: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace", fontSize: "var(--fs-xs)", color: "var(--muted)" };

export function AppShell({ brand, hidden, onReset }: { brand: Brand; hidden: boolean; onReset: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [openLead, setOpenLead] = useState<Lead | null>(null);

  // Multi-brand mock state — seeded with the onboarded brand.
  const [brands, setBrands] = useState<Brand[]>([brand]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");

  const activeBrand = brands[activeIdx] ?? brand;
  const userEmail = `adam@${hostnameOf(activeBrand.url)}`;

  const openDrawer = (id: number) => setOpenLead(LEADS.find((l) => l.id === id) ?? null);
  const closeMenus = () => { setBrandMenuOpen(false); setUserMenuOpen(false); };

  function selectBrand(i: number) {
    setActiveIdx(i);
    setBrandMenuOpen(false);
    setTab("overview");
  }

  function addBrand() {
    const url = newUrl.trim();
    if (!url) return;
    const norm = /^https?:\/\//.test(url) ? url : `https://${url}`;
    const next: Brand = { name: hostnameOf(norm), url: norm };
    setBrands((b) => [...b, next]);
    setActiveIdx(brands.length);
    setNewUrl("");
    setAddOpen(false);
    setTab("overview");
  }

  function goSub(t: Tab) {
    setTab(t);
    setUserMenuOpen(false);
  }

  return (
    <div className={`app-shell${hidden ? " app-hidden" : ""}`}>
      {/* Sidebar */}
      <aside className="app-sidebar">
        {/* Brand switcher (replaces the platform logo) */}
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
          <li><a href="#" className={tab === "overview" ? "active" : ""} onClick={(e) => { e.preventDefault(); setTab("overview"); }}><OverviewIcon /> Overview</a></li>
          <li><a href="#" className={tab === "leads" ? "active" : ""} onClick={(e) => { e.preventDefault(); setTab("leads"); }}><LeadsIcon /> Leads <span className="app-nav-count">247</span></a></li>
          <li><a href="#" className={tab === "emails" ? "active" : ""} onClick={(e) => { e.preventDefault(); setTab("emails"); }}><EmailIcon /> Emails <span className="app-nav-count">247</span></a></li>
          <li><a href="#" className={tab === "campaign" ? "active" : ""} onClick={(e) => { e.preventDefault(); setTab("campaign"); }}><CampaignIcon /> Campaign</a></li>
          <div className="app-nav-section">Report</div>
          <li><a href="#" className={tab === "report" ? "active" : ""} onClick={(e) => { e.preventDefault(); setTab("report"); }}><ChartIcon /> Performance</a></li>
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

      {/* Click-away backdrop for open menus */}
      {(brandMenuOpen || userMenuOpen) && <div className="app-menu-backdrop" onClick={closeMenus} />}

      {/* Main */}
      <main className="app-main">
        <div className="app-topbar">
          <span className="app-topbar-title">{TAB_TITLES[tab]}</span>
          <div className="app-topbar-right">
            <div className="app-live"><span className="app-live-dot" /> live</div>
            <button className="btn btn-g" onClick={onReset} style={{ fontSize: "var(--fs-xs)", padding: "0.35rem 0.75rem" }}>Reset onboarding</button>
            <button className="btn btn-p">+ New campaign</button>
          </div>
        </div>

        <div className="app-content">
          {tab === "overview" && <OverviewTab onOpen={openDrawer} onViewAll={() => setTab("leads")} />}
          {tab === "leads" && <LeadsTab onOpen={openDrawer} />}
          {tab === "emails" && <EmailsTab onOpen={openDrawer} />}
          {tab === "campaign" && <CampaignTab />}
          {tab === "report" && <ReportTab />}
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

      <LeadDrawer lead={openLead} onClose={() => setOpenLead(null)} />
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
        <div className="kpi-card">
          <div className="kpi-label">Current plan</div>
          <div className="kpi-val">Recommended</div>
          <div className="kpi-meta">$58 / day budget</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Spent this month</div>
          <div className="kpi-val accent">$412</div>
          <div className="kpi-meta">of ~$1,740 cap</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Auto top-up</div>
          <div className="kpi-val green">On</div>
          <div className="kpi-meta">+$100 below $20</div>
        </div>
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
              <tr key={inv.date}>
                <td className="lead-date">{inv.date}</td>
                <td style={monoCell}>{inv.amount}</td>
                <td><span className="seq-day" style={{ color: "var(--green)", background: "transparent", border: "none", padding: 0 }}>{inv.status}</span></td>
              </tr>
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

/* ── Lead table row ── */
function LeadRow({ lead, showPreview, onOpen }: { lead: Lead; showPreview: boolean; onOpen: (id: number) => void }) {
  return (
    <tr onClick={() => onOpen(lead.id)}>
      <td>
        <div className="lead-org">
          <div className="lead-org-logo">{lead.initials}</div>
          <div>
            <div className="lead-org-name">{lead.company}</div>
            <div className="lead-contact">{lead.contact} <span className="lead-role">· {lead.role}</span></div>
          </div>
        </div>
      </td>
      <td><StatusChip status={lead.status} /></td>
      <td className="lead-date">{lead.date}</td>
      {showPreview && (lead.preview
        ? <td className="lead-preview">{lead.preview}</td>
        : <td className="lead-preview" style={{ color: "var(--border-hi)" }}>—</td>)}
      <td style={monoCell}>{lead.cost}</td>
    </tr>
  );
}

function LeadTable({ leads, onOpen }: { leads: Lead[]; onOpen: (id: number) => void }) {
  return (
    <table className="leads-table">
      <thead><tr><th>Lead</th><th>Status</th><th>Date</th><th>Preview</th><th>Cost</th></tr></thead>
      <tbody>{leads.map((l) => <LeadRow key={l.id} lead={l} showPreview onOpen={onOpen} />)}</tbody>
    </table>
  );
}

/* ── Overview ── */
function OverviewTab({ onOpen, onViewAll }: { onOpen: (id: number) => void; onViewAll: () => void }) {
  return (
    <div>
      <div className="kpi-strip">
        <div className="kpi-card">
          <div className="kpi-label">Emails sent</div>
          <div className="kpi-val">247</div>
          <div className="kpi-meta"><span className="kpi-delta up">+18%</span> vs last week</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Opened</div>
          <div className="kpi-val amber">94</div>
          <div className="kpi-meta"><span className="kpi-delta up">38%</span> open rate</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Replied</div>
          <div className="kpi-val green">5</div>
          <div className="kpi-meta"><span className="kpi-delta up">2.1%</span> reply rate</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            Budget used today
            <span className="kpi-info-tip">
              <InfoIcon width={11} height={11} />
              <span className="kpi-info-bubble">$18.00 used · $25.00 / day</span>
            </span>
          </div>
          <div className="kpi-val accent">72%</div>
          <div className="kpi-progress"><div className="kpi-progress-fill" style={{ width: "72%" }} /></div>
        </div>
      </div>

      <div className="chart-roi-wrap">
        <div className="app-chart-wrap">
          <div className="chart-header">
            <div>
              <div className="chart-title">Emails per day</div>
              <div className="chart-sub">Jun 1 – Jun 7, 2026 &nbsp;·&nbsp; $25 / day budget</div>
            </div>
            <div className="chart-legend">
              <div className="chart-legend-item"><div className="chart-legend-dot" style={{ background: "var(--accent)" }} /> Sent</div>
              <div className="chart-legend-item"><div className="chart-legend-dot" style={{ background: "var(--amber)" }} /> Opened</div>
              <div className="chart-legend-item"><div className="chart-legend-dot" style={{ background: "var(--green)" }} /> Replied</div>
            </div>
          </div>
          <EmailChart />
        </div>

        <div className="chart-roi-side">
          <div className="kpi-card">
            <div className="roi-section">
              <div className="kpi-label">Expected ROI</div>
              <div className="kpi-val green">8x</div>
              <div className="kpi-meta">pipeline / spend</div>
            </div>
            <div className="roi-divider" />
            <div className="roi-section">
              <div className="kpi-label">Exp. revenue</div>
              <div className="kpi-val green">$7,100</div>
              <div className="kpi-meta">5 replies × $1,420 LTV</div>
            </div>
            <div className="roi-divider" />
            <div className="roi-section">
              <div className="kpi-label">Cost / reply</div>
              <div className="kpi-val amber">$1.78</div>
              <div className="kpi-meta">per qualified reply</div>
            </div>
          </div>
        </div>
      </div>

      <div className="leads-panel">
        <div className="leads-header">
          <div>
            <span className="leads-title">Recent leads</span>
            <span className="leads-count">247 total</span>
          </div>
          <button className="btn btn-g" style={{ fontSize: "var(--fs-xs)", padding: "0.35rem 0.75rem" }} onClick={onViewAll}>View all</button>
        </div>
        <LeadTable leads={LEADS.slice(0, 5)} onOpen={onOpen} />
      </div>
    </div>
  );
}

/* ── Leads ── */
const LEAD_FILTERS: { key: "all" | LeadStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "opened", label: "Opened" },
  { key: "replied", label: "Replied" },
  { key: "sent", label: "Sent" },
];

function LeadsTab({ onOpen }: { onOpen: (id: number) => void }) {
  const [filter, setFilter] = useState<"all" | LeadStatus>("all");
  const filtered = filter === "all" ? LEADS : LEADS.filter((l) => l.status === filter);
  return (
    <div className="leads-panel">
      <div className="leads-header">
        <div>
          <span className="leads-title">All leads</span>
          <span className="leads-count">{filtered.length}</span>
        </div>
      </div>
      <div className="leads-tabs">
        {LEAD_FILTERS.map((f) => (
          <button key={f.key} className={`leads-tab${filter === f.key ? " active" : ""}`} onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>
      {filtered.length
        ? <LeadTable leads={filtered} onOpen={onOpen} />
        : <div className="empty-state"><p>No leads with status &quot;{filter}&quot; yet.</p></div>}
    </div>
  );
}

/* ── Emails ── */
function EmailsTab({ onOpen }: { onOpen: (id: number) => void }) {
  return (
    <div className="leads-panel">
      <div className="leads-header">
        <div><span className="leads-title">Emails sent</span><span className="leads-count">247</span></div>
      </div>
      <table className="leads-table">
        <thead><tr><th>Sent to</th><th>Status</th><th>Date</th><th>Cost</th></tr></thead>
        <tbody>
          {LEADS.filter((l) => l.status !== "bounced").map((l) => (
            <tr key={l.id} onClick={() => onOpen(l.id)}>
              <td>
                <div className="lead-org">
                  <div className="lead-org-logo">{l.initials}</div>
                  <div>
                    <div className="lead-org-name">{l.contact}</div>
                    <div className="lead-contact">{l.company}</div>
                  </div>
                </div>
              </td>
              <td><StatusChip status={l.status} /></td>
              <td className="lead-date">{l.date}</td>
              <td style={monoCell}>{l.cost}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Report ── */
function ReportTab() {
  return (
    <div>
      <div className="kpi-strip">
        <div className="kpi-card">
          <div className="kpi-label">Total spent</div>
          <div className="kpi-val">$8.89</div>
          <div className="kpi-meta">247 emails × $0.036</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pipeline value</div>
          <div className="kpi-val green">$7,100</div>
          <div className="kpi-meta">5 replies × $1,420 LTV avg</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">ROI</div>
          <div className="kpi-val accent">7.9x</div>
          <div className="kpi-meta">est. pipeline / spend</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg cost / reply</div>
          <div className="kpi-val">$1.78</div>
          <div className="kpi-meta">this campaign</div>
        </div>
      </div>
      <div className="leads-panel" style={{ marginTop: 0 }}>
        <div className="leads-header"><span className="leads-title">Top cost sources</span></div>
        <table className="leads-table">
          <thead><tr><th>Source</th><th>Cost</th><th>Share</th></tr></thead>
          <tbody>
            <tr><td>Apollo lead enrichment</td><td>$2.96</td><td>33%</td></tr>
            <tr><td>Email generation (Claude Sonnet 4.6)</td><td>$4.45</td><td>50%</td></tr>
            <tr><td>Resend (send)</td><td>$0.99</td><td>11%</td></tr>
            <tr><td>Reply classifier (Claude Haiku 4.5)</td><td>$0.49</td><td>6%</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Campaign ── */
const CAMPAIGN_BUDGETS = [
  { tier: "Starter", price: "$29", target: "targets ~5 closes / mo", revenue: "~$12,507 revenue / month", active: false, badge: false },
  { tier: "Recommended ★", price: "$58", target: "targets ~10 closes / mo", revenue: "~$24,999 revenue / month", active: true, badge: true },
  { tier: "Growth", price: "$115", target: "targets ~20 closes / mo", revenue: "~$49,999 revenue / month", active: false, badge: false },
  { tier: "Current", price: "$25", target: "targets ~4 closes / mo", revenue: "~$10,800 revenue / month", active: false, badge: false },
];

const CAMPAIGN_FIELDS_PRODUCT = [
  { key: "URL", value: "https://prompthub.ai" },
  { key: "Audience", value: "Founders and AI teams at early-stage SaaS building with LLMs" },
  { key: "Outcome", value: "Sign up for a free trial or book a demo" },
  { key: "Value", value: "Cut AI prompt iteration time by 60% with a collaborative prompt library" },
];

const CAMPAIGN_FIELDS_HOOKS = [
  { key: "Urgency", value: "Teams moving to AI-first workflows risk falling behind competitors" },
  { key: "Scarcity", value: "Early access pricing ends this quarter — founding slots limited" },
  { key: "Risk", value: "Free 14-day trial, no credit card required" },
  { key: "Proof", value: "Trusted by 200+ AI teams — 4.9/5 on Product Hunt" },
];

function renderSeqBody(body: string) {
  // Wrap {var} tokens in styled spans.
  const parts = body.split(/(\{[^}]+\})/g);
  return parts.map((p, i) => (/^\{[^}]+\}$/.test(p) ? <span className="seq-var" key={i}>{p}</span> : <span key={i}>{p}</span>));
}

function CampaignFieldTable({ rows }: { rows: { key: string; value: string }[] }) {
  return (
    <div className="ob-field-table">
      {rows.map((r) => (
        <div className="ob-field-row" key={r.key}>
          <div className="ob-field-key">{r.key}</div>
          <div className="ob-field-val"><input defaultValue={r.value} placeholder="https://…" /></div>
        </div>
      ))}
    </div>
  );
}

function CampaignTab() {
  return (
    <div>
      <div className="leads-panel" style={{ marginBottom: "2rem" }}>
        <div className="leads-header">
          <span className="leads-title">Budget &amp; projections</span>
          <button className="btn btn-g" style={{ fontSize: "var(--fs-xs)", padding: "0.35rem 0.75rem" }}>Change budget</button>
        </div>
        <div style={{ padding: "1.5rem" }}>
          <div className="ob-budget-grid" style={{ marginBottom: "1.25rem" }}>
            {CAMPAIGN_BUDGETS.map((b) => (
              <div className={`ob-budget-card${b.active ? " active" : ""}`} key={b.tier}>
                {b.badge ? <div className="ob-budget-badge">{b.tier}</div> : <div className="ob-budget-tier">{b.tier}</div>}
                <div className="ob-budget-price">{b.price} <span>/ day</span></div>
                <div className="ob-budget-target">{b.target}</div>
                <div className="ob-budget-revenue">{b.revenue}</div>
                <div className="ob-budget-cac">CAC ℹ 7%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="leads-panel">
        <div className="leads-header">
          <span className="leads-title">ICP &amp; email strategy</span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-g" style={{ fontSize: "var(--fs-xs)", padding: "0.35rem 0.75rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <SparkleIcon width={11} height={11} /> Edit with AI
            </button>
            <button className="btn btn-p" style={{ fontSize: "var(--fs-xs)", padding: "0.35rem 0.75rem" }}>Save changes</button>
          </div>
        </div>
        <div style={{ padding: "1.5rem" }}>
          <div className="ob-cd-cols">
            <div>
              <div className="ob-cd-group-label">Your product</div>
              <CampaignFieldTable rows={CAMPAIGN_FIELDS_PRODUCT} />
            </div>
            <div>
              <div className="ob-cd-group-label">Email hooks</div>
              <CampaignFieldTable rows={CAMPAIGN_FIELDS_HOOKS} />
            </div>
          </div>
        </div>
      </div>

      <div className="leads-panel" style={{ marginTop: "2rem" }}>
        <div className="leads-header">
          <div>
            <span className="leads-title">Email sequence</span>
            <span className="leads-count">3 emails · Legato</span>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontFamily: "'JetBrains Mono',monospace", fontSize: "var(--fs-xs)", color: "var(--green)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", flexShrink: 0 }} /> active
            </span>
            <button className="btn btn-g" style={{ fontSize: "var(--fs-xs)", padding: "0.35rem 0.75rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <SparkleIcon width={11} height={11} /> Edit with AI
            </button>
          </div>
        </div>
        <div style={{ padding: "1.5rem 1.75rem" }}>
          {EMAIL_SEQUENCE.map((s) => (
            <div className="seq-step" key={s.day}>
              <div className="seq-timeline"><div className="seq-dot" /><div className="seq-line" /></div>
              <div className="seq-content">
                <div className="seq-meta">
                  <span className="seq-day">{s.day}</span>
                  <span className="seq-tag">{s.tag}</span>
                </div>
                <div className="seq-subject">{renderSeqBody(s.subject)}</div>
                <div className="seq-body">{renderSeqBody(s.body)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
