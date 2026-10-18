"use client";

import { CatalogueMark } from "@/components/v2/catalogue-mark";
import { usePublicPipe } from "@/lib/use-leg-catalogue";

const warned = new Set<string>();
function warnOnce(key: string, message: string, context: Record<string, unknown>) {
  if (warned.has(key)) return;
  warned.add(key);
  console.error(message, context);
}

/**
 * A PIPE's mark as features-service serves it (owner 2026-10-18: « les pipes ont maintenant
 * leur nom et leur logo »): its icon in its colour, off the PUBLIC catalogue (`pipe` on every
 * `channels[].stepTransitions[]`, the staff catalogue's own row), so customer and staff
 * surfaces draw one mark from one read. Never a look of ours.
 *
 * Until the catalogue answers, a quiet tile of the same size holds the place; a pipe it serves
 * no mark for is logged once and drawn as the catalogue mark's unknown-icon circle.
 */
export function ServedPipeMark({ pipeId, size = 16 }: { pipeId: string | null; size?: number }) {
  const { pipe, settled } = usePublicPipe(pipeId);
  if (!pipeId) {
    warnOnce("", "[v2] a pipe mark asked with no pipe id", {});
    return <CatalogueMark name="" size={size} />;
  }
  if (pipe) return <CatalogueMark icon={pipe.icon} color={pipe.color} name={pipe.name} size={size} />;
  if (settled) {
    warnOnce(pipeId, "[v2] features-service serves no pipe for this id on the public catalogue", { pipeId });
    return <CatalogueMark name="" size={size} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 bg-[var(--bg-inset)] ${size <= 18 ? "rounded-[5px]" : "rounded-[8px]"}`}
      style={{ width: size, height: size }}
    />
  );
}
