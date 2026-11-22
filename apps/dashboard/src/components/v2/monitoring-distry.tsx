"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  getStaffDistryConfig,
  getStaffDistryEngines,
  getStaffDistryModels,
  getStaffDistryVersions,
  restoreStaffDistryVersion,
  saveStaffDistryConfig,
  type DistryConfig,
  type DistryDefinition,
  type DistryEngines,
  type DistryModels,
  type DistryVersion,
} from "@/lib/api";
import { SkillPanel } from "@/components/v2/monitoring-skills";
import { SkillTree } from "@/components/v2/monitoring-skill-tree";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { timeAgo } from "@/lib/friendly-datetime";

/**
 * Monitoring > Chat > Distry (staff, DISTRY-PRINCIPAL-1119): Distry, our AI principal, as chat-service
 * stores it. Two columns (owner 2026-11-19): what Distry IS and reads on the left (prompt, model, skills,
 * versions), what it can DO on the right (tools, Engines). Every row opens its detail in a right panel;
 * text we own is edited there in place (a skill's text, the prompt), every change a new version.
 * The Engines list is workflow-service's live catalogue verdict, rendered in the served order.
 */

const READ = { staleTime: 30_000, retry: false } as const;
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const who = (editedBy: string) => (editedBy === "seed" ? "From the code" : editedBy);

type Engine = DistryEngines["engines"][number];
type Open = { kind: "tool"; name: string } | { kind: "skill"; slug: string } | { kind: "engine"; outcome: string } | { kind: "version"; version: number } | { kind: "model" } | null;

function definitionOf(v: DistryVersion): DistryDefinition {
  return { systemPrompt: v.systemPrompt, enabledTools: v.enabledTools, skillSlugs: v.skillSlugs, provider: v.provider, model: v.model, effort: v.effort };
}

