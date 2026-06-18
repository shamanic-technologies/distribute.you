"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CheckIcon, ChevronLeftIcon, ChartIcon, SparkleIcon, SpinnerIcon, CircleIcon } from "./icons";

export interface Brand {
  name: string;
  url: string;
}

type Step = "welcome" | "login" | "url" | "loading" | "objective" | "funnels" | "rates" | "config";

// What the user wants to maximize.
type Objective = "signups" | "meetings" | "purchases";
const OBJECTIVES: { key: Objective; label: string; desc: string }[] = [
  { key: "signups", label: "Signups", desc: "Maximize free signups / trial starts on your site." },
  { key: "meetings", label: "Booked Meetings", desc: "Maximize sales meetings booked from outreach." },
  { key: "purchases", label: "Purchases", desc: "Maximize paying customers and revenue." },
];

// Which sales funnels the business actually uses (multi-select).
type Funnel = "website-signups" | "sales-meetings" | "website-purchases";
const FUNNELS: { key: Funnel; label: string; desc: string }[] = [
  { key: "website-signups", label: "Website Signups", desc: "Visitors create an account on your site." },
  { key: "sales-meetings", label: "Sales Meetings", desc: "Replies turn into booked sales meetings." },
  { key: "website-purchases", label: "Website Purchases", desc: "Visitors buy directly on your site." },
];

// Conversion-rate fields. We only ask the ones strictly necessary for the
// chosen objective + the selected funnels (see ratesNeeded).
type RateKey = "ltv" | "v2s" | "s2c" | "r2m" | "m2c";
const RATE_META: Record<RateKey, { label: string; suffix: string; hint: string }> = {
  ltv: { label: "Lifetime revenue / paid client", suffix: "$", hint: "Average revenue a customer brings over their lifetime." },
  v2s: { label: "Website visit → signup", suffix: "%", hint: "Of visitors who land on your site, how many sign up." },
  s2c: { label: "Signup → paid client", suffix: "%", hint: "Of signups, how many become paying customers." },
  r2m: { label: "Positive reply → meeting booked", suffix: "%", hint: "Of positive replies, how many book a meeting." },
  m2c: { label: "Meeting booked → close won", suffix: "%", hint: "Of booked meetings, how many close." },
};

// Ask only the strictly-necessary rates given the objective + active funnels.
function ratesNeeded(objective: Objective, funnels: Set<Funnel>): RateKey[] {
  const out: RateKey[] = [];
  const websiteActive = funnels.has("website-signups") || funnels.has("website-purchases");
  const meetingsActive = funnels.has("sales-meetings");

  if (objective === "signups") {
    if (websiteActive) out.push("v2s");
    return out;
  }
  if (objective === "meetings") {
    if (meetingsActive) out.push("r2m");
    return out;
  }
  // Purchases: revenue + the full chain from every active funnel down to a paid client.
  out.push("ltv");
  if (websiteActive) out.push("v2s", "s2c");
  if (meetingsActive) out.push("r2m", "m2c");
  return out;
}

// Budget tiers expressed in units of the chosen objective.
const TIERS: Record<Objective, { unit: string; costPerUnit: number; values: [number, number, number] }> = {
  signups: { unit: "signups", costPerUnit: 4, values: [30, 100, 200] },
  meetings: { unit: "meetings", costPerUnit: 90, values: [5, 10, 20] },
  purchases: { unit: "closes", costPerUnit: 175, values: [5, 10, 20] },
};
const TIER_LABELS = ["Starter", "Recommended", "Growth"] as const;

const LOADING_STEPS = [
  { id: "ls-1", title: "Reading your product...", label: "Reading", delay: 1200 },
  { id: "ls-2", title: "Extracting ICP and objectives...", label: "Extracting your ICP and objectives", delay: 1600 },
  { id: "ls-3", title: "Selecting outreach strategy...", label: "Selecting outreach strategy", delay: 1200 },
  { id: "ls-4", title: "Drafting your first outreach...", label: "Drafting your first outreach", delay: 1000 },
];

function hostnameOf(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

const fmtUsd0 = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

const GoogleMark = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
  </svg>
);

