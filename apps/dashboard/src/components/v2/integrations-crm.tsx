"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getCrmPipeline, listCrmConnections, listCrmContacts, type CrmConnection } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { friendlyDateTime } from "@/lib/friendly-datetime";
import { formatCount } from "@/lib/format-number";
import { v2Href } from "@/lib/v2/routes";
import {
  contactCompanyName,
  contactIdentity,
  contactPlace,
  contactTags,
  filterContacts,
  formatAmount,
  type CrmContact,
  type CrmOpportunity,
  type CrmPipelineRead,
} from "@/lib/crm-view";
import { EmptyNote, Initials, SectionTitle, Shimmer } from "@/components/v2/ui";

import { RecordsToolbar, REC_TH, useRowKeys } from "@/components/v2/records";

/** A section title's quiet count, grouped the way every other figure on the page is. */
export function Count({ n }: { n: number | null | undefined }) {
  return n == null ? null : <span className="k-fg3 ml-1.5 font-normal tabular-nums">{formatCount(n)}</span>;
}

/** How many contacts one page of the contacts read holds (the v1 page's own figure). */
export const V2_CRM_CONTACTS_PAGE = 200;

/**
 * "Your CRM" in the v2 frame: the client's own CRM, read-only.
 *
 * Same reads and the same query keys as the v1 page (`crmConnections`, `crmContacts`,
 * `crmPipeline`), so the two dedupe and paint from the same persisted cache. Only the
 * markup is Keel's. Everything here belongs to the CLIENT, so nothing is a metric of
 * ours, nothing is re-derived from what crm-service serves (the pipeline's grouping,
 * stage order, counts and totals are its own), and nothing writes back: no service
 * between here and their CRM has a write path to it, so a deal is looked at, never
 * dragged.
 */
