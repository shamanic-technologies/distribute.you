"use client";

/**
 * THE TWO-LINE CELLS: what a workflow WRITES WITH, and what it WRITES FROM.
 *
 * Both answer the same shape of question — a name a person reads, and the exact token
 * they would quote back to us — so both are one component rather than two that drift.
 * The mark sits to the LEFT and spans both lines; line one is the name; line two is
 * the identifier, quiet and monospaced, because it is a token rather than prose.
 *
 * ── WHY THE SECOND LINE EXISTS AT ALL ────────────────────────────────────────────
 *
 * A model alias (`deepseek-pro`) and a template id (`blind-discovery-email-v26`) are
 * what the workflow actually STORES. The label above each is derived from it, so a
 * cell that printed only the label would be an interpretation with the evidence
 * thrown away — and for the template the derivation deliberately drops the VERSION,
 * which is the part that tells two of them apart.
 *
 * ── A MARK WE WOULD HAVE TO INVENT IS WORSE THAN NONE ────────────────────────────
 *
 * The model's mark is the PROVIDER's real logo, resolved by the marks catalogue from
 * the alias; an alias the catalogue does not know draws NO logo, because a guessed
 * provider attributes a customer's spend to the wrong company. The template has no
 * logo anywhere in the fleet and never will — nobody publishes one — so it wears a
 * neutral glyph tile instead, which is a placeholder by design rather than a gap.
 *
 * The tile rides `tone-tile`, so it rotates to the BRAND's own tertiary rather than
 * staying ours; the campaign surfaces are the tertiary's home (the Learning tag, the
 * countdown band and the Outcome chart all read it), so a tile drawn here in any other
 * accent would read as a second vocabulary on one screen.
 */

import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { CpuIcon } from "@phosphor-icons/react/dist/csr/Cpu";
import { ProviderLogo } from "@/components/provider-logo";
import { workflowModelMark } from "@/lib/workflow-model-marks";
import { workflowTemplateLabel } from "@/lib/workflow-template-label";

/** 28px: two 14px lines of text, so the mark spans the cell rather than floating. */
const MARK_PX = 28;
const TILE = "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg";

function TwoLine({
  mark,
  line1,
  line2,
}: {
  mark: React.ReactNode;
  line1: React.ReactNode;
  line2?: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {mark}
      <div className="min-w-0">
        <div className="truncate text-sm text-gray-800">{line1}</div>
        {/* BREAKS rather than truncates: the longest template id is wider than the
            column and a truncation would eat the VERSION, which is the one part of it
            that tells two templates apart. */}
        {line2 && (
          <div className="min-w-0 break-all font-mono text-[10px] leading-tight text-gray-400">
            {line2}
          </div>
        )}
      </div>
    </div>
  );
}

/** A neutral tile for a thing that has no logo to draw — never a guessed one. */
function GlyphTile({
  glyph,
  accent,
}: {
  glyph: "template" | "model";
  accent: boolean;
}) {
  const Icon = glyph === "template" ? FileTextIcon : CpuIcon;
  return (
    <span
      className={`${TILE} ${
        accent ? "tone-tile bg-orange-50 text-orange-600" : "bg-gray-100 text-gray-400"
      }`}
      aria-hidden
    >
      <Icon size={16} weight="duotone" />
    </span>
  );
}

/**
 * THE MODEL: whose it is, what it is called, and the alias verbatim.
 *
 * A workflow that states no model reads a neutral tile and a dash — never a default
 * tier, which would claim a model that did not run. An alias the catalogue does not
 * know keeps its own text on line one and states no second line, because the two
 * would be the same string twice.
 */
export function WorkflowModelCell({ contentModel }: { contentModel: string | null }) {
  const model = workflowModelMark(contentModel);
  if (!model) {
    return <TwoLine mark={<GlyphTile glyph="model" accent={false} />} line1={<span className="text-gray-400">—</span>} />;
  }
  const known = model.label !== model.alias;
  return (
    <TwoLine
      mark={
        model.providerDomain ? (
          <span className={`${TILE} bg-white`}>
            <ProviderLogo domain={model.providerDomain} size={MARK_PX - 8} className="rounded-sm" />
          </span>
        ) : (
          <GlyphTile glyph="model" accent={false} />
        )
      }
      line1={model.label}
      line2={known ? model.alias : null}
    />
  );
}

/**
 * THE TEMPLATE: the prompt the emails are written from.
 *
 * Line one drops the trailing version and title-cases the words; line two is the id
 * exactly as the workflow states it, which is what a reader quotes back to us.
 */
export function WorkflowTemplateCell({
  contentPromptType,
}: {
  contentPromptType: string | null;
}) {
  const template = workflowTemplateLabel(contentPromptType);
  if (!template) {
    return (
      <TwoLine
        mark={<GlyphTile glyph="template" accent={false} />}
        line1={<span className="text-gray-400">—</span>}
      />
    );
  }
  return (
    <TwoLine
      mark={<GlyphTile glyph="template" accent />}
      line1={template.label}
      line2={template.id}
    />
  );
}
