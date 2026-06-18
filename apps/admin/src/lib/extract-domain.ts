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
