"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollIntervalFor } from "@/lib/query-options";
import {
  ApiError,
  answerRelationshipMerge,
  getRelationshipReview,
  setRelationshipCompany,
  setRelationshipTag,
  undoRelationshipMerge,
  withdrawRelationshipTag,
  type RelationshipCompanyStatement,
} from "@/lib/api";
import {
  addableTags,
  cardTitle,
  channelLabel,
  confidencePct,
  deniedTags,
  mergedByLabel,
  relationshipTagLabel,
  type MergeCard,
  type RelationshipCompany,
  type RelationshipReview,
} from "@/lib/v2/relationships";
import { friendlyDateTime } from "@/lib/friendly-datetime";
import { formatCount } from "@/lib/format-number";
import { V2Page, brandTabs } from "@/components/v2/setup-pages";
import { BrandIdentityTitle } from "@/components/v2/brand-identity-title";
import { EmptyNote, Initials, SectionTitle, Shimmer } from "@/components/v2/ui";
import { v2Href } from "@/lib/v2/routes";

/**
 * People & relationships (RELATIONSHIP-TAGS-1014, owner 2026-10-14): who each person is
 * to the brand. An AI reads each person's whole thread (email, WhatsApp, LinkedIn, signup,
 * payment) and tags them; where it is not sure, it asks here. Three lists, each fixed in
 * one click: two records that may be one person, tags and companies it is not sure about,
 * and everyone already merged and tagged (each merge undoable, each tag removable or
 * addable, the company editable). Every click is the person's word and wins over the AI.
 * Reads and writes are lead-service's, through the gateway; nothing is computed here.
 */

const REVIEW_KEY = (brandId: string) => ["relationshipReview", brandId] as const;
const SETTLED_PAGE = 50;

export function V2RelationshipsPage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const q = useAuthQuery(REVIEW_KEY(brandId), () => getRelationshipReview(brandId), {
    refetchInterval: pollIntervalFor,
  });
  const data = q.data ?? null;

  return (
    <V2Page
      crumbs={[{ label: "Brand", href: v2Href(orgId, brandId, "settings") }, { label: "Relationships" }]}
      title={<BrandIdentityTitle brandId={brandId} />}
      sub="Who each person is to your brand. Check what the AI was not sure about."
      tabs={brandTabs(orgId, brandId, "relationships")}
    >
      {!q.isFetchedAfterMount && !data ? (
        <ReviewShimmer />
      ) : !data ? (
        <div className="k-card">
          <EmptyNote>We could not load your people right now. Retrying.</EmptyNote>
        </div>
      ) : (
        <RelationshipReviewBody brandId={brandId} review={data} />
      )}
    </V2Page>
  );
}

/** What one click is doing: the key of the item, so only its row waits. */
type Busy = string | null;

function useReviewWrite(brandId: string) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<{ key: string; text: string } | null>(null);
  // The answered item leaves the list at once and stays gone until the re-read lands.
  const [done, setDone] = useState<Set<string>>(new Set());
  const run = async (key: string, write: () => Promise<unknown>, opts?: { hide?: boolean }) => {
    setBusy(key);
    setError(null);
    try {
      await write();
    } catch (err) {
      console.error("[relationships] write refused", { brandId, key, err });
      setError({ key, text: writeErrorText(err) });
      setBusy(null);
      return;
    }
    if (opts?.hide) setDone((d) => new Set(d).add(key));
    try {
      await qc.refetchQueries({ queryKey: REVIEW_KEY(brandId) });
    } finally {
      setBusy(null);
    }
  };
  return { busy, error, done, run };
}

/** Our words for a refusal, by status (never the producer's message verbatim). */
function writeErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) return "Already answered. The list is refreshing.";
    if (err.status === 409) return "We could not merge these two. Try again in a minute.";
    if (err.status === 400) return "That was not accepted. Check it and try again.";
  }
  return "Not saved. Try again.";
}