export function V2CrmRawView({ orgId, brandId }: { orgId: string; brandId: string }) {
  const isBeta = useIsBetaUser();
  const connQ = useAuthQuery(["crmConnections", brandId], () => listCrmConnections(brandId), { enabled: isBeta });
  const connection = connQ.data?.connections[0] ?? null;
  const live = Boolean(connection);
  const contactsQ = useAuthQuery(
    ["crmContacts", brandId],
    () => listCrmContacts(brandId, { limit: V2_CRM_CONTACTS_PAGE }),
    { enabled: isBeta && live },
  );
  const pipelineQ = useAuthQuery(["crmPipeline", brandId], () => getCrmPipeline(brandId), {
    enabled: isBeta && live,
  });

  if (!isBeta) {
    return (
      <div className="k-card">
        <EmptyNote>This page is still in beta and is not open on your account yet.</EmptyNote>
      </div>
    );
  }

  const settingsHref = `${v2Href(orgId, brandId, "settings")}#integrations`;
  // Answered once (success or failure) — a poll on a failed read must not repaint a skeleton.
  if (!connQ.isFetchedAfterMount && !connQ.data) return <KpiShimmer cells={4} />;
  if (!connection) return <NotConnected settingsHref={settingsHref} errored={connQ.isError} />;

  const contacts = contactsQ.data?.contacts ?? null;
  return (
    <div className="space-y-8">
      <ConnectionStrip
        connection={connection}
        settingsHref={settingsHref}
        deals={pipelineQ.data?.totalOpportunities ?? null}
        contacts={contacts ? contacts.length : null}
        contactsCapped={contacts ? contacts.length === V2_CRM_CONTACTS_PAGE : false}
      />

      <section>
        <SectionTitle right="Read from your CRM, never written back">
          Pipeline<Count n={pipelineQ.data?.totalOpportunities} />
        </SectionTitle>
        {pipelineQ.data ? (
          <PipelineBoard view={pipelineQ.data} />
        ) : pipelineQ.isFetchedAfterMount || pipelineQ.isError ? (
          <div className="k-card"><EmptyNote>We could not read your pipeline just now. It should come back on its own.</EmptyNote></div>
        ) : (
          <div className="flex gap-3">{[0, 1, 2].map((i) => <Shimmer key={i} className="h-40 flex-1 rounded-[12px]" />)}</div>
        )}
      </section>

      <section>
        <SectionTitle
          right={contacts && contacts.length === V2_CRM_CONTACTS_PAGE ? `showing the first ${V2_CRM_CONTACTS_PAGE}` : undefined}
        >
          Contacts<Count n={contacts?.length} />
        </SectionTitle>
        {contacts ? (
          <ContactsTable contacts={contacts} />
        ) : contactsQ.isFetchedAfterMount || contactsQ.isError ? (
          <div className="k-card"><EmptyNote>We could not read your contacts just now. It should come back on its own.</EmptyNote></div>
        ) : (
          <div className="k-card overflow-hidden">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="k-row flex h-10 items-center px-4"><Shimmer className="h-4 w-full" /></div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Connection ─────────────────────────────────────────────────────────────

/** One cell of a Keel KPI strip: a mono label over a 22px figure, a quiet note under it. */
export function KpiCell({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="min-w-0 bg-[var(--bg-raised)] px-4 py-3">
      <p className="k-label truncate">{label}</p>
      <div className="mt-1 truncate text-[22px] font-medium leading-7 tracking-[-0.02em] tabular-nums">{value}</div>
      {note != null && <p className="k-fg3 mt-0.5 truncate text-[12px]">{note}</p>}
    </div>
  );
}

export function KpiShimmer({ cells }: { cells: number }) {
  return (
    <div className="k-card grid grid-cols-2 gap-px overflow-hidden bg-[var(--line-subtle)] md:grid-cols-4">
      {Array.from({ length: cells }, (_, i) => (
        <div key={i} className="bg-[var(--bg-raised)] px-4 py-3">
          <Shimmer className="h-3 w-20" />
          <Shimmer className="mt-2 h-6 w-14" />
        </div>
      ))}
    </div>
  );
}

/** A dot plus a capitalised word, in a data colour. */
export function ToneDot({ color, label, hollow }: { color: string; label: string; hollow?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] text-[var(--fg-2)]">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={hollow ? { border: `1.5px solid ${color}` } : { background: color }}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}

function ConnectionStrip({
  connection,
  settingsHref,
  deals,
  contacts,
  contactsCapped,
}: {
  connection: CrmConnection;
  settingsHref: string;
  deals: number | null;
  contacts: number | null;
  contactsCapped: boolean;
}) {
  const paused = connection.status !== "active";
  const state = connection.lastError ? "Needs attention" : paused ? "Paused" : "Connected";
  const color = connection.lastError ? "var(--data-amber)" : paused ? "var(--fg-3)" : "var(--data-teal)";
  return (
    <div>
      <div className="k-card grid grid-cols-2 gap-px overflow-hidden bg-[var(--line-subtle)] md:grid-cols-4">
        <KpiCell
          label="Connection"
          value={
            <span className="inline-flex items-center gap-2 text-[16px]">
              <span className="h-2 w-2 rounded-full" style={paused && !connection.lastError ? { border: `1.5px solid ${color}` } : { background: color }} />
              {state}
            </span>
          }
          note={
            <Link href={settingsHref} className="text-[var(--accent-text)] hover:underline">
              Manage
            </Link>
          }
        />
        <KpiCell
          label="Last read"
          value={
            <span className="k-mono text-[14px]">
              {connection.synced && connection.lastSyncedAt ? friendlyDateTime(connection.lastSyncedAt) : "Waiting"}
            </span>
          }
          note={connection.synced && connection.lastSyncedAt ? "Read on our side, on a schedule" : "Waiting for the first read"}
        />
        <KpiCell label="Deals" value={deals == null ? <span className="k-fg4">—</span> : formatCount(deals)} note="In your pipelines" />
        <KpiCell
          label="Contacts"
          value={contacts == null ? <span className="k-fg4">—</span> : formatCount(contacts)}
          note={contactsCapped ? `The first ${V2_CRM_CONTACTS_PAGE} loaded` : "Loaded here"}
        />
      </div>
      {connection.lastError ? (
        <p className="mt-2 text-[12px] text-[var(--data-amber)]">{connection.lastError}</p>
      ) : null}
    </div>
  );
}

function NotConnected({ settingsHref, errored }: { settingsHref: string; errored: boolean }) {
  return (
    <div className="k-card p-5">
      {errored ? (
        // "We could not check" is not "nothing is connected": saying the second would
        // tell a connected customer their CRM had been dropped.
        <p className="k-fg2 text-[13px]">We could not check your connection just now. It should come back on its own.</p>
      ) : (
        <>
          <p className="text-[13px] font-medium">Connect your CRM to read your contacts and your sales pipeline here.</p>
          <p className="k-fg2 mt-1 text-[13px]">Nothing on this page is written back to your CRM. It is read-only.</p>
          <Link href={settingsHref} className="k-btn-accent mt-4 inline-flex">
            Connect your CRM
          </Link>
        </>
      )}
    </div>
  );
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

/**
 * The client's pipeline as their own system lays it out. Grouping, stage order, the
 * per-stage `count` and `totalValue` are crm-service's; this renders them and computes
 * none. READ-ONLY by construction: no card is draggable, because moving it would state
 * a change their system never made. No currency is mirrored, so amounts carry no symbol.
 */
function PipelineBoard({ view }: { view: CrmPipelineRead }) {
  if (view.totalOpportunities === 0) {
    return <div className="k-card"><EmptyNote>No deals in your pipeline yet.</EmptyNote></div>;
  }
  return (
    <div className="space-y-6">
      {view.pipelines.map((pipeline) => {
        const total = formatAmount(pipeline.totalValue);
        return (
          <div key={pipeline.id}>
            <div className="mb-2 flex items-baseline gap-2">
              <h3 className="text-[13px] font-medium">{pipeline.name}</h3>
              <span className="k-fg3 text-[12px] tabular-nums">
                {formatCount(pipeline.count)} {pipeline.count === 1 ? "deal" : "deals"}
                {total ? ` · ${total}` : ""}
              </span>
            </div>
            {/* The rail scrolls rather than crushing: how many stages a pipeline has is
                the client's decision, not something a breakpoint can know. */}
            <div className="k-scroll flex gap-4 overflow-x-auto pb-2">
              {pipeline.stages.map((stage) => {
                const value = formatAmount(stage.totalValue);
                return (
                  <section key={stage.id} className="flex w-[240px] min-w-[208px] shrink-0 flex-col md:flex-1 md:basis-0">
                    <header className="flex h-7 items-center gap-2 px-0.5">
                      <span className="h-2 w-2 shrink-0 rounded-[2px] bg-[var(--accent)]" />
                      <span className="min-w-0 truncate text-[13px] font-medium">{(stage.name ?? "").trim() || "Unnamed stage"}</span>
                      {/* Served by crm-service, not a count of the cards below. */}
                      <span className="k-fg3 text-[13px] tabular-nums">{formatCount(stage.count)}</span>
                      {value ? <span className="k-fg2 ml-auto shrink-0 text-[12px] tabular-nums">{value}</span> : null}
                    </header>
                    {/* The stage's share of the pipeline's deals, both counts crm-service's. */}
                    <div className="mb-3 mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--data-track)]">
                      <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pipeline.count ? Math.round((stage.count / pipeline.count) * 100) : 0}%` }} />
                    </div>
                    <div className="flex flex-col gap-2">
                      {stage.opportunities.map((o) => (
                        <DealCard key={o.id} deal={o} />
                      ))}
                      {stage.opportunities.length === 0 ? <p className="k-fg4 px-1 py-2 text-[12px]">Nothing here</p> : null}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        );
      })}
      {/* Deals their system put in a pipeline we have not mirrored: shown rather than
          dropped, so the counts here add up to what they see in their own CRM. */}
      {view.ungrouped.length > 0 ? (
        <div>
          <div className="mb-2 flex items-baseline gap-2">
            <h3 className="text-[13px] font-medium">Not in a pipeline</h3>
            <span className="k-fg3 text-[12px]">In your CRM but in none of the pipelines above</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {view.ungrouped.map((o) => (
              <DealCard key={o.id} deal={o} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DealCard({ deal }: { deal: CrmOpportunity }) {
  const amount = formatAmount(deal.monetaryValue);
  const who = (deal.contactName ?? "").trim();
  const title = deal.name.trim() || who || "Untitled deal";
  return (
    <div className="k-card p-3">
      <div className="flex items-center gap-2">
        <Initials name={title} size={18} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{title}</span>
        {amount ? <span className="shrink-0 text-[13px] font-medium tabular-nums">{amount}</span> : null}
      </div>
      {who && title !== who ? <div className="k-fg2 mt-1.5 truncate text-[12px]">{who}</div> : null}
    </div>
  );
}

// ─── Contacts ───────────────────────────────────────────────────────────────

/**
 * Their contacts, one page. The search is LOCAL to the rows in hand and the footer says
 * so, so nobody reads "no match" as "this person is not in my CRM". Company is a column
 * because for most of these people it is the only signal beyond a name.
 */
function ContactsTable({ contacts }: { contacts: CrmContact[] }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [cursor, setCursor] = useState(-1);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const rows = filterContacts(contacts, query);
  useEffect(() => setCursor(-1), [query]);
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));
  useRowKeys({ count: rows.length, cursor, setCursor, onOpen: (i) => rows[i] && toggle(rows[i].id), searchRef });

  return (
    <div className="k-card overflow-hidden">
      <div className="border-b border-[var(--line-subtle)]">
        <RecordsToolbar search={query} onSearch={setQuery} placeholder="Search these contacts" inputRef={searchRef} />
      </div>
      <div className="k-scroll overflow-x-auto">
        <table className="w-full table-fixed text-[13px] md:min-w-[820px] md:table-auto">
          <thead>
            <tr>
              <th className={`${REC_TH} w-[55%] pl-4 md:w-auto`}>Name</th>
              <th className={`${REC_TH} hidden md:table-cell`}>Company</th>
              <th className={`${REC_TH} w-[45%] md:w-auto`}>Email</th>
              <th className={`${REC_TH} hidden md:table-cell`}>Phone</th>
              <th className={`${REC_TH} hidden w-10 pr-4 md:table-cell`}><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyNote>{query.trim() ? "No contact here matches that." : "No contacts yet."}</EmptyNote>
                </td>
              </tr>
            ) : (
              rows.map((c, i) => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  open={openId === c.id}
                  cursor={i === cursor}
                  onHover={() => setCursor(i)}
                  onToggle={() => toggle(c.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="k-fg3 flex items-center gap-4 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px] tabular-nums">
        <span className="min-w-0 truncate">
          {query.trim() ? `${formatCount(rows.length)} of ${formatCount(contacts.length)} loaded contacts` : `${formatCount(contacts.length)} contacts`}
        </span>
        <span className="ml-auto hidden items-center gap-1 md:inline-flex">
          <span className="k-kbd">J</span><span className="k-kbd">K</span> move <span className="k-kbd">↵</span> open
        </span>
      </div>
    </div>
  );
}

function Missing() {
  return <span className="k-fg4">—</span>;
}

function ContactRow({
  contact,
  open,
  cursor,
  onHover,
  onToggle,
}: {
  contact: CrmContact;
  open: boolean;
  cursor: boolean;
  onHover: () => void;
  onToggle: () => void;
}) {
  const who = contactIdentity(contact);
  const company = contactCompanyName(contact);
  const showFoldedPhone = who.source !== "phone";
  return (
    <>
      <tr
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onMouseEnter={onHover}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className={`group k-row h-10 cursor-pointer outline-none ${open || cursor ? "k-selected" : ""}`}
      >
        <td className="px-3 pl-4">
          <span className="flex min-w-0 items-center gap-2">
            <Initials name={who.label} size={18} round />
            <span className="min-w-0 truncate font-medium">{who.label}</span>
          </span>
          {/* Folded below `md`, where each has its own column; the phone is dropped when it
              is already what names this person, so one row never states one value twice. */}
          {(company || (showFoldedPhone && contact.phoneE164)) && (
            <span className="k-fg3 block truncate pl-[26px] text-[12px] md:hidden">
              {[company, showFoldedPhone ? contact.phoneE164 : null].filter(Boolean).join(" · ")}
            </span>
          )}
        </td>
        <td className="hidden truncate px-3 md:table-cell">{company ?? <Missing />}</td>
        <td className="k-fg2 truncate px-3">{(contact.primaryEmail ?? "").trim() || <Missing />}</td>
        <td className="k-mono k-fg2 hidden px-3 text-[12px] md:table-cell">{(contact.phoneE164 ?? "").trim() || <Missing />}</td>
        <td className="hidden pr-4 text-right md:table-cell">
          <span className={`k-btn-ghost inline-flex h-6 w-6 justify-center px-0 ${open || cursor ? "" : "opacity-0 group-hover:opacity-100"}`}>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={open ? "rotate-90" : ""}>
              <path d="M4.5 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={5} className="border-b border-[var(--line-subtle)] p-0">
            <ContactDetail contact={contact} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

/**
 * Everything their CRM holds about one person, in crm-service's own three groups, so a
 * person can decide whether this contact and one of our leads are the same human. Their
 * free text (`type`, `leadSource`, tags) stays their words.
 */
function ContactDetail({ contact }: { contact: CrmContact }) {
  const tags = contactTags(contact);
  return (
    <div className="k-inset grid gap-6 px-4 py-4 md:grid-cols-3">
      <DetailGroup title="Company">
        <DetailField label="Name" value={contact.company.name} />
        <DetailField label="Website" value={contact.company.website} href={contact.company.website} />
      </DetailGroup>
      <DetailGroup title="Where they are">
        <DetailField label="Place" value={contactPlace(contact)} />
        <DetailField label="Street" value={contact.location.streetAddress} />
        <DetailField label="Postal code" value={contact.location.postalCode} />
      </DetailGroup>
      <DetailGroup title="Where the record came from">
        <DetailField label="Type" value={contact.record.type} />
        <DetailField label="Lead source" value={contact.record.leadSource} />
        <DetailField label="Origin" value={contact.record.origin.medium} />
        <DetailField label="Origin page" value={contact.record.origin.url} href={contact.record.origin.url} />
        <DetailField label="Referrer" value={contact.record.origin.referrer} />
        <DetailField label="Added to their CRM" value={contact.record.createdAt ? friendlyDateTime(contact.record.createdAt) : null} />
        <DetailField label="Last changed there" value={contact.record.updatedAt ? friendlyDateTime(contact.record.updatedAt) : null} />
        <div className="min-w-0">
          <dt className="k-fg3 text-[12px]">Tags</dt>
          <dd className="mt-1">
            {tags.length ? (
              <span className="flex flex-wrap gap-1">
                {tags.map((t) => (
                  <span key={t} className="k-chip">{t}</span>
                ))}
              </span>
            ) : (
              <span className="k-fg4 text-[13px]">None</span>
            )}
          </dd>
        </div>
      </DetailGroup>
    </div>
  );
}

function DetailGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="k-label mb-2">{title}</p>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  );
}

/**
 * One value their CRM either holds or does not. An absent value says so in words: "their
 * CRM does not hold this" and "we could not read it" are different statements. Only
 * http(s) is ever a link — another scheme in an anchor is their data deciding a click.
 */
function DetailField({ label, value, href }: { label: string; value: string | null; href?: string | null }) {
  const v = (value ?? "").trim();
  const link = (href ?? "").trim();
  const linkable = /^https?:\/\//i.test(link);
  return (
    <div className="min-w-0">
      <dt className="k-fg3 text-[12px]">{label}</dt>
      <dd className="truncate text-[13px]">
        {!v ? (
          <span className="k-fg4">Not in their CRM</span>
        ) : linkable ? (
          <a href={link} target="_blank" rel="noreferrer noopener" className="text-[var(--accent-text)] hover:underline">
            {v}
          </a>
        ) : (
          v
        )}
      </dd>
    </div>
  );
}