export function OnboardingOverlay({ hidden, onComplete }: { hidden: boolean; onComplete: (brand: Brand) => void }) {
  const [step, setStep] = useState<Step>("welcome");
  const [url, setUrl] = useState("https://prompthub.ai");
  const [objective, setObjective] = useState<Objective>("purchases");
  const [funnels, setFunnels] = useState<Set<Funnel>>(
    () => new Set<Funnel>(["website-signups", "sales-meetings", "website-purchases"]),
  );
  const [rates, setRates] = useState<Record<RateKey, number>>({ ltv: 2500, v2s: 5, s2c: 10, r2m: 30, m2c: 25 });
  const [budget, setBudget] = useState<string>("recommended");
  const [customBudget, setCustomBudget] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  // Loading-sequence progress: index of the furthest step reached, and whether it's done.
  const [loadStep, setLoadStep] = useState(0);
  const [loadDone, setLoadDone] = useState(false);
  const [loadTitle, setLoadTitle] = useState(LOADING_STEPS[0].title);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ICP / hook fields (editable).
  const [fields, setFields] = useState({
    url: "https://prompthub.ai",
    audience: "Founders and AI teams at early-stage SaaS building with LLMs",
    outcome: "Sign up for a free trial or book a demo",
    value: "Cut AI prompt iteration time by 60% with a collaborative prompt library",
    urgency: "Teams moving to AI-first workflows risk falling behind competitors",
    scarcity: "Early access pricing ends this quarter — founding slots limited",
    risk: "Free 14-day trial, no credit card required",
    proof: "Trusted by 200+ AI teams — 4.9/5 on Product Hunt",
  });

  const hostname = hostnameOf(url);
  const aiInputRef = useRef<HTMLTextAreaElement>(null);
  const [aiInstruction, setAiInstruction] = useState("");

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  function startAnalyze() {
    setFields((f) => ({ ...f, url }));
    setStep("loading");
    runLoadingSequence();
  }

  function runLoadingSequence() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLoadDone(false);
    setLoadStep(0);
    setLoadTitle(LOADING_STEPS[0].title);
    let elapsed = 0;
    LOADING_STEPS.forEach((s, i) => {
      const t = setTimeout(() => {
        setLoadStep(i);
        setLoadTitle(s.title);
      }, elapsed);
      timers.current.push(t);
      elapsed += s.delay;
    });
    const last = setTimeout(() => {
      setLoadDone(true);
      setLoadTitle("Your strategy is ready.");
      const toNext = setTimeout(() => setStep("objective"), 700);
      timers.current.push(toNext);
    }, elapsed);
    timers.current.push(last);
  }

  function toggleFunnel(key: Funnel) {
    setFunnels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function applyAiEdit() {
    const instruction = aiInstruction.trim();
    if (!instruction) return;
    setAiBusy(true);
    const t = setTimeout(() => {
      const lc = instruction.toLowerCase();
      setFields((f) => {
        if (lc.includes("enterprise")) {
          return { ...f, audience: "VP Engineering and CTOs at enterprise SaaS companies (500+ employees) building internal AI tooling", outcome: "Schedule a 30-minute discovery call or request a custom demo" };
        }
        if (lc.includes("casual") || lc.includes("informal")) {
          return { ...f, value: "Spend way less time wrestling with AI prompts — collaborative library your whole team actually uses", urgency: "Everyone's racing to go AI-first. Your competitors aren't waiting." };
        }
        return { ...f, audience: `${f.audience} (updated)` };
      });
      setAiBusy(false);
      setAiOpen(false);
      setAiInstruction("");
    }, 1400);
    timers.current.push(t);
  }

  const setField = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  const setRate = (k: RateKey) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setRates((r) => ({ ...r, [k]: Number(e.target.value) }));

  const neededRates = ratesNeeded(objective, funnels);
  const tier = TIERS[objective];

  // Mock projection per tier card.
  const cards = TIER_LABELS.map((label, i) => {
    const count = tier.values[i];
    const daily = Math.max(1, Math.round((count * tier.costPerUnit) / 30));
    const monthly = daily * 30;
    const revenue = objective === "purchases" ? count * rates.ltv : null;
    const cacPct = revenue && revenue > 0 ? Math.round((monthly / revenue) * 100) : null;
    return { key: label.toLowerCase(), label, count, daily, revenue, cacPct };
  });

  return (
    <div className={`onboarding-overlay${hidden ? " hidden" : ""}`}>
      <div className={`onboarding-card${step === "config" ? " wide" : ""}`}>

        {/* Step: Welcome */}
        <div className={`ob-step${step === "welcome" ? " active" : ""}`}>
          <div className="ob-logo">
            <Image src="/logo/logo-distribute.svg" alt="" width={32} height={32} />
            <span className="ob-logo-name">distribute</span>
            <span className="nav-chip">beta</span>
          </div>
          <h1 className="ob-title">You set the goal.<br />We deliver the outcome.</h1>
          <p className="ob-sub">Drop your product URL and a daily budget. We find your leads, reach out across the best channels, and turn them into signups, meetings and sales.</p>

          <div className="ob-features">
            <div className="ob-feature">
              <div className="ob-feature-icon"><SparkleIcon width={16} height={16} /></div>
              <div className="ob-feature-title">Pick your goal</div>
              <div className="ob-feature-desc">Maximize signups, meetings, or sales</div>
            </div>
            <div className="ob-feature">
              <div className="ob-feature-icon"><CheckIcon width={16} height={16} /></div>
              <div className="ob-feature-title">Best ROI</div>
              <div className="ob-feature-desc">Best return on the market, measured per outcome</div>
            </div>
            <div className="ob-feature">
              <div className="ob-feature-icon"><ChartIcon width={16} height={16} /></div>
              <div className="ob-feature-title">Pay per outcome</div>
              <div className="ob-feature-desc">$15 / signup · $90 / meeting · $120 / sale</div>
            </div>
          </div>

          <div className="ob-actions">
            <button className="btn btn-p btn-lg" onClick={() => setStep("login")}>Get started</button>
            <button className="btn btn-g" onClick={() => onComplete({ name: hostname, url })}>See a live demo</button>
          </div>
        </div>

        {/* Step: Google login */}
        <div className={`ob-step${step === "login" ? " active" : ""}`}>
          <button className="ob-back" onClick={() => setStep("welcome")}>
            <ChevronLeftIcon width={14} height={14} />
            Back
          </button>
          <h2 className="ob-title" style={{ fontSize: "1.6rem" }}>Sign in to continue.</h2>
          <p className="ob-sub" style={{ marginBottom: "1.5rem" }}>One click with Google — no password to remember. We only use it to create your workspace.</p>

          <div className="ob-actions">
            <button className="btn btn-google btn-lg" onClick={() => setStep("url")}>
              <GoogleMark />
              Continue with Google
            </button>
          </div>
          <p className="form-hint" style={{ textAlign: "center", marginTop: "1rem" }}>
            By continuing you agree to our Terms &amp; Privacy.
          </p>
        </div>

        {/* Step: URL setup */}
        <div className={`ob-step${step === "url" ? " active" : ""}`}>
          <button className="ob-back" onClick={() => setStep("login")}>
            <ChevronLeftIcon width={14} height={14} />
            Back
          </button>
          <h2 className="ob-title" style={{ fontSize: "1.6rem" }}>What are we promoting?</h2>
          <p className="ob-sub" style={{ marginBottom: "1.5rem" }}>We read your product, find the leads, and run the outreach. Just drop the URL.</p>

          <div className="form-group">
            <label className="form-label" htmlFor="input-url">Product URL</label>
            <input type="url" className="form-input" id="input-url" placeholder="https://yourproduct.com" value={url} onChange={(e) => setUrl(e.target.value)} />
            <p className="form-hint">We read your site to extract your ICP, value prop, and outreach strategy.</p>
          </div>

          <div className="ob-actions" style={{ marginTop: "2rem" }}>
            <button className="btn btn-p btn-lg" onClick={startAnalyze}>Analyze my product →</button>
          </div>
        </div>

        {/* Step: Loading */}
        <div className={`ob-step${step === "loading" ? " active" : ""}`}>
          <div className="ob-loading">
            <div style={{ marginBottom: "1.5rem" }}>
              <Image src="/logo/logo-distribute.svg" alt="" width={48} height={48} style={{ borderRadius: "0.6rem", margin: "0 auto" }} />
            </div>
            <div className="ob-loading-title">{loadTitle}</div>
            <div className="ob-loading-steps">
              {LOADING_STEPS.map((s, i) => {
                const isDone = loadDone || i < loadStep;
                const isActive = !loadDone && i === loadStep;
                const cls = isDone ? "done" : isActive ? "active" : "";
                return (
                  <div className={`ob-loading-step ${cls}`} key={s.id} style={{ opacity: isDone || isActive ? 1 : 0.35 }}>
                    <div className="ob-loading-icon">
                      {isDone ? <CheckIcon width={16} height={16} /> : isActive ? <SpinnerIcon width={16} height={16} /> : <CircleIcon width={16} height={16} />}
                    </div>
                    <span>{i === 0 ? <>Reading <span>{hostname}</span>...</> : s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Step: Objective */}
        <div className={`ob-step${step === "objective" ? " active" : ""}`}>
          <h2 className="ob-title" style={{ fontSize: "1.6rem" }}>What do you want to maximize?</h2>
          <p className="ob-sub" style={{ marginBottom: "1.5rem" }}>Pick the one growth metric this campaign optimizes for. We tune budget and targeting around it.</p>

          <div className="ob-choice-list">
            {OBJECTIVES.map((o) => (
              <button
                key={o.key}
                className={`ob-choice-card${objective === o.key ? " active" : ""}`}
                onClick={() => setObjective(o.key)}
              >
                <div className="ob-choice-radio">{objective === o.key && <CheckIcon width={12} height={12} />}</div>
                <div>
                  <div className="ob-choice-title">{o.label}</div>
                  <div className="ob-choice-desc">{o.desc}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="ob-actions" style={{ marginTop: "1.75rem" }}>
            <button className="btn btn-p btn-lg" onClick={() => setStep("funnels")}>Continue →</button>
          </div>
        </div>

        {/* Step: Funnels (multi-select) */}
        <div className={`ob-step${step === "funnels" ? " active" : ""}`}>
          <button className="ob-back" onClick={() => setStep("objective")}>
            <ChevronLeftIcon width={14} height={14} />
            Back
          </button>
          <h2 className="ob-title" style={{ fontSize: "1.6rem" }}>Which sales funnels do you use?</h2>
          <p className="ob-sub" style={{ marginBottom: "1.5rem" }}>Select every path a prospect can take to become a customer. We only ask for the conversion rates these funnels need.</p>

          <div className="ob-choice-list">
            {FUNNELS.map((f) => {
              const on = funnels.has(f.key);
              return (
                <button
                  key={f.key}
                  className={`ob-choice-card${on ? " active" : ""}`}
                  onClick={() => toggleFunnel(f.key)}
                >
                  <div className={`ob-choice-check${on ? " on" : ""}`}>{on && <CheckIcon width={12} height={12} />}</div>
                  <div>
                    <div className="ob-choice-title">{f.label}</div>
                    <div className="ob-choice-desc">{f.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="ob-actions" style={{ marginTop: "1.75rem" }}>
            <button className="btn btn-p btn-lg" onClick={() => setStep("rates")} disabled={funnels.size === 0}>Continue →</button>
          </div>
        </div>

        {/* Step: Conversion rates (gated) */}
        <div className={`ob-step${step === "rates" ? " active" : ""}`}>
          <button className="ob-back" onClick={() => setStep("funnels")}>
            <ChevronLeftIcon width={14} height={14} />
            Back
          </button>
          <h2 className="ob-title" style={{ fontSize: "1.6rem" }}>Your conversion rates.</h2>
          <p className="ob-sub" style={{ marginBottom: "1.5rem" }}>Just the numbers we need to project results for <strong>{OBJECTIVES.find((o) => o.key === objective)?.label}</strong>. Estimates are fine — tweak anytime.</p>

          {neededRates.length === 0 ? (
            <div className="empty-state" style={{ padding: "1.5rem" }}>
              <p>No conversion rates needed — your funnel selection doesn&apos;t feed this objective. Go back and pick a matching funnel.</p>
            </div>
          ) : (
            <div className="ob-rate-list">
              {neededRates.map((k) => (
                <div className="ob-rate-row" key={k}>
                  <div className="ob-rate-label">
                    <div className="ob-rate-name">{RATE_META[k].label}</div>
                    <div className="ob-rate-hint">{RATE_META[k].hint}</div>
                  </div>
                  <div className="ob-rate-input">
                    {RATE_META[k].suffix === "$" && <span className="ob-rate-affix">$</span>}
                    <input
                      type="number"
                      min={0}
                      value={rates[k]}
                      onChange={setRate(k)}
                    />
                    {RATE_META[k].suffix === "%" && <span className="ob-rate-affix">%</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="ob-actions" style={{ marginTop: "1.75rem" }}>
            <button className="btn btn-p btn-lg" onClick={() => setStep("config")} disabled={neededRates.length === 0}>Continue →</button>
          </div>
        </div>

        {/* Step: Campaign config */}
        <div className={`ob-step${step === "config" ? " active" : ""}`}>
          <button className="ob-back" onClick={() => setStep("rates")}>
            <ChevronLeftIcon width={14} height={14} />
            Back
          </button>

          <div style={{ marginBottom: "1.25rem" }}>
            <h2 className="ob-title" style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>Your campaign is ready.</h2>
            <p className="ob-sub" style={{ marginBottom: 0, fontSize: "var(--fs-sm)" }}>We read <strong>{hostname}</strong> and built your outreach strategy. Review and adjust before launching.</p>
          </div>

          {/* Budget */}
          <div className="ob-section-label">Daily budget — maximizing {OBJECTIVES.find((o) => o.key === objective)?.label}</div>
          <div className="ob-budget-grid">
            {cards.map((c, i) => (
              <div key={c.key} className={`ob-budget-card${budget === c.key ? " active" : ""}`} onClick={() => setBudget(c.key)}>
                {i === 1 ? <div className="ob-budget-badge">Recommended ★</div> : <div className="ob-budget-tier">{c.label}</div>}
                <div className="ob-budget-price">{fmtUsd0(c.daily)} <span>/ day</span></div>
                <div className="ob-budget-target">targets ~{c.count} {tier.unit} / mo</div>
                {c.revenue !== null && <div className="ob-budget-revenue">~{fmtUsd0(c.revenue)} revenue / month</div>}
                {c.cacPct !== null && <div className="ob-budget-cac">CAC ℹ {c.cacPct}%</div>}
              </div>
            ))}
            <div className={`ob-budget-card${budget === "custom" ? " active" : ""}`} onClick={() => setBudget("custom")}>
              <div className="ob-budget-tier">Other</div>
              <div className="ob-budget-custom-row">
                <span>$</span>
                <input type="number" value={customBudget} min={1} max={9999}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => { setCustomBudget(Number(e.target.value)); setBudget("custom"); }} />
              </div>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--muted)" }}>per day</div>
            </div>
          </div>

          {/* Campaign details */}
          <div className="ob-cd-header">
            <span className="ob-cd-title">Campaign details</span>
            <button className="btn btn-g" style={{ fontSize: "var(--fs-xs)", padding: "0.3rem 0.7rem", display: "flex", alignItems: "center", gap: "0.35rem" }} onClick={() => { setAiOpen((v) => !v); setTimeout(() => aiInputRef.current?.focus(), 0); }}>
              <SparkleIcon width={11} height={11} />
              Edit with AI
            </button>
          </div>

          {aiOpen && (
            <div className="ob-ai-panel">
              <textarea ref={aiInputRef} className="ob-ai-input" value={aiInstruction} onChange={(e) => setAiInstruction(e.target.value)} placeholder="Describe changes… e.g. 'Target enterprise CTOs instead' or 'Make the tone more direct'" />
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button className="btn btn-p" style={{ fontSize: "var(--fs-xs)", padding: "0.35rem 0.875rem" }} onClick={applyAiEdit} disabled={aiBusy}>{aiBusy ? "Applying..." : "Apply"}</button>
                <button className="btn btn-g" style={{ fontSize: "var(--fs-xs)", padding: "0.35rem 0.875rem" }} onClick={() => setAiOpen(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div className="ob-cd-cols">
            <div>
              <div className="ob-cd-group-label">Your product</div>
              <div className="ob-field-table">
                <FieldRow label="URL" value={fields.url} onChange={setField("url")} />
                <FieldRow label="Audience" value={fields.audience} onChange={setField("audience")} />
                <FieldRow label="Outcome" value={fields.outcome} onChange={setField("outcome")} />
                <FieldRow label="Value" value={fields.value} onChange={setField("value")} />
              </div>
            </div>
            <div>
              <div className="ob-cd-group-label">Messaging hooks</div>
              <div className="ob-field-table">
                <FieldRow label="Urgency" value={fields.urgency} onChange={setField("urgency")} />
                <FieldRow label="Scarcity" value={fields.scarcity} onChange={setField("scarcity")} />
                <FieldRow label="Risk" value={fields.risk} onChange={setField("risk")} />
                <FieldRow label="Proof" value={fields.proof} onChange={setField("proof")} />
              </div>
            </div>
          </div>

          <div className="ob-actions" style={{ marginTop: "1.5rem" }}>
            <button className="btn btn-p btn-lg" onClick={() => onComplete({ name: hostname, url })}>Launch campaign →</button>
          </div>
        </div>

      </div>
    </div>
  );
}

function FieldRow({ label, value, onChange }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className="ob-field-row">
      <div className="ob-field-key">{label}</div>
      <div className="ob-field-val"><input value={value} onChange={onChange} placeholder="https://…" /></div>
    </div>
  );
}