export function RelationshipReviewBody({ brandId, review }: { brandId: string; review: RelationshipReview }) {
  const w = useReviewWrite(brandId);
  const merges = review.mergeQuestions.filter((m) => !w.done.has(`merge:${m.id}`));
  const tags = review.tagQuestions.filter((t) => !w.done.has(`tag:${t.humanId}:${t.tag}`));
  const companies = review.companyQuestions.filter((c) => !w.done.has(`company:${c.humanId}`));
  const settledMerges = review.settled.merges.filter((m) => !w.done.has(`undo:${m.linkId}`));
  const c = review.counts;
  const open = merges.length + tags.length + companies.length;

  return (
    <div className="space-y-10">
      <p className="k-fg2 text-[13px] tabular-nums">
        {formatCount(c.subjects)} {c.subjects === 1 ? "person" : "people"}, {formatCount(c.judged)} read by the AI.{" "}
        {open === 0 ? "Nothing to check." : `${formatCount(open)} to check.`}
      </p>

      <section>
        <SectionTitle count={merges.length}>Same person?</SectionTitle>
        {merges.length === 0 ? (
          <div className="k-card">
            <EmptyNote>No two records to compare.</EmptyNote>
          </div>
        ) : (
          <div className="space-y-3">
            {merges.map((m) => {
              const key = `merge:${m.id}`;
              return (
                <article key={m.id} className="k-card p-4">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch">
                    <PersonCard card={m.a} />
                    <span className="k-fg3 self-center text-center text-[13px]">=</span>
                    <PersonCard card={m.b} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <p className="k-fg3 min-w-0 basis-full text-[12px] sm:basis-0 sm:flex-1">
                      {[confidencePct(m.confidence), m.reason].filter(Boolean).join(". ")}
                    </p>
                    {w.error?.key === key && <span className="text-[12px] text-[var(--data-rose)]">{w.error.text}</span>}
                    <button
                      type="button"
                      disabled={w.busy !== null}
                      onClick={() => w.run(key, () => answerRelationshipMerge(brandId, m.id, false), { hide: true })}
                      className="k-btn disabled:opacity-60"
                    >
                      <Cross /> Not the same
                    </button>
                    <button
                      type="button"
                      disabled={w.busy !== null}
                      onClick={() => w.run(key, () => answerRelationshipMerge(brandId, m.id, true), { hide: true })}
                      className="k-btn-accent"
                    >
                      <Check /> {w.busy === key ? "Merging..." : "Same person"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionTitle count={tags.length + companies.length}>Not sure</SectionTitle>
        {tags.length + companies.length === 0 ? (
          <div className="k-card">
            <EmptyNote>The AI is sure about everyone.</EmptyNote>
          </div>
        ) : (
          <div className="k-card overflow-hidden">
            <ul>
              {tags.map((t) => {
                const key = `tag:${t.humanId}:${t.tag}`;
                return (
                  <li key={key} className="k-line-subtle flex flex-wrap items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
                    <Initials name={initialsName(t.name)} size={24} round />
                    <span className="min-w-[180px] flex-1">
                      <span className="block truncate text-[13px] font-medium">{t.name ?? "Unnamed person"}</span>
                      <span className="k-fg3 block truncate text-[12px]">
                        {[`${relationshipTagLabel(t.tag)}?`, confidencePct(t.confidence), t.reason].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {w.error?.key === key && <span className="text-[12px] text-[var(--data-rose)]">{w.error.text}</span>}
                    <button
                      type="button"
                      disabled={w.busy !== null}
                      aria-label={`${t.name ?? "This person"} is not ${relationshipTagLabel(t.tag)}`}
                      onClick={() => w.run(key, () => setRelationshipTag(brandId, t.humanId, t.tag, "no"), { hide: true })}
                      className="k-btn disabled:opacity-60"
                    >
                      <Cross /> No
                    </button>
                    <button
                      type="button"
                      disabled={w.busy !== null}
                      aria-label={`${t.name ?? "This person"} is ${relationshipTagLabel(t.tag)}`}
                      onClick={() => w.run(key, () => setRelationshipTag(brandId, t.humanId, t.tag, "yes"), { hide: true })}
                      className="k-btn disabled:opacity-60"
                    >
                      <Check /> {relationshipTagLabel(t.tag)}
                    </button>
                  </li>
                );
              })}
              {companies.map((cq) => {
                const key = `company:${cq.humanId}`;
                return (
                  <li key={key} className="k-line-subtle flex flex-wrap items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
                    <Initials name={initialsName(cq.name)} size={24} round />
                    <span className="min-w-[180px] flex-1">
                      <span className="block truncate text-[13px] font-medium">{cq.name ?? "Unnamed person"}</span>
                      <span className="k-fg3 block truncate text-[12px]">Which company?</span>
                    </span>
                    {w.error?.key === key && <span className="text-[12px] text-[var(--data-rose)]">{w.error.text}</span>}
                    {cq.candidates.map((cand, i) => {
                      const statement: RelationshipCompanyStatement | null = cand.domain
                        ? { domain: cand.domain }
                        : cand.name
                          ? { name: cand.name }
                          : null;
                      if (!statement) return null;
                      return (
                        <button
                          key={`${cand.domain ?? cand.name}-${i}`}
                          type="button"
                          disabled={w.busy !== null}
                          onClick={() => w.run(key, () => setRelationshipCompany(brandId, cq.humanId, statement), { hide: true })}
                          className="k-btn disabled:opacity-60"
                        >
                          {cand.name ?? cand.domain}
                          {cand.name && cand.domain && <span className="k-fg3">{cand.domain}</span>}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      disabled={w.busy !== null}
                      onClick={() => w.run(key, () => setRelationshipCompany(brandId, cq.humanId, { none: true }), { hide: true })}
                      className="k-btn-ghost disabled:opacity-60"
                    >
                      None
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <section>
        <SectionTitle count={settledMerges.length + review.settled.people.length}>Merged and tagged</SectionTitle>
        {settledMerges.length > 0 && (
          <div className="k-card mb-4 overflow-hidden">
            <ul>
              {settledMerges.map((m) => {
                const key = `undo:${m.linkId}`;
                return (
                  <li key={m.linkId} className="k-line-subtle flex flex-wrap items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
                    <span className="min-w-[180px] flex-1 truncate text-[13px]">
                      {m.names.map((n) => n ?? "Unnamed person").join(" = ")}
                    </span>
                    <span className="k-fg3 text-[12px]">{mergedByLabel(m.judgedBy)}</span>
                    {m.at && <span className="k-mono k-fg2 text-[12px]">{friendlyDateTime(m.at)}</span>}
                    {w.error?.key === key && <span className="text-[12px] text-[var(--data-rose)]">{w.error.text}</span>}
                    <button
                      type="button"
                      disabled={w.busy !== null}
                      onClick={() => w.run(key, () => undoRelationshipMerge(brandId, m.linkId), { hide: true })}
                      className="k-btn-ghost h-6 disabled:opacity-60"
                    >
                      {w.busy === key ? "Undoing..." : "Undo"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <SettledPeople brandId={brandId} people={review.settled.people} write={w} />
      </section>
    </div>
  );
}

type Write = ReturnType<typeof useReviewWrite>;

function SettledPeople({
  brandId,
  people,
  write: w,
}: {
  brandId: string;
  people: RelationshipReview["settled"]["people"];
  write: Write;
}) {
  const [shown, setShown] = useState(SETTLED_PAGE);
  if (people.length === 0) {
    return (
      <div className="k-card">
        <EmptyNote>Nobody tagged yet. The AI tags people as it reads their messages.</EmptyNote>
      </div>
    );
  }
  const rows = people.slice(0, shown);
  return (
    <div className="k-card overflow-hidden">
      <div className="k-scroll overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="k-line-subtle border-b text-left">
              <th className="k-label px-3 py-2.5 font-normal first:pl-4">Person</th>
              <th className="k-label px-3 py-2.5 font-normal">Company</th>
              <th className="k-label px-3 py-2.5 font-normal last:pr-4">Who they are</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const denied = deniedTags(p.details).filter((t) => !p.tags.includes(t));
              const tagKey = (t: string) => `ptag:${p.humanId}:${t}`;
              return (
                <tr key={p.humanId} className="k-row k-line-subtle border-b last:border-b-0">
                  <td className="px-3 py-2 align-top first:pl-4">
                    <span className="flex min-w-0 items-center gap-2">
                      <Initials name={initialsName(p.name)} size={20} round />
                      <span className="truncate font-medium">{p.name ?? "Unnamed person"}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <CompanyField
                      company={p.company}
                      busy={w.busy === `pcompany:${p.humanId}`}
                      error={w.error?.key === `pcompany:${p.humanId}` ? w.error.text : null}
                      onSave={(statement) => w.run(`pcompany:${p.humanId}`, () => setRelationshipCompany(brandId, p.humanId, statement))}
                    />
                  </td>
                  <td className="px-3 py-2 align-top last:pr-4">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {p.tags.map((t) => (
                        <span key={t} className="k-chip" style={{ paddingRight: 2 }}>
                          {relationshipTagLabel(t)}
                          <button
                            type="button"
                            disabled={w.busy !== null}
                            aria-label={`Remove ${relationshipTagLabel(t)} from ${p.name ?? "this person"}`}
                            onClick={() => w.run(tagKey(t), () => setRelationshipTag(brandId, p.humanId, t, "no"))}
                            className="k-fg3 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-[var(--bg-hover)] hover:text-[var(--fg-1)] disabled:opacity-60"
                          >
                            <svg width="8" height="8" viewBox="0 0 12 12" aria-hidden="true">
                              <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          </button>
                        </span>
                      ))}
                      {denied.map((t) => (
                        <button
                          key={`no-${t}`}
                          type="button"
                          disabled={w.busy !== null}
                          title="You said no. Click to let the AI decide again."
                          onClick={() => w.run(tagKey(t), () => withdrawRelationshipTag(brandId, p.humanId, t))}
                          className="k-chip line-through disabled:opacity-60"
                          style={{ color: "var(--fg-4)" }}
                        >
                          {relationshipTagLabel(t)}
                        </button>
                      ))}
                      <AddTag
                        options={addableTags(p.tags)}
                        disabled={w.busy !== null}
                        onPick={(t) => w.run(tagKey(t), () => setRelationshipTag(brandId, p.humanId, t, "yes"))}
                      />
                      {w.error && w.error.key.startsWith(`ptag:${p.humanId}:`) && (
                        <span className="text-[12px] text-[var(--data-rose)]">{w.error.text}</span>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="k-fg3 k-line-subtle flex items-center justify-between border-t px-4 py-2.5 text-[12px] tabular-nums">
        <span>
          {formatCount(rows.length)} of {formatCount(people.length)}
        </span>
        {shown < people.length && (
          <button type="button" onClick={() => setShown((s) => s + SETTLED_PAGE)} className="k-btn-ghost h-6">
            Show {formatCount(Math.min(SETTLED_PAGE, people.length - shown))} more
          </button>
        )}
      </div>
    </div>
  );
}

/** The company reads as text; a click opens it in place, Enter or leaving saves, Esc drops it. */
function CompanyField({
  company,
  busy,
  error,
  onSave,
}: {
  company: RelationshipCompany | null;
  busy: boolean;
  error: string | null;
  onSave: (s: RelationshipCompanyStatement) => Promise<unknown>;
}) {
  const shown = company?.name ?? company?.domain ?? null;
  const [text, setText] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null | undefined>(undefined);
  const commit = async () => {
    if (text === null) return;
    const value = text.trim();
    setText(null);
    if (value === (shown ?? "")) return;
    setPending(value || null);
    // A domain is one word with a dot ("acme.com"); anything else is a name.
    const statement: RelationshipCompanyStatement = !value
      ? { none: true }
      : /^[^\s/]+\.[a-z]{2,}$/i.test(value)
        ? { domain: value.toLowerCase() }
        : { name: value };
    try {
      await onSave(statement);
    } finally {
      setPending(undefined);
    }
  };
  const value = pending !== undefined ? pending : shown;
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      {text !== null ? (
        <input
          autoFocus
          value={text}
          size={1}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit();
            if (e.key === "Escape") setText(null);
          }}
          placeholder="Company or domain"
          className="-mx-1.5 w-full min-w-[160px] rounded-md bg-transparent px-1.5 py-0.5 outline-none"
          style={{ font: "inherit", boxShadow: "inset 0 0 0 1px var(--accent)" }}
        />
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => setText(shown ?? "")}
          className="-mx-1.5 truncate rounded-md px-1.5 py-0.5 text-left hover:bg-[var(--bg-hover)] disabled:opacity-60"
          style={{ boxShadow: "inset 0 0 0 1px transparent" }}
        >
          {value ? <span className="k-fg">{value}</span> : <span className="k-fg4">—</span>}
        </button>
      )}
      {error && <span className="text-[12px] text-[var(--data-rose)]">{error}</span>}
    </span>
  );
}

/** "+ Tag": a menu of every tag the person does not have yet. */
function AddTag({ options, disabled, onPick }: { options: string[]; disabled: boolean; onPick: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById("v2-portal") ?? document.body), []);
  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 208)) });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);
  if (options.length === 0) return null;
  return (
    <>
      <button
        ref={btn}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="k-btn-ghost h-6 px-1.5 text-[12px] disabled:opacity-60"
      >
        + Tag
      </button>
      {open &&
        host &&
        pos &&
        createPortal(
          <div ref={menu} role="menu" className="k-popover fixed z-[90] w-[200px] p-1" style={{ top: pos.top, left: pos.left }}>
            {options.map((t) => (
              <button
                key={t}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onPick(t);
                }}
                className="k-fg2 k-hover flex h-8 w-full items-center rounded-lg px-2 text-left text-[13px]"
              >
                {relationshipTagLabel(t)}
              </button>
            ))}
          </div>,
          host,
        )}
    </>
  );
}

/** Initials from the words of a name, never its punctuation ("Yulia (WA)" reads YW, not "Y("). */
function initialsName(name: string | null): string {
  return (name ?? "").replace(/[^\p{L}\p{N}\s]/gu, " ").trim() || "?";
}

/** One side of a "same person?" question: name, every address, where we know them from. */
function PersonCard({ card }: { card: MergeCard }) {
  const title = cardTitle(card);
  const lines = [...card.emails, ...card.phones].filter((x) => x !== title);
  return (
    <div className="k-inset min-w-0 rounded-[8px] p-3">
      <div className="flex min-w-0 items-center gap-2">
        <Initials name={initialsName(title)} size={28} round />
        <span className="truncate text-[14px] font-medium">{title}</span>
      </div>
      {lines.length > 0 && (
        <ul className="k-fg2 mt-2 space-y-0.5 text-[12px]">
          {lines.slice(0, 4).map((l) => (
            <li key={l} className="truncate">
              {l}
            </li>
          ))}
          {lines.length > 4 && <li className="k-fg3">+{lines.length - 4} more</li>}
        </ul>
      )}
      {card.channels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {card.channels.map((c) => (
            <span key={c} className="k-chip">
              {channelLabel(c)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Cross() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ReviewShimmer() {
  return (
    <div className="space-y-6">
      <Shimmer className="h-5 w-64" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <Shimmer className="h-5 w-40" />
          <Shimmer className="h-10 w-full" />
          <Shimmer className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}
