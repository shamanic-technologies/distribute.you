"use client";

import Link from "next/link";
import { MaturityViewSameNote, MaturityViewSwitch } from "@/components/v2/maturity-view-switch";
import { createContext, useContext, useEffect } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { ApiError, getStaffAbsorbedCosts, getStaffCustomerHealth, getStaffCostMargin, getStaffCurrentPrices, getStaffSkills, getStaffEmailSendPrice, getStaffEmailsSent, getStaffPriceVersions, getStaffRealCosts, getStaffSubscriptionCosts } from "@/lib/api";
import { formatCentsAsUsd } from "@/lib/format-number";
import { v2Href } from "@/lib/v2/routes";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile, TopBar } from "@/components/v2/ui";
import { ProvidersTable } from "@/components/v2/monitoring-providers";
import { EmailsCharts, SentPerDayChart } from "@/components/v2/monitoring-emails";
import { AccountsPage, DomainsPage, InboxProvidersPage, LatestEmails, MailboxesPage, SendingHealthTiles, shortDay, useSendingVerdict } from "@/components/v2/monitoring-sending";
import { CapacityPlanChart, EntityPage, PlacementTestPage, PlacementTestsPage, QueuedPage, WarmupPage, entityTitle } from "@/components/v2/monitoring-drilldown";
import { HubChip, HubChips, HubSectionBlock, useOpenSections } from "@/components/v2/hub-section";
import { EmailPriceView } from "@/components/v2/monitoring-email-price";
import { BillingTable } from "@/components/v2/monitoring-billing";
import { SubscriptionsView } from "@/components/v2/monitoring-subscriptions";
import { AbsorbedView } from "@/components/v2/monitoring-absorbed";
import { AccountsView } from "@/components/v2/monitoring-accounts";
import { NewPricingView } from "@/components/v2/monitoring-new-pricing";
import { PricingBasisView } from "@/components/v2/monitoring-pricing-basis";
import { PricingComparisonView } from "@/components/v2/monitoring-pricing-comparison";
import { ReceiptIcon } from "@phosphor-icons/react/dist/csr/Receipt";
import { TagIcon } from "@phosphor-icons/react/dist/csr/Tag";
import { TrendUpIcon } from "@phosphor-icons/react/dist/csr/TrendUp";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/csr/ChatCircle";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { SkillsView } from "@/components/v2/monitoring-skills";
import { CapacityPage, RulesPage } from "@/components/v2/monitoring-capacity";
import { BlocklistsPage } from "@/components/v2/monitoring-blocklists";
import { ThreadsPage } from "@/components/v2/monitoring-threads";
import { WhatsappLinesPage, WhatsappLinesTile, useWhatsappLines } from "@/components/v2/monitoring-whatsapp";
import { SophieRepliesChart, SophieRepliesPage, SophieRepliesTile, useSophieReplies } from "@/components/v2/monitoring-sophie";
import { recentNotDelivered } from "@/lib/monitoring/sophie-replies";
import { WhatsappLogoIcon } from "@phosphor-icons/react/dist/csr/WhatsappLogo";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { SecurityAdvisoriesPage, SecurityAdvisoriesTile, useSecurityAdvisories } from "@/components/v2/monitoring-security";
import { CpuIcon } from "@phosphor-icons/react/dist/csr/Cpu";
import { BoxHealthPage, BoxHealthTile, useBoxHealth } from "@/components/v2/monitoring-box";
import { BoxChecksPage, BoxChecksTile, useBoxChecks } from "@/components/v2/monitoring-watchdogs";
import { LightningIcon } from "@phosphor-icons/react/dist/csr/Lightning";
import { TriggerReportsPage, TriggerReportsTile, useTriggerReports } from "@/components/v2/monitoring-triggers";
import { triggerName } from "@/lib/monitoring/trigger-reports";
import { ProspectsWaitingPage, ProspectsWaitingTile, useStuckOccurrences } from "@/components/v2/monitoring-waiting";
import { longestWaitIsRed, waitLabel } from "@/lib/monitoring/stuck-occurrences";
import { TriggerHealthPage, TriggerHealthTile, useTriggerHealth } from "@/components/v2/monitoring-trigger-health";
import { redTriggers, watchedTriggers } from "@/lib/monitoring/trigger-health";
import { RobotIcon } from "@phosphor-icons/react/dist/csr/Robot";
import { VendorCreditPage, VendorCreditTile, useVendorCredit } from "@/components/v2/monitoring-vendor-credit";
import { outOfCreditVendors } from "@/lib/monitoring/vendor-credit";
import { UnsentAnswersPage, UnsentAnswersTile, useUnsentAnswers } from "@/components/v2/monitoring-unsent-answers";
import { PlugsConnectedIcon } from "@phosphor-icons/react/dist/csr/PlugsConnected";
import { ConnectorIntakePage, ConnectorIntakeTile, useConnectorIntake } from "@/components/v2/monitoring-connectors";
import { connectionName, redConnections } from "@/lib/monitoring/connector-intake";
import { StrategyIcon } from "@phosphor-icons/react/dist/csr/Strategy";
import { FactoryShadowPage, FactoryShadowTile, PlanFollowingPage, PlanFollowingTile, useFactoryShadowMonitoring, usePlanFollowing } from "@/components/v2/monitoring-factory";
import { planStateWords } from "@/lib/plan-following";
import { CodeIcon } from "@phosphor-icons/react/dist/csr/Code";
import { ScriptsPage, ScriptsTile, useScriptsMonitoring } from "@/components/v2/monitoring-scripts";
import { brokenOutcomes, guardStateWords, outcomeName } from "@/lib/monitoring/scripts-monitoring";
import { verdictReasonWords } from "@/lib/factory-shadow";
import { loadLabel, memLabel } from "@/lib/monitoring/box-health";
import { ScalesIcon } from "@phosphor-icons/react/dist/csr/Scales";
import { LedgerCheckPage, LedgerCheckTile, OutcomeCoveragePage, OutcomeCoverageTile, ReconciliationPage, ReconciliationTile, useLedgerCheck, useLedgerReconciliation, useOutcomeCoverage } from "@/components/v2/monitoring-cost-ledger";
import { belowTarget, headlinePoint, outcomeShare, serviceNames } from "@/lib/monitoring/cost-ledger";
import { formatRatePct } from "@/lib/pipe-stats";
import { linesDown, linkedLines } from "@/lib/monitoring/whatsapp-lines";
import { DomainsEstate, MailboxesSummary } from "@/components/v2/monitoring-details";
import {
  costItemNames,
  parseMonitoringPath,
  type CostItemMargin,
  type MarginFigures,
  type MonitoringPage,
  type ProviderMargin,
} from "@/lib/monitoring/monitoring";

/**
 * Monitoring (staff only): what the platform cost us, what we billed for it, the margin between
 * the two, and the emails we sent, every org pooled, since inception. Laid out like Research
 * (owner 2026-10-19: Monitoring is the ONE home of our monitoring charts): the sending health
 * first, then groups of collapsible rows, each holding chips and cards leading to one page each.
 *
 * Every figure is served by its owner through the staff-only gateway (see lib/monitoring): the
 * margin is runs-service's, the current price is costs-service's. This file formats and lays
 * out; it never adds, subtracts or divides a money figure.
 */

const ONCE = { staleTime: 5 * 60_000, retry: false } as const;

function useMargin() {
  return useAuthQuery(["staffCostMargin"], getStaffCostMargin, ONCE);
}
function useVersions() {
  return useAuthQuery(["staffPriceVersions"], getStaffPriceVersions, ONCE);
}
function useCurrentPrices() {
  return useAuthQuery(["staffCurrentPrices"], getStaffCurrentPrices, ONCE);
}
function useEmails() {
  return useAuthQuery(["staffEmailsSent"], getStaffEmailsSent, ONCE);
}
function useEmailSendPrice() {
  return useAuthQuery(["staffEmailSendPrice"], getStaffEmailSendPrice, ONCE);
}
function useLatestRealCosts() {
  return useAuthQuery(["staffRealCosts", null], () => getStaffRealCosts(null), ONCE);
}
function useSkills() {
  return useAuthQuery(["staffSkills"], getStaffSkills, { staleTime: 30_000, retry: false });
}
function useAbsorbedCosts() {
  return useAuthQuery(["staffAbsorbedCosts"], getStaffAbsorbedCosts, ONCE);
}
function useSubscriptionCosts() {
  return useAuthQuery(["staffSubscriptionCosts"], getStaffSubscriptionCosts, ONCE);
}

// ─── Formatting only ───────────────────────────────────────────────────────