export function DistryView() {
  const qc = useQueryClient();
  const config = useAuthQuery(["staffDistryConfig"], getStaffDistryConfig, READ);
  const versions = useAuthQuery(["staffDistryVersions"], getStaffDistryVersions, READ);
  const engines = useAuthQuery(["staffDistryEngines"], getStaffDistryEngines, READ);
  const [saving, setSaving] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [open, setOpen] = useState<Open>(null);

  async function write(run: () => Promise<DistryVersion>) {
    setSaving(true);
    setRefusal(null);
    try {
      const saved = await run();
      qc.setQueryData<DistryConfig>(["staffDistryConfig"], (prev) => (prev ? { ...prev, current: saved } : prev));
      await Promise.all([qc.refetchQueries({ queryKey: ["staffDistryConfig"] }), qc.refetchQueries({ queryKey: ["staffDistryVersions"] })]);
    } catch (err) {
      const status = (err as { status?: number }).status;
      console.error("[dashboard] distry: save refused", err);
      setRefusal(status === 409 ? "Someone saved Distry just before you. Their version is loaded; make your change again." : "The save was refused. Nothing changed.");
      await qc.refetchQueries({ queryKey: ["staffDistryConfig"] });
    } finally {
      setSaving(false);
    }
  }

  const c = config.data;
  const current = c?.current;
  const save = (change: Partial<DistryDefinition>) => {
    if (!current) return;
    void write(() => saveStaffDistryConfig({ ...definitionOf(current), ...change }));
  };
  const restore = (version: number) => void write(() => restoreStaffDistryVersion(version));
  const toolOn = (name: string) => current?.enabledTools.includes(name) ?? false;
  const toggleTool = (name: string) => {
    if (!current) return;
    save({ enabledTools: toolOn(name) ? current.enabledTools.filter((t) => t !== name) : [...current.enabledTools, name] });
  };
  const skillOn = (slug: string) => (current ? current.skillSlugs === null || current.skillSlugs.includes(slug) : false);
  const toggleSkill = (slug: string) => {
    if (!c || !current) return;
    const picked = new Set(current.skillSlugs ?? c.skills.map((s) => s.slug));
    if (picked.has(slug)) picked.delete(slug);
    else picked.add(slug);
    save({ skillSlugs: [...picked] });
  };

  if (config.isError) {
    console.error("[dashboard] distry: config read failed", config.error);
    return (
      <div className="k-card">
        <EmptyNote>Could not read Distry from production.</EmptyNote>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Strip config={c} engines={engines.data} saving={saving} />
      {refusal && <p className="text-[13px] text-[var(--data-rose)]">{refusal}</p>}
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <div className="min-w-0 space-y-8">
          <Block title="Prompt" sub="Who Distry is and how it acts. Click the text to edit it.">
            {current ? <PromptEditor key={current.version} value={current.systemPrompt} onSave={(systemPrompt) => save({ systemPrompt })} /> : <Lines />}
          </Block>
          <Block title="Model" sub="The model Distry thinks with, and how long it thinks. Click to change it.">
            {current ? <ModelRow version={current} onOpen={() => setOpen({ kind: "model" })} /> : <Lines />}
          </Block>
          <Block title="Skills" count={c ? (current?.skillSlugs === null ? c.skills.length : current?.skillSlugs.length) : undefined} sub="What Distry reads before it acts. Click one to read and edit its text.">
            {c ? (
              <SkillsList
                config={c}
                isOn={skillOn}
                onToggle={toggleSkill}
                onAll={() => save({ skillSlugs: current?.skillSlugs === null ? c.skills.map((s) => s.slug) : null })}
                onOpen={(slug) => setOpen({ kind: "skill", slug })}
              />
            ) : (
              <Lines />
            )}
          </Block>
          <Block title="Versions" count={versions.data?.length} sub="Every save is a version. Click one to read it whole.">
            <VersionsTable versions={versions} currentVersion={current?.version} onOpen={(version) => setOpen({ kind: "version", version })} />
          </Block>
        </div>
        <div className="min-w-0 space-y-8">
          <Block title="Tools" count={current?.enabledTools.length} sub="What Distry can do. Staff-only tools load only when Distry talks to our team.">
            {c ? <ToolsList config={c} isOn={toolOn} onToggle={toggleTool} onOpen={(name) => setOpen({ kind: "tool", name })} /> : <Lines />}
          </Block>
          <Block title="Engines" count={engines.data?.total} sub="Every outcome Distry can ask for. A call runs the Engine's best script and waits for the result.">
            <EnginesTable engines={engines} onOpen={(outcome) => setOpen({ kind: "engine", outcome })} />
          </Block>
        </div>
      </div>

      {open?.kind === "skill" && (
        <SkillPanel
          slug={open.slug}
          onClose={() => setOpen(null)}
          extra={
            <Switch
              on={skillOn(open.slug)}
              onToggle={() => toggleSkill(open.slug)}
              label="Read by Distry"
              disabled={saving || current?.skillSlugs === null}
              note={current?.skillSlugs === null ? "Distry reads every skill. Untick « Every skill » to pick." : undefined}
            />
          }
        />
      )}
      {open?.kind === "tool" && c && <ToolPanel tool={c.availableTools.find((t) => t.name === open.name)} on={toolOn(open.name)} onToggle={() => toggleTool(open.name)} saving={saving} onClose={() => setOpen(null)} />}
      {open?.kind === "model" && c && (
        <Panel label="Distry · model" wide onClose={() => setOpen(null)}>
          <h2 className="text-[18px] font-medium leading-6">Model</h2>
          <p className="k-fg3 mt-1 mb-4 text-[12px]">A change is saved as a new version, live from Distry&apos;s next turn.</p>
          <ModelPicker config={c} onSave={save} />
          <ModelsTable saving={saving} onUse={(provider, model, effort) => save({ provider, model, effort: provider === "anthropic" ? effort : null })} />
        </Panel>
      )}
      {open?.kind === "engine" && <EnginePanel engine={engines.data?.engines.find((e) => e.outcome === open.outcome)} onClose={() => setOpen(null)} />}
      {open?.kind === "version" && (
        <VersionPanel
          version={versions.data?.find((v) => v.version === open.version)}
          config={c}
          isLive={open.version === current?.version}
          saving={saving}
          onRestore={() => restore(open.version)}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function Strip({ config, engines, saving }: { config: DistryConfig | undefined; engines: { callable: number; total: number } | undefined; saving: boolean }) {
  const cells: { label: string; value: string | null; note: string }[] = [
    { label: "Version", value: config ? `v${config.current.version}` : null, note: config ? (saving ? "Saving…" : `${who(config.current.editedBy)}, ${timeAgo(config.current.createdAt)}`) : "" },
    { label: "Tools on", value: config ? `${config.current.enabledTools.length} of ${config.availableTools.length}` : null, note: "Engines count as one" },
    { label: "Skills read", value: config ? (config.current.skillSlugs === null ? "All" : `${config.current.skillSlugs.length} of ${config.skills.length}`) : null, note: "with every skill under them" },
    { label: "Engines callable", value: engines ? `${engines.callable} of ${engines.total}` : null, note: "from the live catalogue" },
  ];
  return (
    <div className="k-card grid grid-cols-2 divide-[var(--line-subtle)] md:grid-cols-4 md:divide-x">
      {cells.map((cell) => (
        <div key={cell.label} className="p-4">
          <div className="k-label">{cell.label}</div>
          <div className="mt-1 text-[22px] font-medium tabular-nums">{cell.value ?? <Shimmer className="h-6 w-16" />}</div>
          <div className="k-fg3 mt-0.5 truncate text-[12px]">{cell.note}</div>
        </div>
      ))}
      {config?.codeDiffers && <div className="k-fg3 col-span-full border-t border-[var(--line-subtle)] px-4 py-2 text-[12px]">Edited here: this version differs from the one in the code.</div>}
    </div>
  );
}

function Block({ title, sub, count, children }: { title: string; sub: string; count?: number | null; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <h2 className="text-[14px] font-medium">
        {title}
        {count != null && <span className="k-fg3 ml-1.5 font-normal tabular-nums">{count}</span>}
      </h2>
      <p className="k-fg3 mt-0.5 mb-3 text-[12px]">{sub}</p>
      {children}
    </section>
  );
}

function Lines() {
  return (
    <div className="k-card space-y-3 p-4">
      {[0, 1, 2].map((i) => (
        <Shimmer key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

/** Reads as text; a click turns it into one field; leaving it saves a new version, Esc drops the edit. */
function PromptEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);
  const leave = () => {
    setEditing(false);
    if (text.trim() && text !== value) onSave(text);
    else setText(value);
  };
  return editing ? (
    <textarea
      ref={ref}
      value={text}
      spellCheck={false}
      onChange={(e) => setText(e.target.value)}
      onBlur={leave}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setText(value);
          setEditing(false);
        }
      }}
      className="k-inset block h-[420px] w-full resize-y rounded-[12px] p-4 text-[13px] leading-5 outline-none shadow-[inset_0_0_0_1px_var(--accent)]"
      style={{ font: "inherit" }}
    />
  ) : (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") setEditing(true);
      }}
      title="Click to edit"
      className="k-card block max-h-[420px] w-full cursor-text overflow-y-auto p-4 text-left text-[13px] leading-5 whitespace-pre-wrap"
    >
      {value}
    </div>
  );
}

/** A row whose box toggles in place and whose label opens the detail panel. */
function ToggleRow({ on, onToggle, onOpen, label, sub, chip }: { on: boolean; onToggle: () => void; onOpen: () => void; label: string; sub?: string; chip?: string }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      className="k-row flex cursor-pointer items-start gap-3 px-4 py-2.5"
    >
      <input
        type="checkbox"
        aria-label={`${label}: ${on ? "on" : "off"}`}
        checked={on}
        onClick={(e) => e.stopPropagation()}
        onChange={onToggle}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
      />
      <span className="min-w-0 flex-1">
        <span className={`text-[13px] ${on ? "k-fg" : "k-fg3"}`}>{label}</span>
        {chip && <span className="k-chip ml-2">{chip}</span>}
        {sub && <span className="k-fg3 block truncate text-[12px]">{sub}</span>}
      </span>
    </div>
  );
}

function ToolsList({ config, isOn, onToggle, onOpen }: { config: DistryConfig; isOn: (n: string) => boolean; onToggle: (n: string) => void; onOpen: (n: string) => void }) {
  const [showOff, setShowOff] = useState(false);
  const [q, setQ] = useState("");
  const used = config.availableTools.filter((t) => isOn(t.name));
  const off = config.availableTools.filter((t) => !isOn(t.name));
  const needle = q.trim().toLowerCase();
  const shownOff = needle ? off.filter((t) => t.name.toLowerCase().includes(needle) || t.description.toLowerCase().includes(needle)) : off;
  const row = (t: DistryConfig["availableTools"][number]) => (
    <ToggleRow key={t.name} on={isOn(t.name)} onToggle={() => onToggle(t.name)} onOpen={() => onOpen(t.name)} label={t.name} sub={t.description} chip={t.staffOnly ? "Staff only" : undefined} />
  );
  return (
    <div className="k-card divide-y divide-[var(--line-subtle)] overflow-hidden">
      {used.map(row)}
      {showOff ? (
        <>
          <div className="px-4 py-2.5">
            <input className="k-input w-full" placeholder={`Search ${off.length} tools Distry does not use`} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          </div>
          {shownOff.map(row)}
          {shownOff.length === 0 && <EmptyNote>No tool matches.</EmptyNote>}
        </>
      ) : (
        <div className="px-4 py-2">
          <button type="button" className="k-btn-ghost" onClick={() => setShowOff(true)}>
            Add a tool ({off.length} more)
          </button>
        </div>
      )}
    </div>
  );
}

/** The SAME tree editor as Monitoring > Chat > Skills (SKILL-TREE-EDIT-1122), with Distry's checkbox on each line. */
function SkillsList({ config, isOn, onToggle, onAll, onOpen }: { config: DistryConfig; isOn: (s: string) => boolean; onToggle: (s: string) => void; onAll: () => void; onOpen: (s: string) => void }) {
  const all = config.current.skillSlugs === null;
  return (
    <SkillTree
      onOpen={onOpen}
      dimmed={(slug) => !isOn(slug)}
      head={
        <label className="k-row flex cursor-pointer items-start gap-3 px-4 py-2.5">
          <input type="checkbox" checked={all} onChange={onAll} className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" />
          <span className="min-w-0 flex-1">
            <span className="text-[13px]">Every skill</span>
            <span className="k-fg3 block text-[12px]">New skills are read too. Index and client-comms are always read.</span>
          </span>
        </label>
      }
      leading={(s) => (
        <input
          type="checkbox"
          aria-label={`${s.title}: ${isOn(s.slug) ? "on" : "off"}`}
          checked={isOn(s.slug)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggle(s.slug)}
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
        />
      )}
    />
  );
}

function ModelRow({ version, onOpen }: { version: DistryVersion; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="k-card k-row flex w-full items-center gap-6 px-4 py-3 text-left">
      <span className="min-w-0">
        <span className="k-label block">Model</span>
        <span className="text-[13px]">{version.model}</span>
        <span className="k-fg3 ml-1.5 text-[12px]">{version.provider}</span>
      </span>
      <span className="min-w-0">
        <span className="k-label block">Thinking</span>
        <span className="text-[13px]">{version.effort ?? "Model default"}</span>
      </span>
      <span className="k-fg3 ml-auto text-[16px]" aria-hidden>
        ›
      </span>
    </button>
  );
}

function ModelPicker({ config, onSave }: { config: DistryConfig; onSave: (change: Partial<DistryDefinition>) => void }) {
  const { provider, model, effort } = config.current;
  return (
    <div className="k-card grid gap-4 p-4 sm:grid-cols-3">
      <Field label="Provider">
        <select
          className="k-input w-full"
          value={provider}
          onChange={(e) => onSave({ provider: e.target.value, model: config.models[e.target.value]?.[0] ?? model, effort: e.target.value === "anthropic" ? effort : null })}
        >
          {Object.keys(config.models).map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </Field>
      <Field label="Model">
        <select className="k-input w-full" value={model} onChange={(e) => onSave({ model: e.target.value })}>
          {(config.models[provider] ?? [model]).map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </Field>
      <Field label="Thinking">
        <select className="k-input w-full" value={effort ?? ""} disabled={provider !== "anthropic"} onChange={(e) => onSave({ effort: e.target.value || null })}>
          <option value="">Model default</option>
          {config.efforts.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </Field>
    </div>
  );
}

const usd = (n: number | null) => (n == null ? null : `$${n.toLocaleString("en-US", { maximumFractionDigits: 3 })}`);

/** Every model Distry can run, as chat-service serves them: best intelligence per dollar first (served order). */
function ModelsTable({ onUse, saving }: { onUse: (provider: string, model: string, effort: string | null) => void; saving: boolean }) {
  const q = useAuthQuery(["staffDistryModels"], getStaffDistryModels, READ);
  if (q.isError) {
    console.error("[dashboard] distry: models read failed", q.error);
    return <EmptyNote>Could not read the models from production.</EmptyNote>;
  }
  const d: DistryModels | undefined = q.data;
  const dash = <span className="k-fg4">—</span>;
  return (
    <div className="mt-6">
      <h3 className="k-label mb-1">Every model, best intelligence per dollar first</h3>
      {d && (
        <p className={`mb-3 text-[12px] ${d.refresh.broken ? "text-[var(--data-rose)]" : "k-fg3"}`}>
          {d.refresh.state === "ok" && d.readAt ? `${d.indexName}, read ${timeAgo(d.readAt)}.` : d.refresh.sentence}
        </p>
      )}
      <div className="k-card overflow-hidden">
        <table className="w-full table-fixed text-[13px]">
          <thead>
            <tr className="k-line-subtle border-b text-left">
              <th className="k-label px-3 py-2.5 first:pl-4">Model</th>
              <th className="k-label w-[150px] px-3 py-2.5 text-right">$ / 1M in · out</th>
              <th className="k-label w-[84px] px-3 py-2.5 text-right">Index</th>
              <th className="k-label w-[72px] px-3 py-2.5 text-right">Rank</th>
              <th className="k-label w-[96px] px-3 py-2.5 text-right">Index / $</th>
              <th className="k-label w-[72px] px-3 py-2.5 last:pr-4" />
            </tr>
          </thead>
          <tbody>
            {d === undefined
              ? [0, 1, 2, 3].map((i) => (
                  <tr key={i} className="h-10">
                    <td colSpan={6} className="px-4">
                      <Shimmer className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              : d.models.flatMap((m) => {
                  const why = m.index.reason ?? m.intelligencePerDollar.reason ?? m.price.reason;
                  const modelName = m.names[0] ?? m.modelId;
                  const ratio = (v: number | null) => (v == null ? dash : v.toLocaleString("en-US", { maximumSignificantDigits: 3 }));
                  const head = (
                    <tr key={m.modelId} className="k-row k-line-subtle border-b">
                      <td className="px-3 py-2 first:pl-4">
                        {m.displayName}
                        {m.isCurrent && <span className="k-chip ml-1.5">Live</span>}
                        <span className="k-fg3 block truncate text-[12px]" title={why ?? m.thinking}>
                          {m.provider} · {why ?? m.thinking}
                        </span>
                        {m.availability && !m.availability.runsNow && m.availability.reason && (
                          <span className="block text-[12px] text-[var(--data-rose)]">{m.availability.reason}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {m.price.inputPer1mUsd == null ? dash : `${usd(m.price.inputPer1mUsd)} · ${usd(m.price.outputPer1mUsd)}`}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.index.score ?? dash}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.index.rank == null ? dash : `${m.index.rank} of ${m.index.rankOutOf}`}</td>
                      <td className="px-3 py-2 text-right tabular-nums" title={m.intelligencePerDollar.basis === "blended_price_3_to_1" ? "On our blended 1M-token price (no published index run cost)" : undefined}>
                        {ratio(m.intelligencePerDollar.value)}
                      </td>
                      <td className="px-3 py-2 text-right last:pr-4">
                        {m.variants.length === 0 && !m.isCurrent && (
                          <button type="button" className="k-btn-ghost" disabled={saving} onClick={() => onUse(m.provider, modelName, null)}>
                            Use
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                  // Every thinking level Artificial Analysis scored this model at, in the served order (best score first).
                  const levels = m.variants.map((v) => {
                    const live = m.isCurrent && v.isDistrysThinking;
                    return (
                      <tr key={`${m.modelId}-${v.aaName}`} className="k-row k-line-subtle border-b">
                        <td className="k-fg2 py-1.5 pr-3 pl-8 text-[12px]">
                          {v.variantLabel ?? v.aaName}
                          {v.isDistrysThinking && <span className="k-fg3"> · Distry&apos;s thinking</span>}
                        </td>
                        <td className="px-3 py-1.5" />
                        <td className="px-3 py-1.5 text-right text-[12px] tabular-nums">{v.score ?? dash}</td>
                        <td className="px-3 py-1.5" />
                        <td className="px-3 py-1.5 text-right text-[12px] tabular-nums">{ratio(v.intelligencePerDollar)}</td>
                        <td className="px-3 py-1.5 text-right last:pr-4">
                          {live ? (
                            <span className="k-chip">Live</span>
                          ) : (
                            <button type="button" className="k-btn-ghost" disabled={saving} onClick={() => onUse(m.provider, modelName, v.effort)}>
                              Use
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  });
                  return [head, ...levels];
                })}
          </tbody>
        </table>
      </div>
      {d && (
        <p className="k-fg3 mt-3 text-[12px]">
          {d.source.attribution}{" "}
          <a href={d.source.url} target="_blank" rel="noreferrer" className="underline">
            {d.source.name}
          </a>
          . {d.ratioBasis}
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="k-label mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function CallableDot({ callable }: { callable: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-2)]">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: callable ? "var(--run)" : "var(--data-rose)" }} />
      {callable ? "Callable" : "Not callable"}
    </span>
  );
}

function EnginesTable({ engines, onOpen }: { engines: { data?: DistryEngines; isError: boolean; error: unknown }; onOpen: (outcome: string) => void }) {
  if (engines.isError) {
    console.error("[dashboard] distry: engines read failed", engines.error);
    return (
      <div className="k-card">
        <EmptyNote>Could not read the Engines from production.</EmptyNote>
      </div>
    );
  }
  // Served order, never re-sorted here.
  const rows = engines.data?.engines;
  return (
    <div className="k-card overflow-hidden">
      <table className="w-full table-fixed text-[13px]">
        <thead>
          <tr className="k-line-subtle border-b text-left">
            <th className="k-label px-3 py-2.5 first:pl-4">Engine</th>
            <th className="k-label w-[130px] px-3 py-2.5 last:pr-4">Distry</th>
          </tr>
        </thead>
        <tbody>
          {rows === undefined
            ? [0, 1, 2, 3].map((i) => (
                <tr key={i} className="h-10">
                  <td colSpan={2} className="px-4">
                    <Shimmer className="h-4 w-full" />
                  </td>
                </tr>
              ))
            : rows.map((e) => (
                <tr
                  key={e.outcome}
                  tabIndex={0}
                  onClick={() => onOpen(e.outcome)}
                  onKeyDown={(k) => {
                    if (k.key === "Enter") onOpen(e.outcome);
                  }}
                  className="k-row k-line-subtle cursor-pointer border-b last:border-b-0"
                >
                  <td className="px-3 py-2 first:pl-4">
                    {e.name}
                    {e.reason && <span className="k-fg3 block truncate text-[12px]">{e.reason}</span>}
                  </td>
                  <td className="px-3 py-2 last:pr-4">
                    <CallableDot callable={e.callable} />
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

function VersionsTable({ versions, currentVersion, onOpen }: { versions: { data?: DistryVersion[]; isError: boolean; error: unknown }; currentVersion: number | undefined; onOpen: (v: number) => void }) {
  if (versions.isError) {
    console.error("[dashboard] distry: versions read failed", versions.error);
    return (
      <div className="k-card">
        <EmptyNote>Could not read Distry&apos;s versions from production.</EmptyNote>
      </div>
    );
  }
  return (
    <div className="k-card overflow-hidden">
      <table className="w-full table-fixed text-[13px]">
        <thead>
          <tr className="k-line-subtle border-b text-left">
            <th className="k-label w-[96px] px-3 py-2.5 first:pl-4">Version</th>
            <th className="k-label px-3 py-2.5">Saved by</th>
            <th className="k-label w-[130px] px-3 py-2.5 last:pr-4">When</th>
          </tr>
        </thead>
        <tbody>
          {versions.data === undefined
            ? [0, 1, 2].map((i) => (
                <tr key={i} className="h-10">
                  <td colSpan={3} className="px-4">
                    <Shimmer className="h-4 w-full" />
                  </td>
                </tr>
              ))
            : versions.data.map((v) => (
                <tr
                  key={v.version}
                  tabIndex={0}
                  onClick={() => onOpen(v.version)}
                  onKeyDown={(k) => {
                    if (k.key === "Enter") onOpen(v.version);
                  }}
                  className="k-row k-line-subtle cursor-pointer border-b last:border-b-0"
                >
                  <td className="px-3 py-2 tabular-nums first:pl-4">
                    v{v.version}
                    {v.version === currentVersion && <span className="k-chip ml-1.5">Live</span>}
                  </td>
                  <td className="truncate px-3 py-2">
                    {who(v.editedBy)}
                    {(v.note || v.restoredFrom) && <span className="k-fg3 block truncate text-[12px]">{v.restoredFrom ? `Restored v${v.restoredFrom}` : v.note}</span>}
                  </td>
                  <td className="k-fg2 px-3 py-2 text-[12px] last:pr-4" title={when(v.createdAt)}>
                    {timeAgo(v.createdAt)}
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Right panels ───────────────────────────────────────────────────────────

function Panel({ label, onClose, children, wide = false }: { label: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById("v2-portal")), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!host) return null;
  return createPortal(
    <aside role="dialog" aria-label={label} className={`k-popover fixed inset-y-2 right-2 z-[80] flex flex-col overflow-hidden ${wide ? "w-[min(920px,calc(100vw-16px))]" : "w-[min(640px,calc(100vw-16px))]"}`}>
      <div className="k-line-subtle flex h-11 shrink-0 items-center justify-between gap-3 border-b px-4">
        <span className="k-label truncate">{label}</span>
        <button type="button" aria-label="Close" onClick={onClose} className="k-btn-ghost inline-flex h-6 w-6 items-center justify-center">
          ×
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </aside>,
    host,
  );
}

function Switch({ on, onToggle, label, disabled, note }: { on: boolean; onToggle: () => void; label: string; disabled?: boolean; note?: string }) {
  return (
    <label className="k-inset flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5">
      <input type="checkbox" checked={on} disabled={disabled} onChange={onToggle} className="h-4 w-4 accent-[var(--accent)]" />
      <span className="min-w-0">
        <span className="text-[13px]">{label}</span>
        {note && <span className="k-fg3 block text-[12px]">{note}</span>}
      </span>
    </label>
  );
}

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="mt-4 grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="k-label pt-0.5">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ToolPanel({ tool, on, onToggle, saving, onClose }: { tool: DistryConfig["availableTools"][number] | undefined; on: boolean; onToggle: () => void; saving: boolean; onClose: () => void }) {
  return (
    <Panel label={`Tool · ${tool?.name ?? ""}`} onClose={onClose}>
      {!tool ? (
        <EmptyNote>This tool is no longer served.</EmptyNote>
      ) : (
        <>
          <h2 className="k-mono text-[16px] font-medium">{tool.name}</h2>
          {tool.staffOnly && <span className="k-chip mt-2 inline-block">Staff only</span>}
          <div className="mt-4">
            <Switch on={on} onToggle={onToggle} disabled={saving} label="Distry can use it" note={tool.staffOnly ? "Loaded only when Distry talks to our team." : undefined} />
          </div>
          <h3 className="k-label mt-6 mb-2">What it does</h3>
          <p className="text-[13px] leading-5 whitespace-pre-wrap">{tool.description}</p>
          <p className="k-fg3 mt-4 text-[12px]">This text is written with the tool in chat-service: it is what Distry reads to choose it.</p>
        </>
      )}
    </Panel>
  );
}

function EnginePanel({ engine, onClose }: { engine: Engine | undefined; onClose: () => void }) {
  return (
    <Panel label={`Engine · ${engine?.outcome ?? ""}`} onClose={onClose}>
      {!engine ? (
        <EmptyNote>This Engine is no longer in the catalogue.</EmptyNote>
      ) : (
        <>
          <h2 className="text-[18px] font-medium leading-6">{engine.name}</h2>
          <div className="mt-2">
            <CallableDot callable={engine.callable} />
          </div>
          {engine.reason && <p className="k-fg2 mt-2 text-[13px]">{engine.reason}</p>}
          <Facts
            rows={[
              ["Outcome", <span key="o" className="k-mono text-[12px]">{engine.outcome}</span>],
              ["Scripts", `${engine.counts.runnable} runnable, ${engine.counts.live} live, ${engine.counts.scripts} stored`],
              [
                "A call needs",
                engine.inputs.length === 0 ? (
                  <span key="n" className="k-fg3">Nothing first</span>
                ) : (
                  <span key="i" className="flex flex-wrap gap-1">
                    {engine.inputs.flatMap((i) =>
                      i.units.map((u) => (
                        <span key={`${u}-${i.channel ?? ""}`} className="k-chip">
                          {i.channel ? `${u} on ${i.channel}` : u}
                        </span>
                      )),
                    )}
                  </span>
                ),
              ],
            ]}
          />
          <h3 className="k-label mt-6 mb-2">Scripts the Rating can pick</h3>
          {engine.scripts.length === 0 ? (
            <p className="k-fg3 text-[13px]">None yet.</p>
          ) : (
            <div className="k-card divide-y divide-[var(--line-subtle)] overflow-hidden">
              {engine.scripts.map((s) => (
                <div key={s.dynasty} className="px-4 py-2.5">
                  <div className="text-[13px]">
                    {s.name} <span className="k-fg3 tabular-nums">v{s.version}</span>
                  </div>
                  <div className="k-mono k-fg3 truncate text-[12px]">{s.dynasty}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function VersionPanel({
  version,
  config,
  isLive,
  saving,
  onRestore,
  onClose,
}: {
  version: DistryVersion | undefined;
  config: DistryConfig | undefined;
  isLive: boolean;
  saving: boolean;
  onRestore: () => void;
  onClose: () => void;
}) {
  const skillTitle = (slug: string) => config?.skills.find((s) => s.slug === slug)?.title ?? slug;
  return (
    <Panel label={`Distry · version ${version?.version ?? ""}`} onClose={onClose}>
      {!version ? (
        <EmptyNote>This version is not in the history.</EmptyNote>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-medium leading-6">Version {version.version}</h2>
              <p className="k-fg3 mt-1 text-[12px]">
                {who(version.editedBy)}, {timeAgo(version.createdAt)} ({when(version.createdAt)})
                {version.restoredFrom ? ` · restored v${version.restoredFrom}` : ""}
              </p>
            </div>
            {isLive ? (
              <span className="k-chip">Live</span>
            ) : (
              <button type="button" className="k-btn" disabled={saving} onClick={onRestore}>
                Restore
              </button>
            )}
          </div>
          {version.note && <p className="mt-3 text-[13px]">{version.note}</p>}
          <Facts
            rows={[
              ["Model", `${version.provider} · ${version.model}${version.effort ? ` · ${version.effort}` : ""}`],
              ["Tools", `${version.enabledTools.length} on`],
              ["Skills", version.skillSlugs === null ? "Every skill" : version.skillSlugs.map(skillTitle).join(", ")],
            ]}
          />
          <h3 className="k-label mt-6 mb-2">Tools</h3>
          <div className="flex flex-wrap gap-1">
            {version.enabledTools.map((t) => (
              <span key={t} className="k-chip k-mono">
                {t}
              </span>
            ))}
          </div>
          <h3 className="k-label mt-6 mb-2">Prompt</h3>
          <div className="k-inset rounded-[10px] p-3 text-[13px] leading-5 whitespace-pre-wrap">{version.systemPrompt}</div>
        </>
      )}
    </Panel>
  );
}
