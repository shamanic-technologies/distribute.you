/**
 * The "Add a brand" modal's progress, kept in localStorage per org so a reload, a closed
 * modal or a new tab reopens it where the person left (2026-10-05, Steady Recruit: a
 * reload restarted the walk and minted a second offer). Only what the person typed or
 * picked lives here; the brand, its offers and audiences are already saved server-side
 * and the modal re-reads them. Alias-free so the rules carry real unit tests.
 */

import { NEW_ORG_STEPS, type LeverKey, type NewOrgLegKey, type NewOrgStep } from "./new-org-wizard";

export const NEW_ORG_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** A proposal as stored: the modal keeps the producer's whole object, only `name` is required. */
export type DraftProposal = { name: string } & Record<string, unknown>;

export interface NewOrgDraft {
  v: 1;
  orgId: string;
  brandId: string;
  savedAt: number;
  step: NewOrgStep;
  hasWebsite: boolean;
  website: string;
  brandName: string;
  offerText: string;
  offerProposals: DraftProposal[];
  pickedOfferIndex: number;
  offerId: string | null;
  existingOffers: { offerId: string; name: string }[] | null;
  audienceText: string;
  segments: DraftProposal[];
  pickedSegments: number[];
  levers: Record<LeverKey, string>;
  leverIndex: number;
  legKey: NewOrgLegKey;
  budget: string;
}

export function newOrgDraftKey(orgId: string): string {
  return `distribute:new-org-draft:v1:${orgId}`;
}

export function serializeNewOrgDraft(d: NewOrgDraft): string {
  return JSON.stringify(d);
}

const isStr = (v: unknown): v is string => typeof v === "string";
const isProposals = (v: unknown): v is DraftProposal[] =>
  Array.isArray(v) && v.every((p) => p !== null && typeof p === "object" && isStr((p as { name?: unknown }).name));

/** The stored draft for THIS org, or null when absent, stale, foreign or malformed. */
export function parseNewOrgDraft(raw: string | null, orgId: string, now: number): NewOrgDraft | null {
  if (!raw) return null;
  let d: Partial<NewOrgDraft>;
  try {
    d = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!d || d.v !== 1 || d.orgId !== orgId || !isStr(d.brandId) || !d.brandId) return null;
  if (typeof d.savedAt !== "number" || now - d.savedAt > NEW_ORG_DRAFT_MAX_AGE_MS) return null;
  if (!NEW_ORG_STEPS.includes(d.step as NewOrgStep)) return null;
  if (!isStr(d.website) || !isStr(d.brandName) || !isStr(d.offerText) || !isStr(d.audienceText) || !isStr(d.budget)) return null;
  if (!isProposals(d.offerProposals) || !isProposals(d.segments)) return null;
  if (!Array.isArray(d.pickedSegments) || !d.levers || typeof d.levers !== "object") return null;
  if (typeof d.hasWebsite !== "boolean" || typeof d.pickedOfferIndex !== "number" || typeof d.leverIndex !== "number") return null;
  if (d.legKey !== "start_to_website_visit" && d.legKey !== "start_to_conversation") return null;
  return d as NewOrgDraft;
}

/**
 * Where a reopened modal lands. The org already exists (never its step), a launch is
 * never replayed on its own (back to the plan), and a step whose input is gone goes back
 * to the screen that produces it.
 */
export function resumeStep(d: NewOrgDraft): NewOrgStep {
  if (d.step === "org") return "brand";
  if (d.step === "launching") return "plan";
  const at = NEW_ORG_STEPS.indexOf(d.step);
  const hasOffers = d.offerProposals.length > 0 || (d.existingOffers?.length ?? 0) > 0;
  if (d.step === "offerPick" && !hasOffers) return "offerText";
  if (at > NEW_ORG_STEPS.indexOf("offerPick") && !d.offerId) return d.existingOffers ? "offerPick" : "offerText";
  if (d.step === "audiencePick" && d.segments.length === 0) return "audienceText";
  if (at > NEW_ORG_STEPS.indexOf("audiencePick") && d.pickedSegments.length === 0) return "audienceText";
  return d.step;
}