const usd = (cents: string | number) => formatCentsAsUsd(cents, 0);
const usdExact = (cents: string | number) => formatCentsAsUsd(cents, 2);
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
const providerName = (p: string | null) => p ?? "Unknown provider";
/** A price per email in US cents, "3.06¢"; null stays null (no email yet). */
const centsPerEmail = (c: number | null) => (c == null ? null : `${c.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}¢`);

// ─── Shell ─────────────────────────────────────────────────────────────────

type SectionKey = "cost" | "ledger" | "customers" | "price" | "margin" | "emails" | "whatsapp" | "security" | "box" | "triggers" | "tools" | "factory" | "scripts" | "ai" | "chat";

/** Each section wears one colour and one mark, the way Research's topics do. */
const SECTION_LOOK: Record<SectionKey, { name: string; color: string; Icon: typeof ReceiptIcon; sub: string }> = {
  cost: { name: "Cost", color: "var(--data-rose)", Icon: ReceiptIcon, sub: "What our vendors charged us" },
  ledger: { name: "Cost ledger", color: "var(--data-amber)", Icon: ScalesIcon, sub: "Whether every dollar spent lands on the outcome it produced, to the cent" },
  customers: { name: "Customers", color: "var(--data-lime)", Icon: UsersThreeIcon, sub: "How each account is doing, and what it costs us" },
  price: { name: "Price", color: "var(--data-sky)", Icon: TagIcon, sub: "What we charge our users" },
  margin: { name: "Margin", color: "var(--data-teal)", Icon: TrendUpIcon, sub: "Billed minus what the vendors charged" },
  emails: { name: "Emails", color: "var(--data-violet)", Icon: EnvelopeSimpleIcon, sub: "Inbox placement, mailboxes, domains, and every email we sent" },
  whatsapp: { name: "WhatsApp", color: "var(--data-lime)", Icon: WhatsappLogoIcon, sub: "Whether every linked line can send, and every reply Sophie wrote left" },
  security: { name: "Security", color: "var(--data-rose)", Icon: ShieldCheckIcon, sub: "Whether our prod repos carry open security advisories" },
  box: { name: "Box", color: "var(--data-sky)", Icon: CpuIcon, sub: "Whether the production server is overloaded, and whether its own checks pass" },
  triggers: { name: "Triggers", color: "var(--data-amber)", Icon: LightningIcon, sub: "Whether every trigger still fires, reaches its campaign, and gets its answer" },
  tools: { name: "Connected tools", color: "var(--data-sky)", Icon: PlugsConnectedIcon, sub: "Whether every tool a client connected still brings records in" },
  factory: { name: "Factory plan", color: "var(--data-violet)", Icon: StrategyIcon, sub: "Which client campaigns would run differently if they followed their plan" },
  scripts: { name: "Scripts", color: "var(--data-teal)", Icon: CodeIcon, sub: "Whether each stored script works as well as the code it replaced" },
  ai: { name: "AI vendors", color: "var(--data-violet)", Icon: RobotIcon, sub: "Whether every AI vendor we call still has credit" },
  chat: { name: "Chat", color: "var(--data-amber)", Icon: ChatCircleIcon, sub: "What the Copilot knows" },
};

const PAGE: Record<MonitoringPage, { section: SectionKey; title: string; question: string }> = {
  "cost/providers": { section: "cost", title: "Providers", question: "Which vendors do we pay, and for what?" },
  "cost/spend": { section: "cost", title: "Spend per provider", question: "How much has each provider charged us since inception?" },
  "cost/subscriptions": { section: "cost", title: "Subscriptions", question: "What does one credit of each subscription really cost us?" },
  "cost/email-sending": { section: "cost", title: "Email sending", question: "What does sending one cold email really cost us?" },
  "ledger/coverage": { section: "ledger", title: "Outcome coverage", question: "How much of our spend says which outcome it produced?" },
  "ledger/check": { section: "ledger", title: "To the cent", question: "Does every org-day of the cost ledger balance to the cent?" },
  "ledger/reconciliation": { section: "ledger", title: "Reconciled", question: "Does every dollar spent land in one part, to the cent, every day?" },
  "customers/accounts": { section: "customers", title: "Accounts", question: "How healthy is each customer's account?" },
  "customers/absorbed": { section: "customers", title: "Absorbed", question: "What do our customers cost us that they do not pay?" },
  "price/billed": { section: "price", title: "Billed to users", question: "What did we bill for each cost item, and at what price?" },
  "price/new-pricing": { section: "price", title: "New pricing", question: "What would each cost item cost at its real cost ×2?" },
  "price/pricing-basis": { section: "price", title: "Pricing basis", question: "Which costs are re-billed on an average, and which at list cost?" },
  margin: { section: "margin", title: "Margin", question: "How much margin have we made since inception?" },
  "margin/pricing-comparison": { section: "margin", title: "Pricing comparison", question: "What would a client have paid, and our margin, under two price lists?" },
  emails: { section: "emails", title: "Sent per period", question: "How many emails have we sent since inception?" },
  "emails/inbox-providers": { section: "emails", title: "Inbox providers", question: "Do our emails land in the inbox at Google, Microsoft 365 and Outlook.com?" },
  "emails/domains": { section: "emails", title: "Domains", question: "Which domains do we send from, and how do they land?" },
  "emails/mailboxes": { section: "emails", title: "Mailboxes", question: "Which mailboxes send, how much, and how fast do they ramp up?" },
  "emails/accounts": { section: "emails", title: "Accounts", question: "What does each sending address send, and when is its next test?" },
  "emails/placement-tests": { section: "emails", title: "Placement tests", question: "Where did each placement test land, provider by provider?" },
  "emails/warmup": { section: "emails", title: "Warmup", question: "How much warmup do we send, and how much is planned?" },
  "emails/queued": { section: "emails", title: "Queued sequences", question: "Which steps are queued, and on which planned day?" },
  "emails/capacity": { section: "emails", title: "Capacity", question: "How much can our mailboxes send, how much do they send, and how big is the backlog?" },
  "emails/blocklists": { section: "emails", title: "Blocklists", question: "Is any sending domain on a blocklist, and is its removal on its way?" },
  "emails/threads": { section: "emails", title: "Threads", question: "What did each thread send and receive, and how did it end?" },
  "emails/rules": { section: "emails", title: "Rules", question: "What decides whether an address gets new sequences, and at what limits?" },
  "whatsapp/lines": { section: "whatsapp", title: "Lines", question: "Is every WhatsApp line connected, and since when is one down?" },
  "whatsapp/sophie": { section: "whatsapp", title: "Sophie's replies", question: "Did every WhatsApp reply Sophie wrote reach the person?" },
  "security/advisories": { section: "security", title: "Advisories", question: "Does any prod repo carry an open critical or high advisory?" },
  "box/load": { section: "box", title: "Load and memory", question: "Is the production server overloaded, and which containers eat its CPU and memory?" },
  "box/watchdogs": { section: "box", title: "Watchdogs", question: "Is every check the production server runs on itself passing?" },
  "triggers/reports": { section: "triggers", title: "Reports", question: "Did every form, WhatsApp number, positive reply and account event reach its campaign?" },
  "triggers/waiting": { section: "triggers", title: "Prospects waiting", question: "Is any prospect waiting on a blocked campaign answer?" },
  "triggers/firing": { section: "triggers", title: "Firing", question: "Is any trigger our campaigns wait on broken?" },
  "triggers/unsent": { section: "triggers", title: "Unsent answers", question: "Did anyone who wrote to a brand get no answer?" },
  "tools/intake": { section: "tools", title: "Records taken in", question: "Does every tool a client connected still bring records in?" },
  "factory/plan": { section: "factory", title: "Would change", question: "Which client campaigns would change if they followed their plan?" },
  "factory/following": { section: "factory", title: "Following its plan", question: "Does every campaign switched to its plan actually run it?" },
  "scripts/engines": { section: "scripts", title: "Engines", question: "Does each script work as well as the code it replaced?" },
  "ai/credit": { section: "ai", title: "Credit", question: "Does every AI vendor we call still have credit?" },
  "chat/skills": { section: "chat", title: "Skills", question: "What does the Copilot read before it acts?" },
};

/** A section's mark: a soft tile in its colour, drawn like Research's topic mark. */
function SectionMark({ section, size = 32 }: { section: SectionKey; size?: number }) {
  const { color, Icon } = SECTION_LOOK[section];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[8px]"
      style={{
        width: size,
        height: size,
        color,
        background: `color-mix(in oklab, ${color} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 22%, transparent)`,
      }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.56)} weight="duotone" />
    </span>
  );
}

