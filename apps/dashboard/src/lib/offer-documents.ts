import { z } from "zod";

/**
 * Offer documents: files a client owns about ONE offer (a case study, a one-pager) that our
 * AI can attach to a reply when a prospect answers positively. brand-service owns them, the
 * gateway serves `/v1/brands/:id/offers/:offerId/documents`. Alias-free on purpose (unit tests).
 */
export const OfferDocumentSchema = z.object({
  id: z.string(),
  brandId: z.string(),
  offerId: z.string(),
  fileName: z.string(),
  description: z.string(),
  contentType: z.string(),
  sizeBytes: z.coerce.number(),
  sha256: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type OfferDocument = z.infer<typeof OfferDocumentSchema>;

export const OfferDocumentsResponseSchema = z.object({ documents: z.array(OfferDocumentSchema) });
export const OfferDocumentWriteResponseSchema = z.object({ document: OfferDocumentSchema });

/** The file types brand-service accepts (its extension decides the type). For the file picker only. */
export const OFFER_DOCUMENT_ACCEPT =
  ".pdf,.docx,.pptx,.xlsx,.doc,.ppt,.xls,.csv,.txt,.md,.png,.jpg,.jpeg,.gif,.webp";

/** A size in plain words: "820 KB", "1.4 MB". Pure formatting of the served byte count. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/**
 * What a refused upload or edit says, in plain words, from brand-service's `reason` (and
 * the status for a body the gateway refused before brand-service saw it).
 */
export function offerDocumentRefusal(status: number | null, reason: string | null): string {
  if (reason === "file_too_large" || status === 413) return "This file is over 5 MB. Send a smaller one.";
  if (reason === "too_many_documents") return "This offer already holds 25 files. Remove one first.";
  if (reason === "unsupported_type")
    return "We can't send this type of file. Use a PDF, Word, PowerPoint, Excel, CSV, text or image file.";
  if (reason === "content_does_not_match_type")
    return "The file does not match its extension. Export it again and retry.";
  if (reason === "empty_file") return "This file is empty.";
  if (reason === "invalid_file_name") return "This file name can't be used. Rename it and retry.";
  if (reason === "invalid_description") return "Say in one line when it helps, up to 1000 characters.";
  if (reason === "missing_file") return "Pick a file first.";
  return "Not saved. Try again.";
}
