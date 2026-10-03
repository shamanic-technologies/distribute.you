"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  getRunDetail,
  listAudiences,
  listChannelWorkflowDynasties,
  listChannelWorkflows,
  listRunGenerations,
  type RunDetail,
  type RunRow,
} from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { formatCentsAsUsdAdaptive } from "@/lib/format-number";
import { friendlyDateTime } from "@/lib/friendly-datetime";
import { leadWorkflowIdentity } from "@/lib/campaign-workflow-rows";
import { workflowModelMark } from "@/lib/workflow-model-marks";
import { workflowTemplateLabel } from "@/lib/workflow-template-label";
import { v2Href, v2PersonHref, v2WorkflowHref } from "@/lib/v2/routes";
import { CrewMark } from "@/components/v2/crew-mark";
import { useMissions } from "@/components/v2/use-missions";
import { runTaskLabel } from "@/components/v2/runs";
import { EmptyNote, Shimmer, TopBar } from "@/components/v2/ui";
import { useStaffMode } from "@/lib/use-staff-mode";

/** How long a run took, in the words a person reads. Null while it is still running. */
function runDuration(run: Pick<RunDetail, "startedAt" | "completedAt">): string | null {
  if (!run.completedAt) return null;
  const s = Math.max(0, Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function statusLabel(run: Pick<RunDetail, "status" | "completedAt">): string {
  if (run.status === "failed" || run.status === "error") return "Failed";
  if (run.completedAt || run.status === "completed") return "Done";
  return "Running";
}

function cents(v: string | null | undefined): string {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? formatCentsAsUsdAdaptive(n) : "$0";
}

/**
 * One workflow run: everything that decided it, in one place. runs-service says what
 * ran and what it cost; the generation content-generation filed under this run says
 * which model actually wrote, from which template, for which audience and which
 * person; the campaign names the mission and its crew. Every value is served, and a
 * value we could not read reads as a dash rather than a guess.
 */
export function RunPage() {
  const { orgId, brandId, runId } = useParams<{ orgId: string; brandId: string; runId: string }>();
  const personRowId = useSearchParams().get("person");
  const { missionByCampaignId } = useMissions(orgId, brandId, { allOffers: true });
  // The workflow, its version, model and template sit below the mission: staff mode only.
  const { staffMode } = useStaffMode();

  const runQ = useAuthQuery(["runDetail", runId], () => getRunDetail(runId), { enabled: Boolean(runId) });
  const genQ = useAuthQuery(["runGenerations", brandId, runId], () => listRunGenerations(brandId, runId), {
    enabled: Boolean(runId && brandId),
  });
  const audiencesQ = useAuthQuery(["audiences", brandId], () => listAudiences(brandId), { enabled: Boolean(brandId) });

  const run = runQ.data ?? null;
  const gen = genQ.data?.[0] ?? null;
  const campaignId = run?.campaignId ?? gen?.campaignId ?? null;
  const mission = campaignId ? missionByCampaignId.get(campaignId) ?? null : null;
  const featureSlug = run?.featureSlug ?? mission?.row.campaign.featureSlug ?? null;
  const legKey = mission?.row.campaign.legKey ?? null;
  const workflowSlug = run?.workflowSlug ?? gen?.workflowSlug ?? null;

  const catalogueQ = useAuthQuery(["workflows", featureSlug ?? "none"], () => listChannelWorkflows(featureSlug as string), {
    enabled: Boolean(featureSlug && workflowSlug),
  });
  const dynastiesQ = useAuthQuery(
    ["workflowDynasties", featureSlug ?? "none"],
    () => listChannelWorkflowDynasties(featureSlug as string),
    { enabled: Boolean(featureSlug && workflowSlug) },
  );
  const workflow = useMemo(() => {
    if (!catalogueQ.data || !dynastiesQ.data) return null;
    return leadWorkflowIdentity(workflowSlug, catalogueQ.data, dynastiesQ.data);
  }, [catalogueQ.data, dynastiesQ.data, workflowSlug]);

  const audienceId = gen?.audienceId ?? run?.audienceId ?? null;
  const audienceName = audienceId
    ? audiencesQ.data?.audiences.find((a) => a.id === audienceId)?.name ?? null
    : null;
  const model = workflowModelMark(gen?.model);
  const template = workflowTemplateLabel(gen?.promptType);
  const personName = gen ? [gen.leadFirstName, gen.leadLastName].filter(Boolean).join(" ") : "";

  const steps = useMemo(
    () => [...(run?.descendantRuns ?? [])].sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? "")),
    [run],
  );

  const missionName = mission ? `${mission.crew.name}${mission.offerName ? ` · ${mission.offerName}` : ""}` : null;
  const title = staffMode
    ? workflow?.dynastyName ?? workflowSlug ?? (run ? runTaskLabel(run as unknown as RunRow) : "Run")
    : missionName ?? (run ? runTaskLabel(run as unknown as RunRow) : "Run");

  return (
    <>
      <TopBar crumbs={[{ label: "Work", href: v2Href(orgId, brandId, "work") }, { label: run ? title : " " }]} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        {runQ.isError ? (
          <div className="k-card">
            <EmptyNote>We could not read this run right now.</EmptyNote>
          </div>
        ) : !run ? (
          <Shimmer className="h-20 w-full rounded-xl" />
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="k-label">Run</p>
                <h1 className="truncate text-[24px] font-medium leading-[30px] tracking-[-0.02em]">{title}</h1>
                <p className="k-fg2 mt-0.5 text-[13px]">
                  Started {friendlyDateTime(run.startedAt)}
                  {runDuration(run) ? ` · took ${runDuration(run)}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="k-chip">{statusLabel(run)}</span>
                <span className="k-chip k-mono tabular-nums">{cents(run.totalCostInUsdCents)}</span>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-4">
                <div className="k-card p-4">
                  <p className="k-label">What it wrote</p>
                  {genQ.isError ? (
                    <p className="k-fg3 mt-2 text-[13px]">We could not read the emails this run wrote.</p>
                  ) : !genQ.data ? (
                    <Shimmer className="mt-3 h-10 w-full" />
                  ) : !gen ? (
                    <p className="k-fg3 mt-2 text-[13px]">This run wrote no email.</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {gen.subject ? <p className="text-[13px] font-medium">{gen.subject}</p> : null}
                      {(gen.sequence ?? []).map((s) => (
                        <div key={s.step} className="k-inset rounded-[8px] p-3 shadow-[inset_0_0_0_1px_var(--line-subtle)]">
                          <p className="k-fg3 text-[11px]">
                            {s.step === 1 ? "Initial email" : `Follow-up ${s.step - 1}`}
                            {s.step > 1 && s.daysSinceLastStep ? ` · ${s.daysSinceLastStep} days after the previous` : ""}
                          </p>
                          <p className="k-fg2 mt-1 whitespace-pre-line text-[13px] leading-[19px]">{s.bodyText}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="k-card">
                  <p className="k-label px-4 pt-4">Steps</p>
                  {steps.length === 0 ? (
                    <EmptyNote>This run spawned no steps.</EmptyNote>
                  ) : (
                    <ul className="mt-2">
                      {steps.map((s) => (
                        <li key={s.id} className="k-row flex h-10 items-center gap-3 px-4 text-[13px]">
                          <span className="min-w-0 flex-1 truncate">{runTaskLabel(s as unknown as RunRow)}</span>
                          <span className="k-fg3 hidden truncate text-[12px] md:inline">{s.serviceName}</span>
                          <span className="k-fg3 w-16 shrink-0 text-right text-[12px]">{statusLabel({ status: s.status, completedAt: s.completedAt ?? null })}</span>
                          <span className="k-mono w-16 shrink-0 text-right tabular-nums">{cents(s.ownCostInUsdCents)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <aside className="space-y-4">
                <div className="k-card p-4">
                  <p className="k-label">Details</p>
                  <dl className="mt-3 space-y-2.5 text-[13px]">
                    <Row
                      k="Mission"
                      v={
                        mission ? (
                          <Link href={mission.href} className="inline-flex items-center gap-1.5 hover:underline">
                            <CrewMark color={mission.crew.color} glyph={mission.crew.glyph} />
                            {mission.crew.name}
                            {mission.offerName ? ` · ${mission.offerName}` : ""}
                          </Link>
                        ) : null
                      }
                    />
                    <Row k="Objective" v={mission?.leg?.label ?? null} />
                    {staffMode && (
                      <>
                        <Row
                          k="Workflow"
                          v={
                            workflow?.dynastySlug && featureSlug && legKey ? (
                              <Link
                                href={v2WorkflowHref(orgId, brandId, workflow.dynastySlug, `${featureSlug}|${legKey}`, campaignId)}
                                className="hover:underline"
                              >
                                {workflow.dynastyName ?? workflow.dynastySlug}
                              </Link>
                            ) : (
                              workflow?.dynastyName ?? null
                            )
                          }
                        />
                        <Row k="Version" v={workflowSlug ? <span className="k-mono text-[12px]">{workflowSlug}</span> : null} />
                        <Row k="LLM" v={model ? <span title={model.alias}>{model.label}</span> : null} />
                        <Row k="Template" v={template ? <span title={template.id}>{template.label}</span> : null} />
                      </>
                    )}
                    <Row k="Audience" v={audienceName} />
                    <Row
                      k="Person"
                      v={
                        personName ? (
                          personRowId ? (
                            <Link href={v2PersonHref(orgId, brandId, personRowId)} className="hover:underline">
                              {personName}
                            </Link>
                          ) : (
                            personName
                          )
                        ) : null
                      }
                    />
                    <Row k="Company" v={gen?.leadCompany ?? null} />
                    <Row k="Cost" v={cents(run.totalCostInUsdCents)} />
                  </dl>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="k-fg3 shrink-0">{k}</dt>
      <dd className="min-w-0 truncate text-right">{v ?? <span className="k-fg4">{"—"}</span>}</dd>
    </div>
  );
}