export function V2Monitoring() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const pathname = usePathname();
  const base = v2Href(orgId, brandId, "monitoring");
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  const view = parseMonitoringPath(rest);
  const router = useRouter();
  const movedTo = view.view === "moved" ? `${base}/${view.page}` : null;
  useEffect(() => {
    if (movedTo) router.replace(movedTo);
  }, [movedTo, router]);
  if (view.view === "moved") return null;
  if (view.view === "hub") return <Hub base={base} />;
  if (view.view === "entity" || view.view === "test") {
    const list = view.view === "test" ? "emails/placement-tests" : view.kind === "account" ? "emails/accounts" : view.kind === "mailbox" ? "emails/mailboxes" : "emails/domains";
    const label = view.view === "test" ? "Placement test" : entityTitle(view.kind);
    const id = view.view === "test" ? view.testId : view.key;
    return (
      <Frame crumbs={[{ label: "Monitoring", href: base }, { label: "Emails" }, { label: PAGE[list].title, href: `${base}/${list}` }, { label: id }]}>
        <div className="flex min-w-0 items-center gap-3">
          <SectionMark section="emails" size={40} />
          <div className="min-w-0">
            <p className="text-[12px]" style={{ color: SECTION_LOOK.emails.color }}>
              {label}
            </p>
            <h1 className="k-mono truncate text-[22px] font-medium leading-[30px] tracking-[-0.01em]">{id}</h1>
          </div>
        </div>
        <div className="mt-4">{view.view === "test" ? <PlacementTestPage base={base} testId={view.testId} /> : <EntityPage base={base} kind={view.kind} id={view.key} />}</div>
      </Frame>
    );
  }
  if (view.view === "missing") {
    return (
      <Frame crumbs={[{ label: "Monitoring", href: base }, { label: "Not found" }]}>
        <div className="k-card">
          <EmptyNote>
            No Monitoring page here.{" "}
            <Link href={base} className="k-fg underline">
              Back to Monitoring
            </Link>
          </EmptyNote>
        </div>
      </Frame>
    );
  }
  const meta = PAGE[view.page];
  const look = SECTION_LOOK[meta.section];
  return (
    <Frame crumbs={[{ label: "Monitoring", href: base }, ...(look.name === meta.title ? [] : [{ label: look.name }]), { label: meta.title }]}>
      <div className="flex min-w-0 items-center gap-3">
        <SectionMark section={meta.section} size={40} />
        <div className="min-w-0">
          <p className="text-[12px]" style={{ color: look.color }}>
            {look.name}
          </p>
          <h1 className="text-[24px] font-medium leading-[30px] tracking-[-0.02em]">{meta.question}</h1>
        </div>
      </div>
      <p className="k-fg3 mt-2 text-[13px]">
        {meta.section === "whatsapp"
          ? "Every org pooled, read live from production. Times are UTC."
          : meta.section === "security"
          ? "Every repo running in prod, audited once a day. Read live from production. Days are UTC."
          : meta.section === "box"
          ? "The production server (every service and Postgres), sampled every 5 minutes. Before 2026-10-26, history comes from sysstat every 10 minutes, without containers. Times are UTC."
          : meta.section === "triggers" || meta.section === "tools" || meta.section === "factory"
          ? "Every org, read live from production. Days are UTC."
          : meta.section === "scripts"
          ? "Every org, read live from production, stored once a day. Days are UTC."
          : meta.section === "ai"
          ? "Every AI vendor chat-service calls, read live from production. Days are UTC."
          : meta.section === "chat"
          ? "Read live from production. Your edits save as you type and reach the Copilot on its next message."
          : meta.section === "ledger"
          ? "Every org pooled, read live from runs-service's stored daily computation. Days are UTC."
          : meta.section === "emails" && view.page !== "emails"
            ? "Every mailbox we send from, read live from production. Times are UTC."
            : "Every org pooled, since the first cost row. Read live from production."}
      </p>
      <div className="mt-6">
        {view.page === "cost/providers" && <ProvidersPage />}
        {view.page === "cost/spend" && <SpendPage />}
        {view.page === "cost/subscriptions" && <SubscriptionsPage />}
        {view.page === "cost/email-sending" && <EmailSendingPage />}
        {view.page === "ledger/coverage" && <OutcomeCoveragePage />}
        {view.page === "ledger/check" && <LedgerCheckPage />}
        {view.page === "ledger/reconciliation" && <ReconciliationPage />}
        {view.page === "customers/accounts" && <CustomerAccountsPage />}
        {view.page === "customers/absorbed" && <AbsorbedPage />}
        {view.page === "price/billed" && <BilledPage />}
        {view.page === "price/new-pricing" && <NewPricingView />}
        {view.page === "price/pricing-basis" && <PricingBasisView />}
        {view.page === "margin/pricing-comparison" && <PricingComparisonView />}
        {view.page === "margin" && <MarginPage />}
        {view.page === "emails" && <EmailsPage />}
        {view.page === "emails/inbox-providers" && <InboxProvidersPage />}
        {view.page === "emails/domains" && (
          <div className="space-y-8">
            <DomainsEstate base={base} />
            <DomainsPage base={base} />
          </div>
        )}
        {view.page === "emails/mailboxes" && (
          <div className="space-y-8">
            <MailboxesSummary />
            <MailboxesPage base={base} />
          </div>
        )}
        {view.page === "emails/accounts" && (
          <AccountsPage
            base={base}
            aside={
              <section>
                <SectionTitle>Capacity vs planned</SectionTitle>
                <CapacityPlanChart scope={{}} lifecycle="in_production" />
              </section>
            }
          />
        )}
        {view.page === "emails/placement-tests" && <PlacementTestsPage base={base} />}
        {view.page === "emails/warmup" && <WarmupPage base={base} />}
        {view.page === "emails/queued" && <QueuedPage base={base} />}
        {view.page === "emails/capacity" && <CapacityPage base={base} />}
        {view.page === "emails/blocklists" && <BlocklistsPage base={base} />}
        {view.page === "emails/threads" && <ThreadsPage base={base} />}
        {view.page === "emails/rules" && <RulesPage base={base} />}
        {view.page === "whatsapp/lines" && <WhatsappLinesPage />}
        {view.page === "whatsapp/sophie" && <SophieRepliesPage />}
        {view.page === "security/advisories" && <SecurityAdvisoriesPage />}
        {view.page === "box/load" && <BoxHealthPage />}
        {view.page === "box/watchdogs" && <BoxChecksPage />}
        {view.page === "triggers/reports" && <TriggerReportsPage />}
        {view.page === "triggers/waiting" && <ProspectsWaitingPage />}
        {view.page === "triggers/firing" && <TriggerHealthPage />}
        {view.page === "triggers/unsent" && <UnsentAnswersPage />}
        {view.page === "tools/intake" && <ConnectorIntakePage />}
        {view.page === "factory/plan" && <FactoryShadowPage />}
        {view.page === "factory/following" && <PlanFollowingPage />}
        {view.page === "scripts/engines" && <ScriptsPage />}
        {view.page === "ai/credit" && <VendorCreditPage />}
        {view.page === "chat/skills" && <SkillsView />}
      </div>
    </Frame>
  );
}

function Frame({ crumbs, children }: { crumbs: { label: string; href?: string }[]; children: React.ReactNode }) {
  return (
    <>
      <TopBar crumbs={crumbs} actions={<MaturityViewSwitch />} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <MaturityViewSameNote />
        {children}
      </div>
    </>
  );
}

