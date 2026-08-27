import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PAGE = readFileSync(
  join(__dirname, "../src/app/(authed)/(dashboard)/model/page.tsx"),
  "utf8",
);
const SIDEBAR = readFileSync(join(__dirname, "../src/components/context-sidebar.tsx"), "utf8");
const API = readFileSync(join(__dirname, "../src/lib/api.ts"), "utf8");
const LIB = readFileSync(join(__dirname, "../src/lib/acquisition-model.ts"), "utf8");

describe("the model page reads the catalogue, it does not keep one", () => {
  it("reads both published endpoints", () => {
    expect(PAGE).toContain("getPublicChannelCatalogue");
    expect(PAGE).toContain("getPublicChannelFunnelEconomics");
    expect(API).toContain("/public/channels");
    expect(API).toContain("/public/channel-funnel-economics");
  });

  it("hardcodes no channel slug and no funnel key", () => {
    // A local copy of another service's list rots silently, and the tell is
    // always the same: the copy is where the missing entries would go.
    for (const slug of [
      "sales-cold-email-outreach",
      "cold-call-outreach",
      "google-ads",
      "linkedin-ads",
    ]) {
      expect(PAGE).not.toContain(slug);
      expect(LIB).not.toContain(slug);
    }
    for (const key of ["sales_meetings_from_conversation", "website_purchases", "form_magnet"]) {
      expect(PAGE).not.toContain(key);
      expect(LIB).not.toContain(key);
    }
  });

  it("derives the funnel list and the matrix from the wire", () => {
    expect(PAGE).toContain("funnelCatalogueFrom(channels)");
    expect(PAGE).toContain("buildMatrixRows(channels, funnels");
  });

  it("reveals on SETTLE, so a failed read cannot skeleton the page forever", () => {
    expect(PAGE).toContain("catalogue.isPending && !catalogue.isError");
    expect(PAGE).toContain("economics.isPending && !economics.isError");
  });

  it("states every one of the four pair states apart", () => {
    // Collapsing them into one dash would answer four different questions with
    // one word: cannot be sold / nobody spent / no row served / here is the price.
    expect(PAGE).toContain('cell.kind === "not_sellable"');
    expect(PAGE).toContain('cell.kind === "unknown"');
    expect(PAGE).toContain('cell.kind === "unmeasured"');
    expect(PAGE).toContain("unmeasuredReasonLabel(cell.reason)");
  });

  it("renders served money through the shared formatters, deriving nothing", () => {
    expect(PAGE).toContain("fmtRoi(cell.returnPerDollar)");
    expect(PAGE).toContain("fmtUsd(cell.costPerSaleUsd)");
    // No browser-side arithmetic on a displayed stat.
    expect(PAGE).not.toMatch(/returnPerDollar\s*[*/+-]/);
    expect(PAGE).not.toMatch(/costPerSaleUsd\s*[*/+-]/);
  });

  it("carries no em-dash outside the honest not-measured dash", () => {
    // The repo bans the em-dash in user-facing copy; the "—" here is the
    // no-figure placeholder, so assert it never lands inside a sentence.
    for (const line of PAGE.split("\n")) {
      if (!line.includes("—")) continue;
      expect(line).toMatch(/["'`]—["'`]|: "—"|\? "—"/);
    }
  });
});

describe("the reader tracks the DEPLOYED catalogue contract", () => {
  // features-service widened the catalogue so a channel can state an INTERNAL leg. The step
  // vocabulary moved from `producibleSteps` to `steps` at the root in the same ship, and because
  // this reader declared the old name REQUIRED, the page threw on every load until it was
  // repointed. Pin the names the wire actually carries.
  const reader = API.slice(
    API.indexOf("const PublicChannelStepSchema"),
    API.indexOf("export async function getPublicChannelFunnelEconomics"),
  );

  it("reads the step vocabulary under the name the wire uses", () => {
    expect(reader).toContain("steps: z.array(PublicChannelStepSchema)");
    expect(reader).not.toContain("producibleSteps");
  });

  it("reads the leg and who operates the channel", () => {
    expect(reader).toContain("stepTransitions: z.array(PublicStepTransitionSchema)");
    expect(reader).toContain("operatedBy: z.string()");
    // `from` is null for an entry channel, and that is a value the producer means to send.
    expect(reader).toContain("from: PublicChannelStepSchema.nullable()");
  });
});

describe("the page states the leg, not only what a channel produces", () => {
  it("renders the leg and the operator", () => {
    expect(PAGE).toContain("row.legLabels");
    expect(PAGE).toContain("channelOperatorLabel(row.operatedBy)");
  });

  it("reads the root vocabulary under its wire name", () => {
    expect(PAGE).toContain("catalogue.data?.steps");
    expect(PAGE).not.toContain("catalogue.data?.producibleSteps");
  });
});

describe("the sidebar", () => {
  it("links the page from the Features section", () => {
    expect(SIDEBAR).toContain('href: "/model"');
    expect(SIDEBAR).toContain('pathname.startsWith("/model")');
    const features = SIDEBAR.slice(SIDEBAR.indexOf(">Features</h4>"));
    expect(features.slice(0, 600)).toContain('href: "/model"');
  });
});

describe("the reader keeps the growing vocabularies open", () => {
  it("does not close the family or step enums", () => {
    // Both sets are expected to grow (a channel converting a step in the MIDDLE
    // of a chain has no token yet); a closed enum would throw on that catalogue.
    const block = API.slice(API.indexOf("const PublicProducibleStepSchema"));
    const reader = block.slice(0, block.indexOf("export async function getPublicChannelFunnelEconomics"));
    expect(reader).not.toContain("z.enum");
  });
});
