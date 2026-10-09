import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  heldByProfile,
  isClientProfile,
  listsOfOrigin,
  listsOfProfile,
  originOf,
  profileOf,
  reachOfProfile,
  signalLabelOf,
  type ProfileListAudience,
  type SourcingOriginLike,
} from "../src/lib/profile-lists";

// The real offer behind the owner's example (brand d0965c2c, offer 70051e12), as human-service
// served it on 2026-10-09: 4 profiles, 2 per-profile hiring lists, archived whole-target lists.
const cold = (id: string, name: string, status: string): ProfileListAudience => ({
  id,
  name,
  status,
  profileAudienceId: null,
  filters: { person_titles: ["x"] },
  channels: [{ list: "apollo_search", signal: null }],
});
const signal = (id: string, name: string, status: string, profile: string | null, type = "hiring"): ProfileListAudience => ({
  id,
  name,
  status,
  profileAudienceId: profile,
  filters: { buying_signal: { type } },
  channels: [{ list: type === "linkedin_engagement" ? "linkedin_engagement" : "apollo_buying_signal", signal: { type } }],
});

const AUDIENCES = [
  cold("qa", "Heads of QA", "active"),
  cold("vp", "VPs of Quality Assurance", "active"),
  cold("cto", "Chief Technology Officers", "paused"),
  cold("eng", "Heads of Engineering", "paused"),
  signal("qa-h", "Heads of QA (Hiring now)", "paused", "qa"),
  signal("vp-h", "VPs of Quality Assurance (Hiring now)", "paused", "vp"),
  signal("hiring", "Hiring now", "archived", null),
  signal("role", "New in role", "archived", null, "job_change"),
  signal("li", "Engaged with competitor posts", "paused", null, "linkedin_engagement"),
];
const ORIGINS: SourcingOriginLike[] = [
  { slug: "sourcing-apollo-cold-filters", name: "Apollo Cold Filters", audienceLists: ["apollo_search"], live: true, displayOrder: 101, provider: null },
  { slug: "sourcing-apollo-buying-signals", name: "Apollo Buying Signals", audienceLists: ["apollo_buying_signal"], live: true, displayOrder: 102, provider: null },
  { slug: "sourcing-linkedin-engagement-signals", name: "LinkedIn Engagement Signals", audienceLists: ["linkedin_engagement"], live: true, displayOrder: 103, provider: null },
];
const byId = new Map(AUDIENCES.map((a) => [a.id, a]));

describe("profiles x sources", () => {
  it("Client profiles are the 4 cold profiles, no signal list", () => {
    expect(AUDIENCES.filter(isClientProfile).map((a) => a.id)).toEqual(["qa", "vp", "cto", "eng"]);
  });

  it("a list built for a profile is never a profile, even without a signal marker", () => {
    expect(isClientProfile({ ...cold("x", "X", "active"), profileAudienceId: "qa" })).toBe(false);
  });

  it("each list reads its profile and its source", () => {
    const l = byId.get("qa-h")!;
    expect(profileOf(l, byId)?.name).toBe("Heads of QA");
    expect(originOf(l, ORIGINS)?.name).toBe("Apollo Buying Signals");
    expect(signalLabelOf(l)).toBe("Hiring now");
    // A profile's own cold list is the profile, on the cold-filters source.
    expect(profileOf(byId.get("cto")!, byId)?.id).toBe("cto");
    expect(originOf(byId.get("cto")!, ORIGINS)?.name).toBe("Apollo Cold Filters");
    // An old whole-target list has no profile.
    expect(profileOf(byId.get("hiring")!, byId)).toBeNull();
  });

  it("a paused profile holds its lists; an active one does not", () => {
    const pausedProfile = { ...byId.get("qa")!, status: "paused" };
    expect(heldByProfile(byId.get("qa-h")!, pausedProfile)).toBe(true);
    expect(heldByProfile(byId.get("qa-h")!, byId.get("qa")!)).toBe(false);
    expect(heldByProfile(byId.get("cto")!, byId.get("cto")!)).toBe(false);
  });

  it("a profile is reached by its cold list and each live list built for it", () => {
    const reach = reachOfProfile(byId.get("qa")!, AUDIENCES, ORIGINS);
    expect(reach.map((r) => [r.origin?.name, r.signal])).toEqual([
      ["Apollo Cold Filters", null],
      ["Apollo Buying Signals", "Hiring now"],
    ]);
    expect(listsOfProfile("vp", AUDIENCES).map((a) => a.id)).toEqual(["vp-h"]);
  });

  it("a source lists one entry per profile, archived whole-target lists left out", () => {
    const signals = listsOfOrigin(ORIGINS[1], AUDIENCES, ORIGINS);
    expect(signals.map((a) => a.name)).toEqual(["Heads of QA (Hiring now)", "VPs of Quality Assurance (Hiring now)"]);
    expect(listsOfOrigin(ORIGINS[0], AUDIENCES, ORIGINS)).toHaveLength(4);
  });
});

describe("profiles x sources are wired on the three pages", () => {
  const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
  it("Client profiles keeps profiles only and shows their sources and lists", () => {
    const src = read("src/components/v2/audiences-table.tsx");
    expect(src).toContain("t.audiences.filter(isClientProfile)");
    expect(src).toContain("<ReachLine reach={reachOf(a)} />");
    expect(src).toContain("lists={plain ? listsOfProfile(selected.id, p.audiences) : []}");
  });
  it("Lists names each list's profile and source, archived behind a toggle", () => {
    const src = read("src/components/v2/audience-page.tsx");
    expect(src).toContain("const profile = profileOf(a, byId);");
    expect(src).toContain("const source = origin?.name ?? null;");
    expect(src).toContain('all.filter((a) => a.status !== "archived")');
  });
  it("Sourcing lists one entry per profile under each source", () => {
    expect(read("src/components/v2/offer-sourcing-page.tsx")).toContain("<OfferSourceLists brandId={brandId} offerId={offerId} />");
  });
  it("the audience reader keeps profileAudienceId", () => {
    expect(read("src/lib/api.ts")).toContain("profileAudienceId: z.string().nullish(),");
  });
});
