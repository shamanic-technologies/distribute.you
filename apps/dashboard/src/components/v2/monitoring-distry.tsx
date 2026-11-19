"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  getStaffDistryConfig,
  getStaffDistryEngines,
  getStaffDistryVersions,
  restoreStaffDistryVersion,
  saveStaffDistryConfig,
  type DistryConfig,
  type DistryDefinition,
  type DistryVersion,
} from "@/lib/api";
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";

/**
 * Monitoring > Chat > Distry (staff, DISTRY-PRINCIPAL-1119): Distry, our AI principal, as chat-service
 * stores it. Prompt, tools, skills and model are edited in place; every change is a new version
 * (chat-service), live from Distry's next turn. The Engines block lists every Engine of the live
 * catalogue and whether Distry can call it now (workflow-service's verdict, rendered as served).
 */

const READ = { staleTime: 30_000, retry: false } as const;
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const who = (editedBy: string) => (editedBy === "seed" ? "From the code" : editedBy);

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

  async function afterWrite(saved: DistryVersion) {
    qc.setQueryData<DistryConfig>(["staffDistryConfig"], (prev) => (prev ? { ...prev, current: saved } : prev));
    await Promise.all([qc.refetchQueries({ queryKey: ["staffDistryConfig"] }), qc.refetchQueries({ queryKey: ["staffDistryVersions"] })]);
  }

  async function write(run: () => Promise<DistryVersion>) {
    setSaving(true);
    setRefusal(null);
    try {
      await afterWrite(await run());
    } catch (err) {
      const status = (err as { status?: number }).status;
      console.error("[dashboard] distry: save refused", err);
      setRefusal(status === 409 ? "Someone saved Distry just before you. Their version is loaded; make your change again." : "The save was refused. Nothing changed.");
      await qc.refetchQueries({ queryKey: ["staffDistryConfig"] });
    } finally {
      setSaving(false);
    }
  }

  const current = config.data?.current;
  const save = (change: Partial<DistryDefinition>) => {
    if (!current) return;
    void write(() => saveStaffDistryConfig({ ...definitionOf(current), ...change }));
  };
  const restore = (version: number) => void write(() => restoreStaffDistryVersion(version));

  if (config.isError) {
    console.error("[dashboard] distry: config read failed", config.error);
    return (
      <div className="k-card">
        <EmptyNote>Could not read Distry from production.</EmptyNote>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <Strip config={config.data} engines={engines.data} saving={saving} />
      {refusal && <p className="text-[13px] text-[var(--data-rose)]">{refusal}</p>}
      <Row title="Prompt" purpose="Who Distry is and how it acts. The skills and the turn's context are added at each turn.">
        {current ? <PromptEditor key={current.version} value={current.systemPrompt} onSave={(systemPrompt) => save({ systemPrompt })} /> : <Lines />}
      </Row>
      <Row title="Tools" purpose="What Distry can do. Staff-only tools load only when Distry talks to our team.">
        {config.data ? <ToolsEditor config={config.data} onSave={(enabledTools) => save({ enabledTools })} /> : <Lines />}
      </Row>
      <Row title="Skills" purpose="What Distry reads before it acts. Edit a skill's text in Chat › Skills.">
        {config.data ? <SkillsPicker config={config.data} onSave={(skillSlugs) => save({ skillSlugs })} /> : <Lines />}
      </Row>
      <Row title="Model" purpose="The model Distry thinks with, and how long it thinks.">
        {config.data ? <ModelPicker config={config.data} onSave={save} /> : <Lines />}
      </Row>
      <Row title="Engines" purpose="Every outcome Distry can ask for. Each call runs the Engine's best script and waits for the result.">
        <EnginesTable engines={engines} />
      </Row>
      <Row title="Versions" purpose="Every save is a version. Restoring one saves it again as the newest.">
        <VersionsTable versions={versions} currentVersion={current?.version} onRestore={restore} disabled={saving} />
      </Row>
    </div>
  );
}

