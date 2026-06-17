import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

const componentPath = "../src/components/email-signature.tsx";

// Every surface where a sent / example email body is displayed to the user.
const renderSurfaces = [
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/campaigns/[id]/emails/page.tsx",
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/emails/page.tsx",
];

describe("EmailSignature component", () => {
  const src = read(componentPath);

  it("exports an EmailSignature component", () => {
    expect(src).toContain("export function EmailSignature");
  });

  it("contains the exact signature block", () => {
    expect(src).toContain("Kevin Lourd | Founder");
    expect(src).toContain("Distribute.you | Marketing Agency");
    expect(src).toContain("--"); // signature delimiter
  });

  it("is API-free so it is safe in the public-report bundle", () => {
    expect(src).not.toContain("@/lib/api");
  });
});

describe("EmailSignature is rendered on every sent/example email surface", () => {
  for (const rel of renderSurfaces) {
    it(`renders <EmailSignature in ${rel.split("/").slice(-2).join("/")}`, () => {
      const src = read(rel);
      expect(src).toContain("EmailSignature");
      expect(src).toContain("<EmailSignature");
    });
  }
});

describe("EmailSignature is NOT injected into the raw Gmail inbox viewer", () => {
  // The CRM Gmail panel shows real inbox messages (received + already-sent). A truly
  // sent message already carries the gateway-appended signature, and received messages
  // are not ours — appending here would double-sign or mislabel.
  it("CRM email-detail-panel does not render EmailSignature", () => {
    const src = read(
      "../src/app/(authed)/(dashboard)/orgs/[orgId]/services/crm/_components/email-detail-panel.tsx",
    );
    expect(src).not.toContain("EmailSignature");
  });
});
