export interface GmailHeader {
  name?: string;
  value?: string;
}

export interface GmailPayloadShape {
  headers?: GmailHeader[];
  snippet?: string;
}

export interface GmailMessageShape {
  id?: string;
  snippet?: string;
  payload?: GmailPayloadShape;
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
  const headers = message.payload?.headers;
  const snippet = message.payload?.snippet ?? message.snippet;
  return {
    subject: findHeader(headers, "Subject"),
    from: findHeader(headers, "From"),
    date: findHeader(headers, "Date"),
    snippet: typeof snippet === "string" ? snippet : null,
  };
}
