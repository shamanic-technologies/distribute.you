/**
 * Sets an identity-enrichment header (x-org-name, x-first-name, x-last-name, x-email)
 * only when the value can legally go on the wire, and leaves it ABSENT otherwise.
 *
 * Node's fetch rejects any header value holding a character above U+00FF
 * ("Cannot convert argument to a ByteString"), and it throws before the request
 * leaves, so one org or user named in CJK, Cyrillic or with an emoji would fail
 * the WHOLE proxied request. These headers are optional enrichment: dropping one
 * costs nothing, failing the request costs the page. Latin-1 values (é, ü, ñ) are
 * legal and are sent byte-for-byte; Node decodes them back the same way on the
 * gateway side. Never transform or transliterate: verbatim or nothing.
 */
export function setIdentityHeader(
  headers: Record<string, string>,
  key: string,
  value: string | null | undefined,
): void {
  if (!value) return;
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 0xff) return;
  }
  headers[key] = value;
}