function Strip({ config, engines, saving }: { config: DistryConfig | undefined; engines: { callable: number; total: number } | undefined; saving: boolean }) {
  const cells: { label: string; value: string | null; note: string }[] = [
    { label: "Version", value: config ? `v${config.current.version}` : null, note: config ? (saving ? "Saving…" : `${who(config.current.editedBy)}, ${when(config.current.createdAt)}`) : "" },
    { label: "Tools on", value: config ? `${config.current.enabledTools.length} of ${config.availableTools.length}` : null, note: "Engines count as one" },
    { label: "Skills read", value: config ? (config.current.skillSlugs === null ? "All" : `${config.current.skillSlugs.length} of ${config.skills.length}`) : null, note: "with every skill under them" },
    { label: "Engines callable", value: engines ? `${engines.callable} of ${engines.total}` : null, note: "from the live catalogue" },
  ];
  return (
    <div className="k-card grid grid-cols-2 divide-[var(--line-subtle)] md:grid-cols-4 md:divide-x">
      {cells.map((c) => (
        <div key={c.label} className="p-4">
          <div className="k-label">{c.label}</div>
          <div className="mt-1 text-[22px] font-medium tabular-nums">{c.value ?? <Shimmer className="h-6 w-16" />}</div>
          <div className="k-fg3 mt-0.5 truncate text-[12px]">{c.note}</div>
        </div>
      ))}
      {config?.codeDiffers && <div className="k-fg3 col-span-full border-t border-[var(--line-subtle)] px-4 py-2 text-[12px]">Edited here: this version differs from the one in the code.</div>}
    </div>
  );
}

function Row({ title, purpose, children }: { title: string; purpose: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
      <div>
        <h2 className="text-[14px] font-medium">{title}</h2>
        <p className="k-fg3 mt-1 text-[12px]">{purpose}</p>
      </div>
      <div className="min-w-0">{children}</div>
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
  return (
    <div className="k-card p-0">
      {editing ? (
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={leave}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setText(value);
              setEditing(false);
            }
          }}
          className="block h-[480px] w-full resize-y bg-transparent p-4 text-[13px] leading-5 outline-none"
          style={{ font: "inherit" }}
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="block max-h-[480px] w-full overflow-y-auto p-4 text-left text-[13px] leading-5 whitespace-pre-wrap">
          {value}
        </button>
      )}
    </div>
  );
}

function Check({ on, onToggle, label, sub, chip, depth = 0 }: { on: boolean; onToggle: () => void; label: string; sub?: string; chip?: string; depth?: number }) {
  return (
    <label className="k-row flex cursor-pointer items-start gap-3 px-4 py-2.5" style={{ paddingLeft: 16 + depth * 20 }}>
      <input type="checkbox" checked={on} onChange={onToggle} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
      <span className="min-w-0 flex-1">
        <span className={`text-[13px] ${on ? "k-fg" : "k-fg3"}`}>{label}</span>
        {chip && <span className="k-chip ml-2">{chip}</span>}
        {sub && <span className="k-fg3 block text-[12px]">{sub}</span>}
      </span>
    </label>
  );
}

function ToolsEditor({ config, onSave }: { config: DistryConfig; onSave: (tools: string[]) => void }) {
  const on = new Set(config.current.enabledTools);
  const toggle = (name: string) => onSave(on.has(name) ? config.current.enabledTools.filter((t) => t !== name) : [...config.current.enabledTools, name]);
  return (
    <div className="k-card divide-y divide-[var(--line-subtle)] overflow-hidden">
      {config.availableTools.map((t) => (
        <Check key={t.name} on={on.has(t.name)} onToggle={() => toggle(t.name)} label={t.name} sub={t.description} chip={t.staffOnly ? "Staff only" : undefined} />
      ))}
    </div>
  );
}

function SkillsPicker({ config, onSave }: { config: DistryConfig; onSave: (slugs: string[] | null) => void }) {
  const all = config.current.skillSlugs === null;
  const picked = new Set(config.current.skillSlugs ?? config.skills.map((s) => s.slug));
  const depthOf = useMemo(() => {
    const parent = new Map(config.skills.map((s) => [s.slug, s.parentSlug]));
    return (slug: string) => {
      let d = 0;
      for (let p = parent.get(slug); p; p = parent.get(p)) d++;
      return d;
    };
  }, [config.skills]);
  const toggle = (slug: string) => {
    const next = new Set(picked);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    onSave([...next]);
  };
  return (
    <div className="k-card divide-y divide-[var(--line-subtle)] overflow-hidden">
      <Check on={all} onToggle={() => onSave(all ? config.skills.map((s) => s.slug) : null)} label="Every skill" sub="New skills are read too. Index and client-comms are always read." />
      {config.skills.map((s) => (
        <Check key={s.slug} on={picked.has(s.slug)} onToggle={() => toggle(s.slug)} label={s.title} sub={s.description} depth={depthOf(s.slug)} />
      ))}
    </div>
  );
}

