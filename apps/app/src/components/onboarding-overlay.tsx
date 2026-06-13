"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CheckIcon, ChevronLeftIcon, EmailIcon, ChartIcon, SparkleIcon, SpinnerIcon, CircleIcon } from "./icons";

export interface Brand {
  name: string;
  url: string;
}

const LOADING_STEPS = [
  { id: "ls-1", title: "Reading your product...", label: "Reading", delay: 1200 },
  { id: "ls-2", title: "Extracting ICP and objectives...", label: "Extracting your ICP and objectives", delay: 1600 },
  { id: "ls-3", title: "Selecting email strategy...", label: "Selecting email strategy", delay: 1200 },
  { id: "ls-4", title: "Drafting first email templates...", label: "Drafting your first email templates", delay: 1000 },
];

function hostnameOf(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

export function OnboardingOverlay({ hidden, onComplete }: { hidden: boolean; onComplete: (brand: Brand) => void }) {
  const [step, setStep] = useState(1);
  const [url, setUrl] = useState("https://prompthub.ai");
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
    setStep(3);
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
      const toStep4 = setTimeout(() => setStep(4), 700);
      timers.current.push(toStep4);
    }, elapsed);
    timers.current.push(last);
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

  return (
    <div className={`onboarding-overlay${hidden ? " hidden" : ""}`}>
      <div className={`onboarding-card${step === 4 ? " wide" : ""}`}>

        {/* Step 1: Welcome */}
        <div className={`ob-step${step === 1 ? " active" : ""}`}>
          <div className="ob-logo">
            <Image src="/logo/logo-distribute.svg" alt="" width={32} height={32} />
            <span className="ob-logo-name">distribute</span>
            <span className="nav-chip">beta</span>
          </div>
          <h1 className="ob-title">Cold email outreach,<br />done for you.</h1>
          <p className="ob-sub">Drop your product URL and a daily budget. We find leads, write the emails, send them, and forward qualified replies to Gmail.</p>

          <div className="ob-features">
            <div className="ob-feature">
              <div className="ob-feature-icon"><EmailIcon width={16} height={16} /></div>
              <div className="ob-feature-title">Auto emails</div>
              <div className="ob-feature-desc">Personalized cold emails sent daily</div>
            </div>
            <div className="ob-feature">
              <div className="ob-feature-icon"><CheckIcon width={16} height={16} /></div>
              <div className="ob-feature-title">Qualified only</div>
              <div className="ob-feature-desc">Only positive replies reach you</div>
            </div>
            <div className="ob-feature">
              <div className="ob-feature-icon"><ChartIcon width={16} height={16} /></div>
              <div className="ob-feature-title">Pay per send</div>
              <div className="ob-feature-desc">$0.036/email, avg $1.42/reply</div>
            </div>
          </div>

          <div className="ob-actions">
            <button className="btn btn-p btn-lg" onClick={() => setStep(2)}>Get started</button>
            <button className="btn btn-g" onClick={() => onComplete({ name: hostname, url })}>See a live demo</button>
          </div>
        </div>

        {/* Step 2: Setup */}
        <div className={`ob-step${step === 2 ? " active" : ""}`}>
          <button className="ob-back" onClick={() => setStep(1)}>
            <ChevronLeftIcon width={14} height={14} />
            Back
          </button>
          <h2 className="ob-title" style={{ fontSize: "1.6rem" }}>Two things, then you&apos;re live.</h2>
          <p className="ob-sub" style={{ marginBottom: "1.5rem" }}>We read your product, find the leads, and write every email. You just need a URL and a budget.</p>

          <div className="form-group">
            <label className="form-label" htmlFor="input-url">Product URL</label>
            <input type="url" className="form-input" id="input-url" placeholder="https://yourproduct.com" value={url} onChange={(e) => setUrl(e.target.value)} />
            <p className="form-hint">We read your site to extract your ICP, value prop, and email strategy.</p>
          </div>

          <div className="ob-actions" style={{ marginTop: "2rem" }}>
            <button className="btn btn-p btn-lg" onClick={startAnalyze}>Analyze my product →</button>
          </div>
        </div>

        {/* Step 3: Loading */}
        <div className={`ob-step${step === 3 ? " active" : ""}`}>
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

        {/* Step 4: Campaign config */}
        <div className={`ob-step${step === 4 ? " active" : ""}`}>
          <button className="ob-back" onClick={() => setStep(2)}>
            <ChevronLeftIcon width={14} height={14} />
            Back
          </button>

          <div style={{ marginBottom: "1.25rem" }}>
            <h2 className="ob-title" style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>Your campaign is ready.</h2>
            <p className="ob-sub" style={{ marginBottom: 0, fontSize: "var(--fs-sm)" }}>We read <strong>{hostname}</strong> and built your outreach strategy. Review and adjust before launching.</p>
          </div>

          {/* Budget */}
          <div className="ob-section-label">Daily budget</div>
          <div className="ob-budget-grid">
            <div className={`ob-budget-card${budget === "starter" ? " active" : ""}`} onClick={() => setBudget("starter")}>
              <div className="ob-budget-tier">Starter</div>
              <div className="ob-budget-price">$29 <span>/ day</span></div>
              <div className="ob-budget-target">targets ~5 closes / mo</div>
              <div className="ob-budget-revenue">~$12,507 revenue / month</div>
              <div className="ob-budget-cac">CAC ℹ 7%</div>
            </div>
            <div className={`ob-budget-card${budget === "recommended" ? " active" : ""}`} onClick={() => setBudget("recommended")}>
              <div className="ob-budget-badge">Recommended ★</div>
              <div className="ob-budget-price">$58 <span>/ day</span></div>
              <div className="ob-budget-target">targets ~10 closes / mo</div>
              <div className="ob-budget-revenue">~$24,999 revenue / month</div>
              <div className="ob-budget-cac">CAC ℹ 7%</div>
            </div>
            <div className={`ob-budget-card${budget === "growth" ? " active" : ""}`} onClick={() => setBudget("growth")}>
              <div className="ob-budget-tier">Growth</div>
              <div className="ob-budget-price">$115 <span>/ day</span></div>
              <div className="ob-budget-target">targets ~20 closes / mo</div>
              <div className="ob-budget-revenue">~$49,999 revenue / month</div>
              <div className="ob-budget-cac">CAC ℹ 7%</div>
            </div>
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

          {/* Workflow */}
          <div className="ob-workflow">
            <SparkleIcon width={11} height={11} />
            auto-selected &nbsp;·&nbsp; <strong>Sales Cold Email Outreach Legato</strong>
            <a href="#" style={{ marginLeft: "auto", color: "var(--accent)", textDecoration: "none", fontWeight: 600 }} onClick={(e) => e.preventDefault()}>See example emails</a>
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
              <div className="ob-cd-group-label">Email hooks</div>
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
