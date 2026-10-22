"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BrainIcon } from "@phosphor-icons/react/dist/csr/Brain";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { FlowArrowIcon } from "@phosphor-icons/react/dist/csr/FlowArrow";
import { CatalogueMark } from "@/components/v2/catalogue-mark";
import { ModelProductLogo } from "@/components/provider-logo";
import { llmMark } from "@/lib/llm-marks";
import { useServedMarks, type ServedMark } from "@/components/v2/served-marks";

/**
 * ONE look for every workflow, template and LLM the dashboard names (owner 2026-10-22: « chaque
 * template ait son icône, chaque LLM ait son logo… Fais un format uniforme »).
 *
 * Two variants, nothing else, same mark box and spacing everywhere:
 * - `inline` (table cells, lists, drawers): a 16px mark, 6px gap, the name at the line's own size.
 * - `chip` (tags beside a label): a `k-chip` holding a 12px mark and the name at 12px.
 * A page header draws `CatalogueObjectMark` at its own title size (40px), the same mark.
 *
 * Marks: an LLM wears its PRODUCT mark (`ModelProductLogo`, a display lookup on its served name or
 * vendor id); a workflow or a template wears the icon features-service serves for it (MARKS-1022,
 * drawn by `CatalogueMark`): pass `icon`/`color` when the read at hand carries them (fleet ranking,
 * catalogue rows), else `servedKey` (dynasty slug, or a template version key) and the mark is read
 * off the Research catalogue. Nothing served = the kind's own glyph. Customer surfaces pass neither.
 * A template's version rides after its dynasty name, discreet (mono, fg-3).
 */

export type CatalogueKind = "workflow" | "template" | "llm";

const INLINE_MARK = 16;
const CHIP_MARK = 12;

/** Each kind's stand-in glyph while no icon is served (the Research topic colours). */
const KIND_LOOK: Record<Exclude<CatalogueKind, "llm">, { color: string; Icon: typeof BrainIcon }> = {
  workflow: { color: "var(--data-lime)", Icon: FlowArrowIcon },
  template: { color: "var(--data-rose)", Icon: FileTextIcon },
};

const unknownModels = new Set<string>();

function Tile({ size, color, children }: { size: number; color: string | null; children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center ${size <= 18 ? "rounded-[5px]" : "rounded-[8px]"}`}
      style={{
        width: size,
        height: size,
        color: color ?? "var(--fg-3)",
        background: color ? `color-mix(in oklab, ${color} 14%, transparent)` : "var(--bg-inset)",
        boxShadow: `inset 0 0 0 1px ${color ? `color-mix(in oklab, ${color} 22%, transparent)` : "var(--line)"}`,
      }}
    >
      {children}
    </span>
  );
}

/** The mark alone, at any size: an LLM's product logo, a workflow's or template's served icon. */
export function CatalogueObjectMark({
  kind,
  name,
  icon,
  color,
  vendorId,
  servedKey,
  size = INLINE_MARK,
}: {
  kind: CatalogueKind;
  name: string;
  icon?: string | null;
  color?: string | null;
  vendorId?: string | null;
  /** A workflow dynasty slug or template key whose served mark to read (staff surfaces). */
  servedKey?: string | null;
  size?: number;
}) {
  if (servedKey && !icon && kind !== "llm") {
    return <WithServedMark kind={kind} servedKey={servedKey} render={(m) => <CatalogueObjectMark kind={kind} name={name} icon={m.icon} color={m.color} size={size} />} />;
  }
  if (kind === "llm") {
    const m = llmMark(name, vendorId);
    if (m.logoSrc) return <ModelProductLogo src={m.logoSrc} size={size} />;
    if (!unknownModels.has(m.name)) {
      unknownModels.add(m.name);
      console.error("[v2] LLM with no product mark: add its family to lib/llm-marks.ts", { name: m.name, vendorId: vendorId ?? null });
    }
    return (
      <Tile size={size} color={null}>
        <BrainIcon size={Math.round(size * 0.62)} weight="duotone" />
      </Tile>
    );
  }
  if (icon) return <CatalogueMark icon={icon} color={color} name={name} size={size} />;
  const { color: c, Icon } = KIND_LOOK[kind];
  return (
    <Tile size={size} color={c}>
      <Icon size={Math.round(size * 0.62)} weight="duotone" />
    </Tile>
  );
}

/**
 * Mark + name of one workflow, template or LLM. `name` is the served name (a model's public name,
 * a workflow's or template dynasty's name); an LLM prints its label beside the mark (the family word
 * the mark already says is dropped) and its whole name on hover. `href` makes the name the link.
 */
export function CatalogueName({
  kind,
  name,
  label,
  version,
  href,
  icon,
  color,
  vendorId,
  variant = "inline",
  className = "",
  after,
  servedKey,
}: {
  kind: CatalogueKind;
  name: string;
  /** Text to print when it differs from the served name (a workflow's short name); hover keeps `name`. */
  label?: string;
  /** A template's version, printed small after the dynasty name. */
  version?: string | null;
  href?: string | null;
  icon?: string | null;
  color?: string | null;
  vendorId?: string | null;
  variant?: "inline" | "chip";
  className?: string;
  /** Something that sits after the name on the same line (a status chip). */
  after?: ReactNode;
  /** A workflow dynasty slug or template key whose served mark to read (staff surfaces). */
  servedKey?: string | null;
}) {
  if (servedKey && !icon && kind !== "llm") {
    const props = { kind, name, label, version, href, vendorId, variant, className, after };
    return <WithServedMark kind={kind} servedKey={servedKey} render={(m) => <CatalogueName {...props} icon={m.icon} color={m.color} />} />;
  }
  const shown = label ?? (kind === "llm" ? llmMark(name, vendorId).label : name);
  const chip = variant === "chip";
  const text = href ? (
    <Link href={href} onClick={(e) => e.stopPropagation()} className="min-w-0 truncate hover:text-[var(--accent)]" title={name}>
      {shown}
    </Link>
  ) : (
    <span className="min-w-0 truncate" title={name}>
      {shown}
    </span>
  );
  return (
    <span
      className={`${chip ? "k-chip max-w-full" : "inline-flex min-w-0 max-w-full items-center gap-1.5"} ${className}`}
      data-catalogue-name={kind}
    >
      <CatalogueObjectMark kind={kind} name={name} icon={icon} color={color} vendorId={vendorId} size={chip ? CHIP_MARK : INLINE_MARK} />
      {text}
      {version ? (
        <span className={`k-mono k-fg3 shrink-0 tabular-nums ${chip ? "text-[11px]" : "text-[11px]"}`} title={`Version ${version}`}>
          {version}
        </span>
      ) : null}
      {after}
    </span>
  );
}

/** Reads one workflow's or template's served mark off the Research catalogue, then draws with it. */
function WithServedMark({
  kind,
  servedKey,
  render,
}: {
  kind: Exclude<CatalogueKind, "llm">;
  servedKey: string;
  render: (m: ServedMark) => ReactNode;
}) {
  const marks = useServedMarks();
  return <>{render(kind === "workflow" ? marks.workflow(servedKey) : marks.template(servedKey))}</>;
}
