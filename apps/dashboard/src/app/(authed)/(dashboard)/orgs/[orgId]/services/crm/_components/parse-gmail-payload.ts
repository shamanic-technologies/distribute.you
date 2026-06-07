export interface GmailHeader {
  name?: string;
  value?: string;
}

export interface GmailInnerPayloadShape {
  headers?: GmailHeader[];
}

export interface GmailEnvelopeShape {
  snippet?: string;
  labelIds?: string[];
  threadId?: string;
  internalDate?: string;
  payload?: GmailInnerPayloadShape;
}

export interface GmailMessageShape {
  id?: string;
  snippet?: string;
  payload?: GmailEnvelopeShape;
}

export interface ParsedGmail {
  subject: string | null;
  from: string | null;
  date: string | null;
  snippet: string | null;
}

function findHeader(headers: GmailHeader[] | undefined, name: string): string | null {
  if (!headers) return null;
  const target = name.toLowerCase();
  for (const h of headers) {
    if (typeof h?.name === "string" && h.name.toLowerCase() === target) {
      return typeof h.value === "string" ? h.value : null;
    }
  }
  return null;
}

export function parseGmailPayload(message: GmailMessageShape): ParsedGmail {
  const envelope = message.payload;
  const headers = envelope?.payload?.headers;
  const snippet = envelope?.snippet ?? message.snippet;
  return {
    subject: findHeader(headers, "Subject"),
    from: findHeader(headers, "From"),
    date: findHeader(headers, "Date"),
    snippet: typeof snippet === "string" ? snippet : null,
  };
}