function ModelPicker({ config, onSave }: { config: DistryConfig; onSave: (change: Partial<DistryDefinition>) => void }) {
  const { provider, model, effort } = config.current;
  const providers = Object.keys(config.models);
  return (
    <div className="k-card grid gap-4 p-4 sm:grid-cols-3">
      <Field label="Provider">
        <select className="k-input w-full" value={provider} onChange={(e) => onSave({ provider: e.target.value, model: config.models[e.target.value]?.[0] ?? model, effort: e.target.value === "anthropic" ? effort : null })}>
          {providers.map((p) => (
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="k-label mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function EnginesTable({ engines }: { engines: ReturnType<typeof useAuthQuery<Awaited<ReturnType<typeof getStaffDistryEngines>>>> }) {
  if (engines.isError) {
    console.error("[dashboard] distry: engines read failed", engines.error);
    return (
      <div className="k-card">
        <EmptyNote>Could not read the Engines from production.</EmptyNote>
      </div>
    );
  }
  // Served order, never re-sorted here.
  const sorted = engines.data?.engines;
  return (
    <div className="k-card overflow-hidden">
      <div className="k-scroll overflow-x-auto">
        <table className="w-full table-fixed text-[13px]">
          <thead>
            <tr className="k-line-subtle border-b text-left">
              <th className="k-label w-[38%] px-3 py-2.5 first:pl-4">Engine</th>
              <th className="k-label w-[130px] px-3 py-2.5">Distry</th>
              <th className="k-label px-3 py-2.5 last:pr-4">Why</th>
            </tr>
          </thead>
          <tbody>
            {sorted === undefined
              ? [0, 1, 2, 3].map((i) => (
                  <tr key={i} className="h-10">
                    <td colSpan={3} className="px-4">
                      <Shimmer className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              : sorted.map((e) => (
                  <tr key={e.outcome} className="k-row k-line-subtle border-b last:border-b-0">
                    <td className="px-3 py-2 first:pl-4">{e.name}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-2)]">
                        <span className="h-2 w-2 rounded-full" style={{ background: e.callable ? "var(--run)" : "var(--data-rose)" }} />
                        {e.callable ? "Callable" : "Not callable"}
                      </span>
                    </td>
                    <td className="k-fg2 px-3 py-2 last:pr-4">{e.reason ?? <span className="k-fg4">—</span>}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VersionsTable({
  versions,
  currentVersion,
  onRestore,
  disabled,
}: {
  versions: ReturnType<typeof useAuthQuery<DistryVersion[]>>;
  currentVersion: number | undefined;
  onRestore: (v: number) => void;
  disabled: boolean;
}) {
  if (versions.isError) {
    console.error("[dashboard] distry: versions read failed", versions.error);
    return (
      <div className="k-card">
        <EmptyNote>Could not read Distry's versions from production.</EmptyNote>
      </div>
    );
  }
  return (
    <>
      <SectionTitle count={versions.data?.length ?? null}>History</SectionTitle>
      <div className="k-card overflow-hidden">
        <div className="k-scroll overflow-x-auto">
          <table className="w-full table-fixed text-[13px]">
            <thead>
              <tr className="k-line-subtle border-b text-left">
                <th className="k-label w-[80px] px-3 py-2.5 first:pl-4">Version</th>
                <th className="k-label px-3 py-2.5">Saved by</th>
                <th className="k-label hidden w-[150px] px-3 py-2.5 md:table-cell">When</th>
                <th className="k-label w-[110px] px-3 py-2.5 last:pr-4" />
              </tr>
            </thead>
            <tbody>
              {versions.data === undefined
                ? [0, 1, 2].map((i) => (
                    <tr key={i} className="h-10">
                      <td colSpan={4} className="px-4">
                        <Shimmer className="h-4 w-full" />
                      </td>
                    </tr>
                  ))
                : versions.data.map((v) => (
                    <tr key={v.version} className="k-row k-line-subtle border-b last:border-b-0">
                      <td className="px-3 py-2 tabular-nums first:pl-4">v{v.version}</td>
                      <td className="px-3 py-2">
                        {who(v.editedBy)}
                        {(v.note || v.restoredFrom) && <span className="k-fg3 block text-[12px]">{v.restoredFrom ? `Restored v${v.restoredFrom}` : v.note}</span>}
                      </td>
                      <td className="k-mono k-fg2 hidden px-3 py-2 text-[12px] md:table-cell">{when(v.createdAt)}</td>
                      <td className="px-3 py-2 text-right last:pr-4">
                        {v.version === currentVersion ? (
                          <span className="k-fg3 text-[12px]">Live</span>
                        ) : (
                          <button type="button" className="k-btn-ghost" disabled={disabled} onClick={() => onRestore(v.version)}>
                            Restore
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
