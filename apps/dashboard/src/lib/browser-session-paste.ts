/**
 * Reads a browser session out of what the customer pastes, for a messaging app whose
 * login step asks for it (LinkedIn's bridge: the Cookie header plus two LinkedIn
 * headers, read from a request the logged-in browser sends to linkedin.com).
 *
 * A web page cannot read another site's cookies, so the customer copies one request
 * from their browser's network tools ("Copy as cURL", or the raw request headers) and
 * we pick out the values the step asks for. WHICH values, and where each lives, is the
 * bridge's own field list served by crm-service: nothing here knows LinkedIn.
 *
 * Alias-free (unit-tested).
 */

export interface SessionField {
  id: string;
  required: boolean;
  sources: { type: string; name: string }[];
  pattern: string | null;
}

/** Header name (lowercase) -> value, from a "Copy as cURL" command or raw `Name: value` lines. */
export function parsePastedHeaders(text: string): Map<string, string> {
  const headers = new Map<string, string>();
  const add = (name: string, value: string) => {
    const key = name.trim().toLowerCase();
    if (!key) return;
    const prev = headers.get(key);
    // Two Cookie lines are one cookie jar; any other repeat keeps the first.
    if (prev === undefined) headers.set(key, value.trim());
    else if (key === "cookie") headers.set(key, `${prev}; ${value.trim()}`);
  };

  if (/^\s*curl\s/i.test(text)) {
    const args = shellWords(text);
    for (let i = 0; i < args.length; i++) {
      const flag = args[i];
      const next = args[i + 1];
      if (next === undefined) break;
      if (flag === "-H" || flag === "--header") {
        const at = next.indexOf(":");
        if (at > 0) add(next.slice(0, at), next.slice(at + 1));
        i++;
      } else if (flag === "-b" || flag === "--cookie") {
        add("cookie", next);
        i++;
      } else if (flag === "-A" || flag === "--user-agent") {
        add("user-agent", next);
        i++;
      }
    }
    return headers;
  }

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    // Pseudo-headers (`:authority:`) and the request line carry nothing we read.
    const at = line.indexOf(":");
    if (at <= 0) continue;
    add(line.slice(0, at), line.slice(at + 1));
  }
  return headers;
}

/** The value one cookie holds in a Cookie header, or null. */
function cookieValue(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const at = part.indexOf("=");
    if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return null;
}

/**
 * The answer to the login step: each field's value from the first source the paste
 * holds, kept only when it matches the field's pattern. `missing` lists the REQUIRED
 * fields the paste does not hold (by the header or cookie name the customer can look for).
 */
export function sessionValues(
  fields: SessionField[],
  headers: Map<string, string>,
): { values: Record<string, string>; missing: string[] } {
  const values: Record<string, string> = {};
  const missing: string[] = [];
  for (const field of fields) {
    let value: string | null = null;
    for (const source of field.sources) {
      if (source.type === "request_header") value = headers.get(source.name.toLowerCase()) ?? null;
      else if (source.type === "cookie") value = cookieValue(headers.get("cookie") ?? "", source.name);
      if (value && field.pattern && !new RegExp(field.pattern).test(value)) value = null;
      if (value) break;
    }
    if (value) values[field.id] = value;
    else if (field.required) missing.push(field.sources[0]?.name ?? field.id);
  }
  return { values, missing };
}

/** POSIX-shell word split, enough for a browser's "Copy as cURL": quotes, `\` escapes, `\` line joins. */
function shellWords(text: string): string[] {
  const words: string[] = [];
  let word = "";
  let inWord = false;
  let quote: "'" | '"' | "$'" | null = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote === "'") {
      if (c === "'") quote = null;
      else word += c;
      continue;
    }
    if (quote === "$'") {
      if (c === "'") quote = null;
      else if (c === "\\" && i + 1 < text.length) {
        const e = text[++i];
        word += e === "n" ? "\n" : e === "t" ? "\t" : e;
      } else word += c;
      continue;
    }
    if (quote === '"') {
      if (c === '"') quote = null;
      else if (c === "\\" && i + 1 < text.length && '"\\$`'.includes(text[i + 1])) word += text[++i];
      else word += c;
      continue;
    }
    if (c === "\\") {
      const next = text[i + 1];
      if (next === "\n" || next === "\r") {
        i += next === "\r" && text[i + 2] === "\n" ? 2 : 1;
        continue;
      }
      if (next !== undefined) {
        word += next;
        inWord = true;
        i++;
      }
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      inWord = true;
      continue;
    }
    // Chrome writes `$'…'` (backslash escapes) for values holding a quote.
    if (c === "$" && text[i + 1] === "'") {
      quote = "$'";
      inWord = true;
      i++;
      continue;
    }
    if (/\s/.test(c)) {
      if (inWord) words.push(word);
      word = "";
      inWord = false;
      continue;
    }
    word += c;
    inWord = true;
  }
  if (inWord) words.push(word);
  return words;
}
