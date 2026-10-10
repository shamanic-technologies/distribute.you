import { describe, expect, it } from "vitest";
import { parsePastedHeaders, sessionValues, type SessionField } from "../src/lib/browser-session-paste";

// LinkedIn's cookies step as crm-service served it in prod (2026-10-10), trimmed to 4 fields.
const FIELDS: SessionField[] = [
  { id: "fi.mau.linkedin.login.cookie_header", required: true, pattern: "\\bJSESSIONID=[^;]+", sources: [{ type: "request_header", name: "Cookie" }] },
  { id: "fi.mau.linkedin.login.x_li_track", required: true, pattern: "clientVersion", sources: [{ type: "request_header", name: "X-LI-Track" }] },
  { id: "fi.mau.linkedin.login.x_li_page_instance", required: true, pattern: "urn:li:page", sources: [{ type: "request_header", name: "X-LI-Page-Instance" }] },
  {
    id: "fi.mau.linkedin.login.header.user-agent",
    required: false,
    pattern: null,
    sources: [
      { type: "request_header", name: "User-Agent" },
      { type: "special", name: "fi.mau.linkedin.login.header.user-agent" },
    ],
  },
];

const CHROME_CURL = `curl 'https://www.linkedin.com/voyager/api/me' \\
  -H 'accept: application/vnd.linkedin.normalized+json+2.1' \\
  -b 'li_at=AQE123; JSESSIONID="ajax:456"; lang=v=2&lang=en-us' \\
  -H 'user-agent: Mozilla/5.0 (Macintosh)' \\
  -H $'x-li-page-instance: urn:li:page:d_flagship3_feed;abc\\'d' \\
  -H 'x-li-track: {"clientVersion":"1.13.1","mpVersion":"1.13.1"}'`;

describe("reading a LinkedIn session out of a paste", () => {
  it("reads a Chrome 'Copy as cURL' (cookies on -b, $'…' quoting, line joins)", () => {
    const h = parsePastedHeaders(CHROME_CURL);
    expect(h.get("cookie")).toBe('li_at=AQE123; JSESSIONID="ajax:456"; lang=v=2&lang=en-us');
    expect(h.get("x-li-page-instance")).toBe("urn:li:page:d_flagship3_feed;abc'd");
    const { values, missing } = sessionValues(FIELDS, h);
    expect(missing).toEqual([]);
    expect(values["fi.mau.linkedin.login.x_li_track"]).toBe('{"clientVersion":"1.13.1","mpVersion":"1.13.1"}');
    expect(values["fi.mau.linkedin.login.header.user-agent"]).toBe("Mozilla/5.0 (Macintosh)");
  });

  it("reads a Firefox cURL (Cookie as a header, double quotes)", () => {
    const h = parsePastedHeaders(
      `curl "https://www.linkedin.com/voyager/api/me" -H "Cookie: JSESSIONID=\\"ajax:1\\"; li_at=x" -H "X-LI-Track: {\\"clientVersion\\":\\"1\\"}" -H "X-LI-Page-Instance: urn:li:page:feed"`,
    );
    expect(sessionValues(FIELDS, h).missing).toEqual([]);
    expect(h.get("cookie")).toBe('JSESSIONID="ajax:1"; li_at=x');
  });

  it("reads raw request headers copied from the Headers tab", () => {
    const h = parsePastedHeaders(
      ":authority: www.linkedin.com\ncookie: JSESSIONID=\"ajax:1\"; li_at=x\nx-li-track: {\"clientVersion\":\"1\"}\nx-li-page-instance: urn:li:page:feed\n",
    );
    expect(sessionValues(FIELDS, h).missing).toEqual([]);
  });

  it("names what the paste lacks, and drops a value that fails the field's pattern", () => {
    const h = parsePastedHeaders(`curl 'https://www.linkedin.com/feed/' -b 'li_at=x' -H 'x-li-track: nope'`);
    const { values, missing } = sessionValues(FIELDS, h);
    expect(missing).toEqual(["Cookie", "X-LI-Track", "X-LI-Page-Instance"]);
    expect(values).toEqual({});
  });

  it("reads a field whose source is a cookie by name", () => {
    const h = parsePastedHeaders("Cookie: a=1; li_at=TOKEN; b=2");
    const { values } = sessionValues([{ id: "t", required: true, pattern: null, sources: [{ type: "cookie", name: "li_at" }] }], h);
    expect(values).toEqual({ t: "TOKEN" });
  });
});
