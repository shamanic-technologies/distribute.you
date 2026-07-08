/** Extract a bare domain from user input (strips protocol, path, query, etc.).
 *  Returns null if the input does not parse as a valid hostname containing a dot.
 *  Accepts bare domains ("example.com"), protocol-less hosts, and full URLs. */
export function extractDomain(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const hostname = new URL(withProtocol).hostname;
    if (!hostname || !hostname.includes(".")) return null;
    return hostname;
  } catch {
    return null;
  }
}

/** If the input URL carries a path beyond the root ("/"), return the full
 *  normalized URL (protocol + host + path + query). Used to pre-select a
 *  sub-page (e.g. "acme.com/pricing") as the outreach click destination.
 *  A bare domain or root path ("/") returns "" (→ homepage default). */
export function subpageDestinationFromUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const hasSubpage = (url.pathname && url.pathname !== "/") || Boolean(url.search);
    return hasSubpage ? url.toString() : "";
  } catch {
    return "";
  }
}
