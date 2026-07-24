import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { validateDestination } from "../src/lib/click-destination-validation";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

describe("validateDestination — must be on the brand domain", () => {
  const domain = "acme.com";

  it("accepts the bare brand domain", () => {
    const r = validateDestination("acme.com", domain);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url).toBe("https://acme.com/");
  });

  it("accepts a path on the brand domain", () => {
    const r = validateDestination("https://acme.com/pricing", domain);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url).toBe("https://acme.com/pricing");
  });

  it("accepts a subdomain of the brand domain", () => {
    expect(validateDestination("https://blog.acme.com/post", domain).ok).toBe(true);
  });

  it("treats www as the bare domain on both sides", () => {
    expect(validateDestination("https://www.acme.com/x", domain).ok).toBe(true);
    expect(validateDestination("https://acme.com/x", "www.acme.com").ok).toBe(true);
  });

  it("rejects an off-domain URL", () => {
    const r = validateDestination("https://evil.com/phish", domain);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("acme.com");
  });

  it("rejects a lookalike domain (suffix not on a dot boundary)", () => {
    expect(validateDestination("https://notacme.com", domain).ok).toBe(false);
    expect(validateDestination("https://acme.com.evil.com", domain).ok).toBe(false);
  });

  it("rejects non-http(s) protocols", () => {
    expect(validateDestination("javascript:alert(1)", domain).ok).toBe(false);
    expect(validateDestination("ftp://acme.com", domain).ok).toBe(false);
  });

  it("rejects empty input", () => {
    expect(validateDestination("   ", domain).ok).toBe(false);
  });
});

describe("validateDestination — WhatsApp links are accepted off-domain", () => {
  const domain = "acme.com";

  it("accepts a wa.me link with a pre-filled message", () => {
    const r = validateDestination(
      "https://wa.me/6287779242054?text=Hello",
      domain,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url).toContain("wa.me/6287779242054");
  });

  it("accepts the other WhatsApp hosts", () => {
    expect(validateDestination("https://api.whatsapp.com/send?phone=1555", domain).ok).toBe(true);
    expect(validateDestination("https://chat.whatsapp.com/ABC123", domain).ok).toBe(true);
    expect(validateDestination("https://whatsapp.com/x", domain).ok).toBe(true);
  });

  it("still rejects a non-WhatsApp off-domain URL", () => {
    const r = validateDestination("https://evil.com/phish", domain);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("acme.com");
  });
});

describe("settings page wires the click-destination section", () => {
  const page = read(
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx",
  );
  it("renders BrandClickDestinationCard", () => {
    expect(page).toContain("BrandClickDestinationCard");
  });
});
