export interface GmailBodyPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name?: string; value?: string }>;
  body?: {
    size?: number;
    data?: string;
    attachmentId?: string;
  };
  parts?: GmailBodyPart[];
}

export interface GmailPayloadFull {
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name?: string; value?: string }>;
  body?: {
    size?: number;
    data?: string;
    attachmentId?: string;
  };
  parts?: GmailBodyPart[];
}

export interface ParsedAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string | null;
}

export interface ParsedGmailBody {
  html: string | null;
  text: string | null;
  attachments: ParsedAttachment[];
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const padded = normalized + padding;
  if (typeof atob === "function") {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }
  return Buffer.from(padded, "base64").toString("utf-8");
}

function isAttachment(part: GmailBodyPart): boolean {
  if (part.filename && part.filename.length > 0) return true;
  if (part.body?.attachmentId) return true;
  return false;
}

function walk(
  part: GmailBodyPart | GmailPayloadFull,
  acc: { html: string | null; text: string | null; attachments: ParsedAttachment[] }
): void {
  if (!part) return;

  if (isAttachment(part as GmailBodyPart)) {
    const filename = part.filename ?? "";
    const mimeType = part.mimeType ?? "application/octet-stream";
    const size = part.body?.size ?? 0;
    const attachmentId = part.body?.attachmentId ?? null;
    acc.attachments.push({ filename, mimeType, size, attachmentId });
    return;
  }

  const mime = (part.mimeType ?? "").toLowerCase();
  const data = part.body?.data;

  if (mime === "text/html" && typeof data === "string" && data.length > 0 && acc.html === null) {
    acc.html = decodeBase64Url(data);
  } else if (
    mime === "text/plain" &&
    typeof data === "string" &&
    data.length > 0 &&
    acc.text === null
  ) {
    acc.text = decodeBase64Url(data);
  }

  if (Array.isArray(part.parts)) {
    for (const child of part.parts) walk(child, acc);
  }
}

export function parseGmailBody(payload: GmailPayloadFull | undefined | null): ParsedGmailBody {
  const acc: ParsedGmailBody = { html: null, text: null, attachments: [] };
  if (!payload) return acc;
  walk(payload, acc);
  return acc;
}