/** A read's three states, so no page shows a figure it does not have. */
function Loaded<T>({ q, children }: { q: { data: T | undefined; isError: boolean; error: Error | null }; children: (data: T) => React.ReactNode }) {
  if (q.isError) {
    return (
      <div className="k-card">
        <EmptyNote>Could not read this from production: {q.error?.message ?? "unknown error"}.</EmptyNote>
      </div>
    );
  }
  if (q.data === undefined) {
    return (
      <div className="k-card space-y-2 p-4">
        {[0, 1, 2, 3].map((i) => (
          <Shimmer key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }
  return <>{children(q.data)}</>;
}

// ─── Hub ───────────────────────────────────────────────────────────────────

/** Bars drawn from served figures in the producer's order, in the section's colour. Draws; computes nothing shown. */
function MiniBars({ values, color }: { values: number[]; color: string }) {
  const pts = values.slice(0, 7);
  const max = Math.max(...pts, 0) || 1;
  if (!pts.length) return null;
  return (
    <div className="flex h-5 items-end gap-[3px]" aria-hidden="true">
      {pts.map((v, i) => (
        <span key={i} className="w-[6px] rounded-[2px]" style={{ height: `${Math.max(3, (v / max) * 20)}px`, background: color, opacity: i === 0 ? 1 : 0.4 }} />
      ))}
    </div>
  );
}

/** One cell of a card's inset block: label, figure (or its loading/error state), a note, a viz. */
interface Cell {
  label: string;
  value: React.ReactNode | undefined;
  note?: string;
  bars?: number[];
}

function Hub({ base }: { base: string }) {
  const margin = useMargin();
  const versions = useVersions();
  const prices = useCurrentPrices();
  const emails = useEmails();
  const sendPrice = useEmailSendPrice();
  const subs = useSubscriptionCosts();
  const absorbed = useAbsorbedCosts();
  const ab = absorbed.data?.fleet;
  const real = useLatestRealCosts();
  const skills = useSkills();
  const rc = real.data;
  const sp = sendPrice.data;
  const m = margin.data;
  const t = m?.total;
  const href = (p: MonitoringPage) => `${base}/${p}`;
  // runs-service orders providers by billed, largest first: the bars and "Largest" follow its order.
  const byProvider = (k: keyof MarginFigures) => (m ? m.providers.map((p) => Number(p[k])) : undefined);
  const top = m ? (m.providers[0] ?? null) : undefined;
  const providers = versions.data ? new Set(versions.data.map((v) => v.provider)).size : undefined;
  const items = versions.data ? costItemNames(versions.data).length : undefined;
  const verdict = useSendingVerdict();
  const hub = useOpenSections(OPEN_SECTIONS_KEY);
  const wa = useWhatsappLines();
  const sophie = useSophieReplies();
  const sophieBad = sophie.data ? recentNotDelivered(sophie.data) : undefined;
  const coverage = useOutcomeCoverage();
  const ledger = useLedgerCheck();
  const recon = useLedgerReconciliation();
  const sec = useSecurityAdvisories();
  const box = useBoxHealth();
  const watchdogs = useBoxChecks();
  const trig = useTriggerReports();
  const waiting = useStuckOccurrences();
  const firing = useTriggerHealth();
  const unsent = useUnsentAnswers();
  const tools = useConnectorIntake();
  const factory = useFactoryShadowMonitoring();
  const following = usePlanFollowing();
  const scripts = useScriptsMonitoring();
  const vendors = useVendorCredit();
  const vendorsOut = vendors.data ? outOfCreditVendors(vendors.data) : undefined;
  const scriptsBroken = scripts.data ? brokenOutcomes(scripts.data) : undefined;
  const scriptGuards = scripts.data?.outcomes.flatMap((o) => (o.guard ? [o.guard.state] : [])) ?? [];
  const covAt = coverage.data ? headlinePoint(coverage.data) : undefined;
  return (
    <Frame crumbs={[{ label: "Monitoring" }]}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">{verdict ?? "Monitoring"}</h1>
          <p className="k-fg2 mt-1 text-[14px]">Whether our emails land in the inbox, then what the platform cost us, what we billed for it, and the margin. Every org, since inception.</p>
        </div>
        <span className="k-fg2 inline-flex items-center gap-2 text-[13px]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--data-teal)]" />
          Read live from production
        </span>
      </div>

      {/* The one-second read (owner 2026-10-19): inbox % at Google and Microsoft 365, red under instantly-service's bar. */}
      <div className="mt-6">
        <SendingHealthTiles />
      </div>
      {/* A line down blocks every WhatsApp greeting (owner 2026-10-23): red here IS the alert, outside any collapsed row. */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <WhatsappLinesTile href={href("whatsapp/lines")} />
        {/* A reply Sophie wrote on WhatsApp that never left, today or the 2 days before (SOPHIE-WA-DELIVERY-CHART-1029): red here IS the alert, never an email. */}
        <SophieRepliesTile href={href("whatsapp/sophie")} />
        {/* Every outcome's cost exact to the cent (owner 2026-10-23): red here IS the alert. */}
        <OutcomeCoverageTile href={href("ledger/coverage")} />
        <LedgerCheckTile href={href("ledger/check")} />
        {/* The day it reads Yes, every price reader moves to the ledger (owner 2026-10-24): red here IS the alert. */}
        <ReconciliationTile href={href("ledger/reconciliation")} />
        {/* Open critical/high advisories on a prod repo, or no audit report for 36 h (SEC-ADVISORIES-MONITORING-1025): red here IS the alert. */}
        <SecurityAdvisoriesTile href={href("security/advisories")} />
        {/* Load over 1.5x the cores, under 1 GB free, swap over half full, a memory kill, or no sample for 20 min (BOX-OVERLOAD-1026-MONITORING): red here IS the alert. */}
        <BoxHealthTile href={href("box/load")} />
        {/* A deploy, service, queue, Jev, own-credit or social cron that found a problem or went silent (BOX-WATCHDOGS-1030): red here IS the alert, never an email. */}
        <BoxChecksTile href={href("box/watchdogs")} />
        {/* A form, WhatsApp number, positive reply or account event not sent to its campaign 15 min after we saw it (TRIGGER-REPORTS-MONITORING-1027): red here IS the alert. */}
        <TriggerReportsTile href={href("triggers/reports")} />
        {/* A prospect who acted still waits 30 min later on a blocked campaign answer (REACTIVE-THROUGHPUT-1028): red here IS the alert, never an email. */}
        <ProspectsWaitingTile href={href("triggers/waiting")} />
        {/* A trigger live campaigns wait on that never fired, or whose facts came with no event (TRIGGER-HEALTH-1028): red here IS the alert, never an email. */}
        <TriggerHealthTile href={href("triggers/firing")} />
        {/* A person wrote to a brand and the answer we owed them was refused by the sender or given up after failed runs, in the last 24 h (ONE-AI-REFUSED-ANSWERS-1029): red here IS the alert, never an email. */}
        <UnsentAnswersTile href={href("triggers/unsent")} />
        {/* A tool a client connected that syncs "fine" but takes in nothing for longer than its habit, or whose sync fails (CONNECTOR-INTAKE-MONITORING-1028): red here IS the alert, never an email. */}
        <ConnectorIntakeTile href={href("tools/intake")} />
        {/* The GTM Factory shadow pass failed to judge or plan a live campaign, or stopped running (FACTORY-P1-DASH): red here IS the alert, never an email. */}
        <FactoryShadowTile href={href("factory/plan")} />
        {/* A campaign switched to follow its plan that cannot apply it, or the follower went silent (FACTORY-P1-PLAN-FOLLOWING-DASH): red here IS the alert, never an email. */}
        <PlanFollowingTile href={href("factory/following")} />
        {/* A stored script that fails more often than the code it replaced, or whose guard rolled the fleet back (FACTORY-P3): red here IS the alert, never an email. */}
        <ScriptsTile href={href("scripts/engines")} />
        {/* An AI vendor that refused a call for lack of credit and has not served one since (VENDOR-CREDIT-1030, DeepSeek 2026-10-29): red here IS the alert, never an email. */}
        <VendorCreditTile href={href("ai/credit")} />
      </div>

      <HubOpen.Provider value={hub}>
      <div className="mt-8 space-y-8">
      <div>
      <SectionTitle count={1}>Sending</SectionTitle>
      <Section section="emails" count={12} grid={false}>
        <HubChips>
          <HubChip href={href("emails/inbox-providers")} color="var(--data-violet)" label="Inbox providers" />
          <HubChip href={href("emails/domains")} color="var(--data-sky)" label="Domains" />
          <HubChip href={href("emails/mailboxes")} color="var(--data-teal)" label="Mailboxes" />
          <HubChip href={href("emails/accounts")} color="var(--data-amber)" label="Accounts" />
          <HubChip href={href("emails/placement-tests")} color="var(--data-rose)" label="Placement tests" />
          <HubChip href={href("emails/warmup")} color="var(--data-lime)" label="Warmup" />
          <HubChip href={href("emails/queued")} color="var(--accent)" label="Queued sequences" />
          <HubChip href={href("emails/capacity")} color="var(--data-sky)" label="Capacity" />
          <HubChip href={href("emails/blocklists")} color="var(--data-rose)" label="Blocklists" />
          <HubChip href={href("emails/threads")} color="var(--data-violet)" label="Threads" />
          <HubChip href={href("emails/rules")} color="var(--data-teal)" label="Rules" />
        </HubChips>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Card
            href={href("emails")}
            page="emails"
            error={emails.isError}
            cells={[
              { label: "Emails sent", value: emails.data?.emails.toLocaleString("en-US"), note: "follow-ups included" },
              { label: "People emailed", value: emails.data?.people.toLocaleString("en-US"), note: "at least one email" },
            ]}
          />
        </div>
        <div className="mt-6">
          <SectionTitle right={<span>Times are UTC</span>}>Sent per day, by kind</SectionTitle>
          <SentPerDayChart />
        </div>
        <div className="mt-6">
          <SectionTitle>Latest emails</SectionTitle>
          <LatestEmails />
        </div>
      </Section>
      </div>

      <div>
      <SectionTitle count={5}>Money</SectionTitle>
      <div className="space-y-3">

      <Section section="cost" count={4}>
        <Card
          href={href("cost/providers")}
          page="cost/providers"
          error={versions.isError}
          cells={[
            { label: "Providers", value: providers, note: "in the price catalogue" },
            { label: "Cost items", value: items, note: "priced by them" },
          ]}
        />
        <Card
          href={href("cost/spend")}
          page="cost/spend"
          error={margin.isError}
          cells={[
            { label: "Vendor cost", value: t && usd(t.vendorCostInUsdCents), note: "priced spend", bars: byProvider("vendorCostInUsdCents") },
            { label: "Largest provider", value: top === undefined ? undefined : top ? providerName(top.provider) : null, note: top ? `${usd(top.vendorCostInUsdCents)} vendor cost` : undefined },
          ]}
        />
        <Card
          href={href("cost/subscriptions")}
          page="cost/subscriptions"
          error={subs.isError}
          cells={[
            { label: "Subscriptions", value: subs.data?.subscriptions.length, note: "priced from the bank ledger" },
            {
              label: "Apollo, per credit",
              value: subs.data === undefined ? undefined : centsPerEmail(subs.data.subscriptions.find((x) => x.key === "apollo")?.costPerCreditUsdCents ?? null),
              note: subs.data ? `real cost, as of ${day(subs.data.asOf)}` : undefined,
            },
          ]}
        />
        <Card
          href={href("cost/email-sending")}
          page="cost/email-sending"
          error={sendPrice.isError}
          cells={[
            {
              label: "Per email",
              value: sp === undefined ? undefined : centsPerEmail(sp.currentPriceUsdCents),
              note: sp ? `real cost, as of ${day(sp.asOf)}` : undefined,
              bars: sp?.monthly.slice(-7).map((mo) => mo.priceUsdCents ?? 0),
            },
            { label: "Emails to leads", value: sp?.totals.emailsToLeads.toLocaleString("en-US"), note: sp ? `${usd(sp.totals.spendUsd * 100)} infra spend, net` : undefined },
          ]}
        />
      </Section>

      <Section section="ledger" count={3} grid={false}>
        <HubChips>
          <HubChip href={href("ledger/coverage")} color={covAt !== undefined && belowTarget(covAt) ? "var(--data-rose)" : "var(--data-amber)"} label="Outcome coverage" />
          <HubChip href={href("ledger/check")} color={ledger.data && !ledger.data.balanced ? "var(--data-rose)" : "var(--data-amber)"} label="To the cent" />
          <HubChip href={href("ledger/reconciliation")} color={recon.data && !recon.data.reconciled ? "var(--data-rose)" : "var(--data-amber)"} label="Reconciled" />
        </HubChips>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Card
            href={href("ledger/coverage")}
            page="ledger/coverage"
            error={coverage.isError && !coverage.data}
            cells={[
              {
                label: "Declared share",
                value: covAt === undefined ? undefined : covAt === null ? null : <span style={{ color: belowTarget(covAt) ? "var(--data-rose)" : undefined }}>{formatRatePct(Number(outcomeShare(covAt)))}</span>,
                note: "target 95%",
                bars: coverage.data?.fleet.slice(-7).map((p) => Number(outcomeShare(p) ?? 0)),
              },
              { label: "Services spending", value: coverage.data && serviceNames(coverage.data).length, note: "in the window" },
            ]}
          />
          <Card
            href={href("ledger/check")}
            page="ledger/check"
            error={ledger.isError && !ledger.data}
            cells={[
              {
                label: "Org-days off",
                value: ledger.data && <span style={{ color: ledger.data.mismatches.length ? "var(--data-rose)" : undefined }}>{ledger.data.mismatches.length}</span>,
                note: "gross, net and vendor",
              },
              { label: "Days not computed", value: ledger.data?.daysMissing.length, note: "checked once filled" },
            ]}
          />
          <Card
            href={href("ledger/reconciliation")}
            page="ledger/reconciliation"
            error={recon.isError && !recon.data}
            cells={[
              {
                label: "Reconciled",
                value: recon.data && (recon.data.reconciled ? "Yes" : <span style={{ color: "var(--data-rose)" }}>No</span>),
                note: "every dollar, every day",
              },
              { label: "Days not in totals", value: recon.data?.daysMissing.length, note: "not computed or to redo" },
            ]}
          />
        </div>
      </Section>

      <Section section="customers" count={2}>
        <Card
          href={href("customers/accounts")}
          page="customers/accounts"
          error={absorbed.isError}
          cells={[
            { label: "Active", value: ab?.currentCustomers, note: "a campaign running" },
            { label: "Churned", value: ab?.churnedCustomers, note: "paid before, nothing running" },
          ]}
        />
        <Card
          href={href("customers/absorbed")}
          page="customers/absorbed"
          error={absorbed.isError}
          cells={[
            {
              label: "Absorbed",
              value: ab && usd(Number(ab.absorbedCents)),
              note: "since inception",
              bars: absorbed.data?.fleetByMonth.slice(-7).map((mo) => Number(mo.absorbedCents)),
            },
            {
              label: "Per customer",
              value: ab === undefined ? undefined : ab.averagePerCustomerWithCostCents == null ? null : usdExact(Number(ab.averagePerCustomerWithCostCents)),
              note: ab ? `average over ${ab.customersWithAbsorbedCost.toLocaleString("en-US")} customers` : undefined,
            },
          ]}
        />
      </Section>

      <Section section="price" count={3}>
        <Card
          href={href("price/billed")}
          page="price/billed"
          error={margin.isError}
          cells={[
            { label: "Billed, net", value: t && usd(t.netBilledCostInUsdCents), note: `${t ? usd(t.billedCostInUsdCents) : "…"} gross`, bars: byProvider("netBilledCostInUsdCents") },
            { label: "Priced now", value: prices.data?.length, note: prices.data ? `of ${items ?? "…"} cost items` : undefined },
          ]}
        />
        <Card
          href={href("price/new-pricing")}
          page="price/new-pricing"
          error={real.isError}
          cells={[
            { label: "Priced at real ×2", value: rc?.items.filter((x) => x.proposedBasis === "real-cost-x2").length, note: rc ? `of ${rc.items.length} cost items` : undefined },
            { label: "Flagged", value: rc?.items.filter((x) => x.flag != null).length, note: rc ? `as of ${day(rc.asOf)}, not billed yet` : undefined },
          ]}
        />
        <Card
          href={href("price/pricing-basis")}
          page="price/pricing-basis"
          error={real.isError}
          cells={[
            { label: "Averaged", value: rc?.items.filter((x) => x.method === "subscription" || x.method === "email-send-price").length, note: "subscriptions and email" },
            { label: "At list cost", value: rc?.items.filter((x) => x.method === "api-list-cost").length, note: "API cost items" },
          ]}
        />
      </Section>

      <Section section="margin" count={2}>
        <Card
          href={href("margin")}
          page="margin"
          error={margin.isError}
          cells={[
            { label: "Margin, net", value: t && usd(t.netMarginCostInUsdCents), note: `${t ? usd(t.marginCostInUsdCents) : "…"} gross`, bars: byProvider("netMarginCostInUsdCents") },
            { label: "Largest provider", value: top === undefined ? undefined : top ? providerName(top.provider) : null, note: top ? `${usd(top.netMarginCostInUsdCents)} margin` : undefined },
          ]}
        />
        <Card
          href={href("margin/pricing-comparison")}
          page="margin/pricing-comparison"
          error={real.isError}
          cells={[
            { label: "Price lists", value: rc === undefined ? undefined : "2 sources", note: "catalogue or proposed, any day" },
            { label: "Since", value: rc && day(rc.rules.since), note: rc ? `to ${day(rc.asOf)}, per org and brand` : undefined },
          ]}
        />
      </Section>

      </div>
      </div>

      <div>
      <SectionTitle count={1}>WhatsApp</SectionTitle>
      <Section section="whatsapp" count={2} grid={false}>
        <HubChips>
          <HubChip href={href("whatsapp/lines")} color={wa.data && linesDown(wa.data).length ? "var(--data-rose)" : "var(--data-lime)"} label="Lines" />
          <HubChip href={href("whatsapp/sophie")} color={sophieBad?.length ? "var(--data-rose)" : "var(--data-lime)"} label="Sophie's replies" />
        </HubChips>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card
          href={href("whatsapp/lines")}
          page="whatsapp/lines"
          error={wa.isError && !wa.data}
          cells={[
            {
              label: "Down now",
              value: wa.data && <span style={{ color: linesDown(wa.data).length ? "var(--data-rose)" : undefined }}>{linesDown(wa.data).length}</span>,
              note: "a red line sends nothing",
            },
            { label: "Linked lines", value: wa.data && linkedLines(wa.data).length, note: "every org" },
          ]}
        />
        <Card
          href={href("whatsapp/sophie")}
          page="whatsapp/sophie"
          error={sophie.isError && !sophie.data}
          cells={[
            {
              label: "Not delivered",
              value: sophieBad && <span style={{ color: sophieBad.length ? "var(--data-rose)" : undefined }}>{sophieBad.length ? sophieBad[0].notDelivered : 0}</span>,
              note: sophieBad?.length ? `on ${shortDay(sophieBad[0].day)}` : "last 3 days",
              bars: sophie.data?.days.slice(-7).map((d) => d.notDelivered),
            },
            { label: "Delivered today", value: sophie.data?.days.at(-1)?.delivered, note: "UTC day", bars: sophie.data?.days.slice(-7).map((d) => d.delivered) },
          ]}
        />
        </div>
        <div className="mt-6">
          <SectionTitle right={<span>One bar per UTC day</span>}>Sophie&apos;s WhatsApp replies</SectionTitle>
          {sophie.isError && !sophie.data ? (
            <div className="k-card">
              <EmptyNote>Could not read Sophie&apos;s replies from production.</EmptyNote>
            </div>
          ) : sophie.data ? (
            <SophieRepliesChart data={sophie.data} />
          ) : (
            <div className="k-card p-4">
              <Shimmer className="h-[140px] w-full" />
            </div>
          )}
        </div>
      </Section>
      </div>

      <div>
      <SectionTitle count={1}>Triggers</SectionTitle>
      <Section section="triggers" count={4} grid={false}>
        <HubChips>
          <HubChip href={href("triggers/reports")} color={trig.data?.status === "red" ? "var(--data-rose)" : "var(--data-teal)"} label="Reports" />
          <HubChip href={href("triggers/waiting")} color={waiting.data?.status === "red" ? "var(--data-rose)" : "var(--data-teal)"} label="Prospects waiting" />
          <HubChip href={href("triggers/firing")} color={firing.data?.status === "red" ? "var(--data-rose)" : "var(--data-teal)"} label="Firing" />
          <HubChip href={href("triggers/unsent")} color={unsent.data?.status === "red" ? "var(--data-rose)" : "var(--data-teal)"} label="Unsent answers" />
        </HubChips>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card
          href={href("triggers/reports")}
          page="triggers/reports"
          error={trig.isError && !trig.data}
          cells={[
            {
              label: "Stuck now",
              value: trig.data && <span style={{ color: trig.data.status === "red" ? "var(--data-rose)" : undefined }}>{trig.data.triggers.filter((t) => t.stuck > 0).map((t) => t.stuck).join(" + ") || "0"}</span>,
              note: trig.data ? `not sent after ${trig.data.stuckAfterMinutes} min` : "not sent after 15 min",
            },
            {
              label: "Red triggers",
              value: trig.data && (trig.data.triggers.filter((t) => t.status === "red").map((t) => triggerName(t.trigger)).join(", ") || "None"),
              note: "of the four",
            },
          ]}
        />
        <Card
          href={href("triggers/waiting")}
          page="triggers/waiting"
          error={waiting.isError && !waiting.data}
          cells={[
            {
              label: "Blocked now",
              value: waiting.data && <span style={{ color: waiting.data.status === "red" ? "var(--data-rose)" : undefined }}>{waiting.data.stuck.toLocaleString("en-US")}</span>,
              note: waiting.data ? `waiting over ${waiting.data.stuckAfterMinutes} min` : "waiting over 30 min",
            },
            {
              label: "Longest wait now",
              value: waiting.data && (
                <span style={{ color: longestWaitIsRed(waiting.data) ? "var(--data-rose)" : undefined }}>
                  {waiting.data.oldestWaitingMinutes == null ? "Nobody" : waitLabel(waiting.data.oldestWaitingMinutes)}
                </span>
              ),
              note: "bars: 9 in 10 answered within, per day",
              bars: waiting.data?.byDay.slice(-7).reverse().map((d) => d.waitMinutes.p90 ?? 0),
            },
          ]}
        />
        <Card
          href={href("triggers/firing")}
          page="triggers/firing"
          error={firing.isError && !firing.data}
          cells={[
            {
              label: "Broken now",
              value: firing.data && <span style={{ color: firing.data.status === "red" ? "var(--data-rose)" : undefined }}>{redTriggers(firing.data).map((t) => t.label).join(", ") || "None"}</span>,
              note: "never fired, or no event",
            },
            { label: "Watched", value: firing.data && watchedTriggers(firing.data).watched.length, note: "a live campaign waits on it" },
          ]}
        />
        <Card
          href={href("triggers/unsent")}
          page="triggers/unsent"
          error={unsent.isError && !unsent.data}
          cells={[
            {
              label: "Not sent",
              value: unsent.data && <span style={{ color: unsent.data.status === "red" ? "var(--data-rose)" : undefined }}>{unsent.data.brokenLast24h.toLocaleString("en-US")}</span>,
              note: unsent.data ? `last ${unsent.data.redWindowHours} h` : "last 24 h",
            },
            { label: "Listed", value: unsent.data?.unsent.length.toLocaleString("en-US"), note: unsent.data ? `last ${unsent.data.days} days` : undefined },
          ]}
        />
        </div>
      </Section>
      </div>

      <div>
      <SectionTitle count={1}>Connected tools</SectionTitle>
      <Section section="tools" count={1} grid={false}>
        <HubChips>
          <HubChip href={href("tools/intake")} color={tools.data?.status === "red" ? "var(--data-rose)" : "var(--data-sky)"} label="Records taken in" />
        </HubChips>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card
          href={href("tools/intake")}
          page="tools/intake"
          error={tools.isError && !tools.data}
          cells={[
            {
              label: "Red now",
              value: tools.data && <span style={{ color: tools.data.status === "red" ? "var(--data-rose)" : undefined }}>{redConnections(tools.data).map(connectionName).join(", ") || "None"}</span>,
              note: "quiet, failing or late",
            },
            { label: "Connected", value: tools.data?.connections.length, note: "every org" },
          ]}
        />
        </div>
      </Section>
      </div>

      <div>
      <SectionTitle count={2}>Factory plan</SectionTitle>
      <Section section="factory" count={2} grid={false}>
        <HubChips>
          <HubChip href={href("factory/plan")} color={factory.data?.verdict.red ? "var(--data-rose)" : "var(--data-violet)"} label="Would change" />
          <HubChip href={href("factory/following")} color={following.data?.status === "red" ? "var(--data-rose)" : "var(--data-violet)"} label="Following its plan" />
        </HubChips>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card
          href={href("factory/plan")}
          page="factory/plan"
          error={factory.isError && !factory.data}
          cells={[
            {
              label: "Broken",
              // Red ONLY for a real problem (owner 2026-10-29): the served verdict.
              value: factory.data && (
                <span style={{ color: factory.data.verdict.red ? "var(--data-rose)" : undefined }}>{factory.data.problems?.length ?? 0}</span>
              ),
              note: factory.data ? (factory.data.verdict.red ? factory.data.verdict.reasons.map(verdictReasonWords).join(", ") : `${factory.data.notYet?.length ?? 0} waiting on a first price`) : undefined,
            },
            {
              label: "Would change",
              value: factory.data && (factory.data.series[factory.data.series.length - 1]?.differs ?? 0),
              note: "live campaigns, last day",
              bars: factory.data?.series.map((d) => d.differs),
            },
          ]}
        />
        <Card
          href={href("factory/following")}
          page="factory/following"
          error={following.isError && !following.data}
          cells={[
            {
              label: "Cannot follow",
              value: following.data && (
                <span style={{ color: following.data.status === "red" ? "var(--data-rose)" : undefined }}>{following.data.red.length}</span>
              ),
              note: following.data
                ? following.data.staleReason ?? (following.data.red.map((c) => `${c.salesFunnelName}: ${planStateWords(c.state).words}`).join("; ") || "none")
                : undefined,
            },
            {
              label: "Following",
              value: following.data?.following,
              note: "switched campaigns",
              bars: following.data?.byDay.map((d) => d.following),
            },
          ]}
        />
        </div>
      </Section>
      </div>

      <div>
      <SectionTitle count={1}>Scripts</SectionTitle>
      <Section section="scripts" count={1} grid={false}>
        <HubChips>
          <HubChip href={href("scripts/engines")} color={scriptsBroken?.length ? "var(--data-rose)" : "var(--data-teal)"} label="Engines" />
        </HubChips>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card
          href={href("scripts/engines")}
          page="scripts/engines"
          error={scripts.isError && !scripts.data}
          cells={[
            {
              label: "Red now",
              value: scriptsBroken && <span style={{ color: scriptsBroken.length ? "var(--data-rose)" : undefined }}>{scriptsBroken.length}</span>,
              note: scriptsBroken?.length ? scriptsBroken.map((o) => outcomeName(o.outcome)).join(", ") : "every script works",
            },
            {
              label: "Guard",
              value: scripts.data && (
                scriptGuards.includes("rolled_back") ? (
                  <span style={{ color: "var(--data-rose)" }}>{guardStateWords("rolled_back").words}</span>
                ) : scriptGuards.includes("watching") ? (
                  guardStateWords("watching").words
                ) : scriptGuards.length ? (
                  guardStateWords(scriptGuards[0]).words
                ) : (
                  "Not live"
                )
              ),
              note: "rolls back on too many errors",
            },
          ]}
        />
        </div>
      </Section>
      </div>

      <div>
      <SectionTitle count={1}>Security</SectionTitle>
      <Section section="security" count={1} grid={false}>
        <HubChips>
          <HubChip href={href("security/advisories")} color={sec.data?.status === "red" ? "var(--data-rose)" : "var(--data-teal)"} label="Advisories" />
        </HubChips>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card
          href={href("security/advisories")}
          page="security/advisories"
          error={sec.isError && !sec.data}
          cells={[
            {
              label: "Repos red",
              value: sec.data && <span style={{ color: sec.data.redRepos.length ? "var(--data-rose)" : undefined }}>{sec.data.redRepos.length}</span>,
              note: "critical, high or no audit",
            },
            { label: "Repos watched", value: sec.data?.repos.length, note: "in the last 30 days" },
          ]}
        />
        </div>
      </Section>
      </div>

      <div>
      <SectionTitle count={1}>Box</SectionTitle>
      <Section section="box" count={2} grid={false}>
        <HubChips>
          <HubChip href={href("box/load")} color={box.data?.status === "red" ? "var(--data-rose)" : "var(--data-teal)"} label="Load and memory" />
          <HubChip href={href("box/watchdogs")} color={watchdogs.data?.status === "red" ? "var(--data-rose)" : "var(--data-teal)"} label="Watchdogs" />
        </HubChips>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card
          href={href("box/load")}
          page="box/load"
          error={box.isError && !box.data}
          cells={[
            {
              label: "Load, 5 min",
              value: box.data && (box.data.latest ? <span style={{ color: box.data.status === "red" ? "var(--data-rose)" : undefined }}>{loadLabel(box.data.latest.load5)}</span> : null),
              note: box.data?.thresholds.load5Max != null ? `red above ${loadLabel(box.data.thresholds.load5Max)}` : "red above 1.5x the cores",
            },
            {
              label: "Available memory",
              value: box.data && (box.data.latest ? memLabel(box.data.latest.memAvailableMb) : null),
              note: box.data?.latest ? `of ${memLabel(box.data.latest.memTotalMb)}` : "no sample",
            },
          ]}
        />
        <Card
          href={href("box/watchdogs")}
          page="box/watchdogs"
          error={watchdogs.isError && !watchdogs.data}
          cells={[
            {
              label: "Broken",
              value: watchdogs.data && <span style={{ color: watchdogs.data.brokenCount > 0 ? "var(--data-rose)" : undefined }}>{watchdogs.data.brokenCount}</span>,
              note: "found a problem or went silent",
            },
            {
              label: "Watchdogs",
              value: watchdogs.data?.checks.length,
              note: "crons reporting here, never by email",
            },
          ]}
        />
        </div>
      </Section>
      </div>

      <div>
      <SectionTitle count={1}>AI vendors</SectionTitle>
      <Section section="ai" count={1} grid={false}>
        <HubChips>
          <HubChip href={href("ai/credit")} color={vendorsOut?.length ? "var(--data-rose)" : "var(--data-violet)"} label="Credit" />
        </HubChips>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card
          href={href("ai/credit")}
          page="ai/credit"
          error={vendors.isError && !vendors.data}
          cells={[
            {
              label: "Out of credit now",
              value: vendorsOut && <span style={{ color: vendorsOut.length ? "var(--data-rose)" : undefined }}>{vendorsOut.map((v) => v.label).join(", ") || "None"}</span>,
              note: "calls refused for lack of credit",
            },
            { label: "Vendors watched", value: vendors.data?.vendors.length, note: "every AI vendor we call" },
          ]}
        />
        </div>
      </Section>
      </div>

      <div>
      <SectionTitle count={1}>Copilot</SectionTitle>
      <Section section="chat" count={1}>
        <Card
          href={href("chat/skills")}
          page="chat/skills"
          error={skills.isError}
          cells={[
            { label: "Skills", value: skills.data?.length, note: "in the Copilot's tree" },
            { label: "Edited by a person", value: skills.data?.filter((x) => x.updatedBy !== "seed").length, note: "the rest are as seeded" },
          ]}
        />
      </Section>
      </div>
      </div>
      </HubOpen.Provider>
    </Frame>
  );
}

/** Where the hub remembers which rows are open, so Back from a page finds them as left. */
const OPEN_SECTIONS_KEY = "distribute-monitoring-open-sections";
const HubOpen = createContext<ReturnType<typeof useOpenSections> | null>(null);

/** One collapsible row of the hub, Research's anatomy: its mark, its name, its line, a page count, a chevron. */
function Section({ section, count, grid = true, children }: { section: SectionKey; count: number; grid?: boolean; children: React.ReactNode }) {
  const look = SECTION_LOOK[section];
  const hub = useContext(HubOpen);
  if (!hub) throw new Error("[v2] monitoring Section outside the hub");
  return (
    <HubSectionBlock
      id={`monitoring-${section}`}
      open={hub.open.has(section)}
      onToggle={() => hub.toggle(section)}
      animate={hub.ready}
      mark={(px) => <SectionMark section={section} size={px} />}
      name={look.name}
      line={look.sub}
      meta={`${count} ${count === 1 ? "page" : "pages"}`}
    >
      {grid ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div> : children}
    </HubSectionBlock>
  );
}

/** Research's study card: mark + section·title in its colour + the question, then an inset block of two cells. The whole card is the link. */
function Card({ href, page, cells, error }: { href: string; page: MonitoringPage; cells: [Cell, Cell]; error: boolean }) {
  const meta = PAGE[page];
  const look = SECTION_LOOK[meta.section];
  return (
    <Link href={href} className="k-card flex min-w-0 flex-col p-4">
      <div className="flex items-start gap-3">
        <SectionMark section={meta.section} />
        <div className="min-w-0 flex-1">
          <p className="k-fg3 truncate text-[12px]">
            <span style={{ color: look.color }}>{look.name}</span>
            {meta.title !== look.name && ` · ${meta.title}`}
          </p>
          <p className="mt-0.5 text-[14px] font-medium leading-5">{meta.question}</p>
        </div>
      </div>
      <div className="k-inset mt-4 grid grid-cols-2 overflow-hidden rounded-[10px] shadow-[inset_0_0_0_1px_var(--line-subtle)]">
        {cells.map((c, i) => (
          <div key={c.label} className={`min-w-0 p-3 ${i === 0 ? "border-r border-[var(--line-subtle)]" : ""}`}>
            <p className="k-label">{c.label}</p>
            <div className="mt-1.5 flex items-end justify-between gap-2">
              <p className="min-w-0 truncate text-[20px] font-medium leading-6 tabular-nums">
                {error ? (
                  <span className="k-fg3 text-[13px]">not readable</span>
                ) : c.value === undefined ? (
                  <Shimmer className="h-6 w-20" />
                ) : c.value === null ? (
                  <span className="k-fg4">{"—"}</span>
                ) : (
                  c.value
                )}
              </p>
              {c.bars && !error && <MiniBars values={c.bars} color={look.color} />}
            </div>
            {c.note && <p className="k-fg3 mt-0.5 truncate text-[11px]">{c.note}</p>}
          </div>
        ))}
      </div>
    </Link>
  );
}

// ─── Tables ────────────────────────────────────────────────────────────────

const TH = "k-label px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4";
const THR = `${TH} text-right`;
const TD = "px-3 py-2.5 first:pl-4 last:pr-4";
const TDR = `${TD} text-right tabular-nums`;

function Table({ head, children, fixed = false }: { head: React.ReactNode; children: React.ReactNode; fixed?: boolean }) {
  return (
    <div className="k-card overflow-x-auto">
      <table className={`w-full text-[13px] ${fixed ? "md:table-fixed" : ""}`}>
        <thead className="border-b border-[var(--line-subtle)]">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-[var(--line-subtle)]">{children}</tbody>
      </table>
    </div>
  );
}

function Cell({ v }: { v: React.ReactNode | null }) {
  return <>{v ?? <span className="k-fg4">{"—"}</span>}</>;
}

/** Spend with no known vendor cost: stated apart, never folded into the margin at zero cost. */
function UnpricedNote({ f }: { f: MarginFigures }) {
  if (Number(f.unpricedBilledCostInUsdCents) === 0) return null;
  return (
    <p className="k-card k-fg2 mt-3 px-4 py-2.5 text-[12px]">
      {usdExact(f.unpricedBilledCostInUsdCents)} of billed spend has no vendor cost on record ({f.unpricedCostNames.join(", ")}), so it is left out of the vendor cost and
      the margin rather than counted at zero cost.
    </p>
  );
}

// ─── Cost ──────────────────────────────────────────────────────────────────

function ProvidersPage() {
  const versions = useVersions();
  const margin = useMargin();
  return (
    <Loaded q={versions}>
      {(vs) => (
        <>
          <SectionTitle>Every provider, since inception</SectionTitle>
          <ProvidersTable
            margin={margin.data}
            marginError={margin.isError}
            versions={vs}
            catalogue
            columns={["items", "vendor"]}
          />
        </>
      )}
    </Loaded>
  );
}

function SpendPage() {
  const margin = useMargin();
  const versions = useVersions();
  return (
    <Loaded q={margin}>
      {(m) => (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Vendor cost" note="priced spend">
              <Figure value={usd(m.total.vendorCostInUsdCents)} />
            </StatTile>
            <StatTile label="Providers">
              <Figure value={m.providers.length} />
            </StatTile>
          </div>
          <div className="mt-6">
            <SectionTitle count={m.providers.length}>Per provider</SectionTitle>
            <ProvidersTable margin={m} versions={versions.data} catalogue={false} columns={["vendor"]} />
          </div>
          <CostItemsTable rows={m.costItems} cols={["vendor"]} />
        </>
      )}
    </Loaded>
  );
}

// ─── Price ─────────────────────────────────────────────────────────────────

function BilledPage() {
  const margin = useMargin();
  const versions = useVersions();
  const prices = useCurrentPrices();
  return (
    <Loaded q={versions}>
      {(vs) => (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Billed, net" note="after per-org discounts">
              <Figure value={margin.data ? usd(margin.data.total.netBilledCostInUsdCents) : margin.isError ? null : undefined} />
            </StatTile>
            <StatTile label="Billed, gross" note="list price">
              <Figure value={margin.data ? usd(margin.data.total.billedCostInUsdCents) : margin.isError ? null : undefined} />
            </StatTile>
            <StatTile label="Refunded" note="spent, not charged">
              <Figure value={margin.data ? usd(margin.data.total.refundedCostInUsdCents) : margin.isError ? null : undefined} />
            </StatTile>
            <StatTile label="Priced now" note="cost items">
              <Figure value={prices.data ? prices.data.length : prices.isError ? null : undefined} />
            </StatTile>
          </div>
          {margin.data && <UnpricedNote f={margin.data.total} />}
          <div className="mt-6">
            <SectionTitle right={<span>Pick a row for its price history</span>}>Per cost item</SectionTitle>
            <BillingTable margin={margin.data} marginError={margin.isError} versions={vs} prices={prices.data} pricesError={prices.isError} />
          </div>
        </>
      )}
    </Loaded>
  );
}

// ─── Margin ────────────────────────────────────────────────────────────────

function SubscriptionsPage() {
  const subs = useSubscriptionCosts();
  return <Loaded q={subs}>{(d) => <SubscriptionsView data={d} />}</Loaded>;
}

/** features-service's "first build still running" answer on the customer-health board. */
function isBoardComputing(error: unknown): boolean {
  return error instanceof ApiError && error.status === 503 && error.body?.reason === "customer_health_not_computed_yet";
}

function CustomerAccountsPage() {
  const absorbed = useAbsorbedCosts();
  // The health board is served from features-service's last build; it fills its columns when it answers.
  // Right after a deploy the board answers 503 until its first build: "computing", re-asked every 30 s.
  const health = useAuthQuery(["staffCustomerHealth"], getStaffCustomerHealth, {
    ...ONCE,
    refetchInterval: (q: { state: { error: unknown } }) => (isBoardComputing(q.state.error) ? 30_000 : false),
  });
  const computing = isBoardComputing(health.error);
  return <Loaded q={absorbed}>{(d) => <AccountsView data={d} health={{ data: health.data, isError: health.isError && !computing, computing }} />}</Loaded>;
}

function AbsorbedPage() {
  const absorbed = useAbsorbedCosts();
  return <Loaded q={absorbed}>{(d) => <AbsorbedView data={d} />}</Loaded>;
}

function EmailSendingPage() {
  const price = useEmailSendPrice();
  return <Loaded q={price}>{(p) => <EmailPriceView p={p} />}</Loaded>;
}

function MarginPage() {
  const margin = useMargin();
  return (
    <Loaded q={margin}>
      {(m) => (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Margin, net" note="after per-org discounts">
              <Figure value={usd(m.total.netMarginCostInUsdCents)} />
            </StatTile>
            <StatTile label="Margin, gross" note="at list price">
              <Figure value={usd(m.total.marginCostInUsdCents)} />
            </StatTile>
            <StatTile label="Billed, net" note="priced spend">
              <Figure value={usd(m.total.netPricedBilledCostInUsdCents)} />
            </StatTile>
            <StatTile label="Vendor cost" note="priced spend">
              <Figure value={usd(m.total.vendorCostInUsdCents)} />
            </StatTile>
          </div>
          <UnpricedNote f={m.total} />
          <div className="mt-6">
            <SectionTitle count={m.providers.length}>Per provider</SectionTitle>
            <MarginTable rows={m.providers} />
          </div>
          <CostItemsTable rows={m.costItems} cols={["margin"]} />
        </>
      )}
    </Loaded>
  );
}

function MarginTable({ rows }: { rows: ProviderMargin[] }) {
  return (
    <Table
      head={
        <>
          <th className={TH}>Provider</th>
          <th className={THR}>Billed, net</th>
          <th className={THR}>Vendor cost</th>
          <th className={THR}>Margin, net</th>
          <th className={THR}>Margin, gross</th>
          <th className={THR}>Unpriced spend</th>
        </>
      }
    >
      {rows.map((p) => (
        <tr key={p.provider ?? "null"}>
          <td className={TD}>{providerName(p.provider)}</td>
          <td className={TDR}>{usd(p.netPricedBilledCostInUsdCents)}</td>
          <td className={TDR}>{usd(p.vendorCostInUsdCents)}</td>
          <td className={TDR}>{usd(p.netMarginCostInUsdCents)}</td>
          <td className={TDR}>{usd(p.marginCostInUsdCents)}</td>
          <td className={TDR}>{Number(p.unpricedBilledCostInUsdCents) ? usd(p.unpricedBilledCostInUsdCents) : <Cell v={null} />}</td>
        </tr>
      ))}
    </Table>
  );
}

/** The per-cost-item rows, with the columns of the page they sit on. */
function CostItemsTable({ rows, cols }: { rows: CostItemMargin[]; cols: ["vendor"] | ["billed"] | ["margin"] }) {
  const kind = cols[0];
  return (
    <div className="mt-6">
      <SectionTitle count={rows.length}>Per cost item</SectionTitle>
      <Table
        head={
          <>
            <th className={TH}>Cost item</th>
            <th className={TH}>Provider</th>
            {kind === "vendor" && <th className={THR}>Vendor cost</th>}
            {kind === "billed" && (
              <>
                <th className={THR}>Billed, net</th>
                <th className={THR}>Billed, gross</th>
              </>
            )}
            {kind === "margin" && (
              <>
                <th className={THR}>Billed, net</th>
                <th className={THR}>Vendor cost</th>
                <th className={THR}>Margin, net</th>
              </>
            )}
            {kind !== "vendor" && <th className={THR}>Unpriced spend</th>}
          </>
        }
      >
        {rows.map((c) => (
          <tr key={`${c.provider}|${c.costName}`}>
            <td className={`${TD} k-mono text-[12px]`}>{c.costName}</td>
            <td className={TD}>{providerName(c.provider)}</td>
            {kind === "vendor" && <td className={TDR}>{usd(c.vendorCostInUsdCents)}</td>}
            {kind === "billed" && (
              <>
                <td className={TDR}>{usd(c.netBilledCostInUsdCents)}</td>
                <td className={TDR}>{usd(c.billedCostInUsdCents)}</td>
              </>
            )}
            {kind === "margin" && (
              <>
                <td className={TDR}>{usd(c.netPricedBilledCostInUsdCents)}</td>
                <td className={TDR}>{usd(c.vendorCostInUsdCents)}</td>
                <td className={TDR}>{usd(c.netMarginCostInUsdCents)}</td>
              </>
            )}
            {kind !== "vendor" && <td className={TDR}>{Number(c.unpricedBilledCostInUsdCents) ? usd(c.unpricedBilledCostInUsdCents) : <Cell v={null} />}</td>}
          </tr>
        ))}
      </Table>
    </div>
  );
}

// ─── Emails ────────────────────────────────────────────────────────────────

function EmailsPage() {
  return <EmailsCharts />;
}
