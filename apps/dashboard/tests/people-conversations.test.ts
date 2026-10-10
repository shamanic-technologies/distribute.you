import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PeopleListSchema,
  PersonTimelineSchema,
  personChannels,
  personName,
  sourceLabel,
  sourceLine,
  personStatusLabel,
  possibleLeadHint,
  stateLabel,
  timelineSourceNote,
} from "../src/lib/people-conversations";

const SRC = join(__dirname, "..", "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

// Shaped on crm-service's served openapi (PeopleListResponse / PersonTimelineResponse, v. #42).
const person = {
  personKey: "email:alice@acme.com",
  identityKeys: ["email:alice@acme.com", "phone:+33612345678"],
  displayName: "Alice Martin",
  company: "Acme",
  emails: ["alice@acme.com"],
  phones: ["+33612345678"],
  sources: ["gmail", "instantly", "matrix"],
  firstActivityAt: "2026-09-01T10:00:00.000Z",
  lastActivityAt: "2026-09-30T10:00:00.000Z",
  state: "sales_interest",
  stateSource: "lead_service",
  stateDetail: null,
  presences: [
    { source: "gmail", sourceRef: "alice@acme.com", displayName: null, emails: ["alice@acme.com"], phones: [], firstActivityAt: null, lastActivityAt: null, messageCount: 3, inboundCount: 1, outboundCount: 2, channel: "email" },
    { source: "instantly", sourceRef: "alice@acme.com", displayName: null, emails: ["alice@acme.com"], phones: [], firstActivityAt: null, lastActivityAt: null, messageCount: null, inboundCount: null, outboundCount: null, channel: "email" },
    { source: "matrix", sourceRef: "c1", displayName: "Alice", emails: [], phones: ["+33612345678"], firstActivityAt: null, lastActivityAt: null, messageCount: 4, inboundCount: 2, outboundCount: 2, channel: "whatsapp" },
  ],
  mergeEvidence: [{ kind: "google_contact" }],
};

const list = {
  brandId: "11111111-1111-4111-8111-111111111111",
  scope: { status: "built", lastBuiltAt: "2026-10-01T08:00:00.000Z", lastError: null },
  sources: [
    { source: "gmail", status: "ok", scope: "org", people: 120, presences: 124, sourceCount: 124, sourceCountBasis: "correspondents", error: null },
    { source: "gohighlevel", status: "not_connected", scope: "brand", people: 0, presences: 0, sourceCount: null, sourceCountBasis: null, error: null },
    { source: "matrix", status: "failed", scope: "brand", people: 0, presences: 0, sourceCount: null, sourceCountBasis: null, error: "homeserver unreachable" },
    { source: "posthog", status: null, scope: "brand", people: 0, presences: 0, sourceCount: null, sourceCountBasis: null, error: null },
  ],
  mergeEvidence: [],
  total: 1,
  limit: 100,
  offset: 0,
  nextOffset: null,
  people: [person],
};

describe("people list parse", () => {
  it("parses the served shape", () => {
    expect(PeopleListSchema.safeParse(list).success).toBe(true);
  });

  it("accepts a source the producer adds later (no closed enum)", () => {
    const later = { ...list, people: [{ ...person, sources: [...person.sources, "stripe"], state: "paying" }] };
    expect(PeopleListSchema.safeParse(later).success).toBe(true);
  });
});

describe("source lines keep absent, empty and failed apart", () => {
  it("says how many people a source brought, without the producer's staff wording", () => {
    expect(sourceLine(PeopleListSchema.parse(list).sources[0])).toEqual({ tone: "ok", text: "Gmail: 120 people" });
  });
  it("says not connected, failed and not read yet in words", () => {
    const s = PeopleListSchema.parse(list).sources;
    expect(sourceLine(s[1])).toEqual({ tone: "off", text: "GoHighLevel: not connected" });
    expect(sourceLine(s[2])).toEqual({ tone: "failed", text: "Messaging apps: could not be read (homeserver unreachable)" });
    expect(sourceLine(s[3])).toEqual({ tone: "pending", text: "PostHog: not read yet" });
  });
  it("names Gmail's org scope when it is not connected", () => {
    const s = { ...list.sources[0], status: "not_connected" };
    expect(sourceLine(s).text).toBe("Gmail: not connected on this organization");
  });
});

describe("labels only re-case the producer's words", () => {
  it("re-cases the served state", () => {
    expect(stateLabel("sales_interest")).toBe("Sales interest");
    expect(stateLabel("deal_won")).toBe("Deal won");
  });
  it("shows a status only when lead-service decided it (owner 2026-10-08: no Deal open)", () => {
    expect(personStatusLabel({ state: "sales_interest", stateSource: "lead_service" })).toBe("Sales interest");
    expect(personStatusLabel({ state: "deal_open", stateSource: "gohighlevel" })).toBeNull();
    expect(personStatusLabel({ state: "paid", stateSource: "stripe" })).toBeNull();
    expect(personStatusLabel({ state: "replied", stateSource: "instantly" })).toBeNull();
    expect(personStatusLabel({ state: "in_conversation", stateSource: "none" })).toBeNull();
  });
  it("reads an unknown source as its own id", () => {
    expect(sourceLabel("hubspot")).toBe("Hubspot");
  });
  it("names the person, else their first address", () => {
    expect(personName(person)).toBe("Alice Martin");
    expect(personName({ ...person, displayName: null })).toBe("alice@acme.com");
  });
  it("lists each channel once", () => {
    expect(personChannels(person)).toEqual(["email", "whatsapp"]);
  });
});

describe("timeline", () => {
  const timeline = {
    brandId: list.brandId,
    person,
    builtAt: "2026-10-01T08:00:00.000Z",
    sources: [
      { source: "gmail", status: "ok", items: 2, error: null, asked: ["alice@acme.com"] },
      { source: "instantly", status: "empty", items: 0, error: null, asked: [] },
      { source: "gohighlevel", status: "not_connected", items: 0, error: null, asked: [] },
      { source: "matrix", status: "failed", items: 0, error: "timeout", asked: ["c1"] },
    ],
    itemCount: 2,
    items: [
      { at: "2026-09-01T10:00:00.000Z", source: "gmail", channel: "email", kind: "message", direction: "outbound", subject: "Hi", text: "Hello Alice", from: "kevin@distribute.you", to: ["alice@acme.com"], ref: { messageId: "m1" }, event: null },
      { at: null, source: "gohighlevel", channel: "crm", kind: "event", direction: null, subject: null, text: null, from: null, to: [], ref: {}, event: { step: "meeting_booked", dateBasis: "appointment", detail: {} } },
    ],
  };
  it("parses the served shape", () => {
    expect(PersonTimelineSchema.safeParse(timeline).success).toBe(true);
  });
  it("explains only the sources that failed, never one left unconnected", () => {
    const notes = PersonTimelineSchema.parse(timeline).sources.map(timelineSourceNote);
    expect(notes).toEqual([null, null, null, "Messaging apps could not be read: timeout."]);
  });
  it("keeps google-service's clean verdict and the original body (crm-service #51)", () => {
    const withClean = {
      ...timeline,
      items: [
        { ...timeline.items[0], text: "Yes, send the deck.", textClean: { status: "cleaned", cleaned: true, original: "Yes, send the deck.\n\nOn Mon, Kevin wrote:\n> Hi" } },
        { ...timeline.items[0], textClean: { status: "judge_failed", cleaned: false, original: "Hello Alice" } },
        { ...timeline.items[1], textClean: null },
      ],
    };
    const items = PersonTimelineSchema.parse(withClean).items;
    expect(items[0].textClean).toEqual(withClean.items[0].textClean);
    expect(items[1].textClean?.cleaned).toBe(false);
    expect(items[2].textClean).toBeNull();
  });
});

describe("wiring", () => {
  it("reads people through the gateway and parses them", () => {
    const api = read("lib/api.ts");
    expect(api).toContain("`/orgs/people?${qs.toString()}`");
    expect(api).toContain("`/orgs/people/timeline?${qs.toString()}`");
    expect(api).toContain("PeopleListSchema.safeParse(raw)");
    expect(api).toContain("PersonTimelineSchema.safeParse(raw)");
  });
  it("fills the panel on desktop: only the list and the thread scroll, never the page (owner 2026-10-08)", () => {
    expect(read("components/v2/unibox-page.tsx")).toContain("lg:flex lg:h-full lg:flex-col");
    const view = read("components/v2/integrations-conversations.tsx");
    expect(view).toContain("lg:grid-rows-[minmax(0,1fr)]");
    expect(view.match(/min-h-\[420px\] flex-col overflow-hidden lg:max-h-none/g)?.length).toBe(2);
  });
  it("is the Unibox, staff mode only, under Records (owner 2026-10-08)", () => {
    const page = read("app/(authed)/v2/orgs/[orgId]/brands/[brandId]/unibox/page.tsx");
    expect(page).toContain("<StaffOnly>");
    expect(page).toContain("<UniboxPage />");
    expect(read("components/v2/unibox-page.tsx")).toContain("<V2ConversationsView brandId={brandId} />");
    const shell = read("components/v2/v2-shell.tsx");
    const at = shell.indexOf('href={v2Href(orgId, brandId, "unibox")}');
    expect(at).toBeGreaterThan(shell.indexOf('href={v2Href(orgId, brandId, "deals")}'));
    expect(at).toBeLessThan(shell.indexOf('href={v2Href(orgId, brandId, "workflows")}'));
    expect(shell.slice(at - 80, at)).toContain("{staffMode && (");
  });
  it("is no longer a tab of Integrations; its old URL redirects to the Unibox", () => {
    expect(read("components/v2/setup-pages.tsx")).not.toContain("V2ConversationsView");
    const old = read("app/(authed)/v2/orgs/[orgId]/brands/[brandId]/integrations/conversations/page.tsx");
    expect(old).toContain("redirect(");
    expect(old).toContain("/unibox`");
  });
  it("never writes back to a source", () => {
    const view = read("components/v2/integrations-conversations.tsx");
    for (const banned of ["useMutation", "apiCall", "fetch("]) expect(view).not.toContain(banned);
  });
});

describe("where a record came from", () => {
  it("names our own sends and visits Distribute, every other source by its vendor", async () => {
    const { sourceMark } = await import("../src/lib/conversation-sources");
    expect(sourceMark("instantly", "email").name).toBe("Distribute");
    expect(sourceMark("posthog", "web").name).toBe("Distribute");
    expect(sourceMark("gmail", "email").domain).toBe("gmail.com");
    expect(sourceMark("matrix", "whatsapp").domain).toBe("whatsapp.com");
    expect(sourceMark("matrix", "linkedin").domain).toBe("linkedin.com");
    expect(sourceMark("stripe", "payment").domain).toBe("stripe.com");
    expect(sourceMark("brand_new_source", "email")).toMatchObject({ domain: null, src: null });
  });
  it("lists each mark once per person", async () => {
    const { personSourceMarks } = await import("../src/lib/conversation-sources");
    const marks = personSourceMarks([
      { source: "instantly", channel: "email" },
      { source: "posthog", channel: "web" },
      { source: "gmail", channel: "email" },
    ]);
    expect(marks.map((m) => m.name)).toEqual(["Distribute", "Gmail"]);
  });
  it("finds a company logo only behind a work address", async () => {
    const { personCompanyDomain } = await import("../src/lib/conversation-sources");
    expect(personCompanyDomain(["jo@gmail.com", "jo@acme.io"])).toBe("acme.io");
    expect(personCompanyDomain(["jo@gmail.com"])).toBeNull();
  });
});

describe("search (crm-service q, #56)", () => {
  it("asks crm-service, keyed on the query, never filters in the browser", () => {
    const api = read("lib/api.ts");
    expect(api).toContain('if (opts.q) qs.set("q", opts.q);');
    const view = read("components/v2/integrations-conversations.tsx");
    // The family filter rides the same key and read (lead-families.test.ts).
    expect(view).toContain('queryKey: ["people", brandId, "scroll", q, f]');
    expect(view).toContain("offset: pageParam, q, family:");
    expect(view).not.toContain("people.filter(");
  });
  it("keeps why each person matched", () => {
    const parsed = PeopleListSchema.parse({
      ...list,
      search: { q: "deck", messageIndex: { units: 1, indexed: 1, failed: 0, messages: 3, lastIndexedAt: null }, tookMs: 12 },
      people: [{ ...person, matches: [{ field: "message", source: "gmail", at: null, direction: "inbound", subject: "Re: hi", excerpt: "send the deck", ref: {} }], messageMatches: 2 }],
    });
    expect(parsed.people[0].matches?.[0].excerpt).toBe("send the deck");
    expect(parsed.people[0].messageMatches).toBe(2);
  });
});

describe("who wrote a message", () => {
  it("reads the name and address of a from header", async () => {
    const { parseFrom } = await import("../src/lib/conversation-sources");
    expect(parseFrom('"Christina Kennedy" <Christina@WellConnectedChiro.com>')).toEqual({ name: "Christina Kennedy", email: "christina@wellconnectedchiro.com" });
    expect(parseFrom("bria@ariacoreco.com")).toEqual({ name: null, email: "bria@ariacoreco.com" });
    expect(parseFrom(null)).toEqual({ name: null, email: null });
  });
  it("puts the sender's mark up front on their side, the source's on ours", () => {
    const view = read("components/v2/integrations-conversations.tsx");
    const msg = view.slice(view.indexOf("function Message("), view.indexOf("function SourcesStrip("));
    expect(msg).toContain("<PersonMark name={sender.name ?? sender.email");
    expect(msg.indexOf("{outbound ? (")).toBeLessThan(msg.indexOf("<PersonMark"));
  });
  it("shows the address every message was written from, beside the name", () => {
    // A person writes from several mailboxes (Twin Health, then her own practice):
    // the name alone hid which one (owner 2026-10-09).
    const view = read("components/v2/integrations-conversations.tsx");
    const msg = view.slice(view.indexOf("function Message("), view.indexOf("function MatchLine("));
    expect(msg).toContain("{sender.name && sender.email && <span");
    expect(msg).toContain("{sender.email}</span>");
  });
  it("opens the person on top when none is picked", () => {
    const view = read("components/v2/integrations-conversations.tsx");
    expect(view).toContain("if (!openKey || newSearch) open(first);");
    expect(view).toContain("listQ.isPlaceholderData ? null : (people?.[0] ?? null)");
  });
});

describe("the list scrolls, never pages (owner 2026-10-08)", () => {
  it("loads the next rows as the end comes into view", () => {
    const view = read("components/v2/integrations-conversations.tsx");
    expect(view).toContain("getNextPageParam: (last: { nextOffset?: number | null }) => last.nextOffset ?? undefined");
    expect(view).toContain("new IntersectionObserver(");
    expect(view).not.toContain("Previous");
  });
});

describe("a thread opens from memory (owner 2026-10-08: instant)", () => {
  it("preloads the top rows and the row under the pointer, on the Thread's own key", () => {
    const view = read("components/v2/integrations-conversations.tsx");
    expect(view).toContain("queryKey: timelineKey(brandId, p.personKey)");
    expect(view).toContain("useAuthQuery(timelineKey(brandId, personKey)");
    expect(view).toContain("preload(p);");
    expect(view).toContain(".slice(0, PRELOAD_TOP)");
  });
  it("preloads the lead-service facts with the thread, on the Thread's own facts key", () => {
    const view = read("components/v2/integrations-conversations.tsx");
    expect(view).toContain("queryKey: factsKey(leadRowId, brandId, offerId)");
    expect(view).toContain("factsKey(leadRowId, brandId, offerId),\n    () => getLeadTimeline");
    // The Thread does not wait for its own timeline to learn the lead row.
    expect(view).toContain(": listed ? personLeadRowId(listed) : null;");
  });
  it("a click rewrites the URL without a Next navigation (owner 2026-10-08: too slow)", () => {
    const view = read("components/v2/integrations-conversations.tsx");
    expect(view).toContain("window.history.replaceState(");
    expect(view).not.toContain("router.replace(");
  });
});

describe("a guessed pairing with a lead is a hint, never a merge (crm-service v0.24.0)", () => {
  const brice = { crmContactId: "c-1", email: "drjackson@mabnr.com", fullName: "Brice Jackson", company: "MABNR" };

  it("parses possibleLeads and keeps it on the person", () => {
    const parsed = PeopleListSchema.parse({ ...list, people: [{ ...person, possibleLeads: [brice] }] });
    expect(parsed.people[0].possibleLeads).toEqual([brice]);
  });

  it("states the lead by name and the address lead-service serves", () => {
    expect(possibleLeadHint({ possibleLeads: [brice] })).toBe(
      "Maybe the same as Brice Jackson (drjackson@mabnr.com), to confirm",
    );
  });

  it("names every guessed lead, falling back to whichever of name or address is served", () => {
    expect(
      possibleLeadHint({ possibleLeads: [brice, { crmContactId: "c-1", email: "b@x.com", fullName: null, company: null }] }),
    ).toBe("Maybe the same as Brice Jackson (drjackson@mabnr.com) or b@x.com, to confirm");
  });

  it("says nothing for a person without a guessed pairing", () => {
    expect(possibleLeadHint({})).toBeNull();
    expect(possibleLeadHint({ possibleLeads: [] })).toBeNull();
    expect(possibleLeadHint({ possibleLeads: [{ crmContactId: "c-1", email: null, fullName: null, company: null }] })).toBeNull();
  });

  it("the copy carries no dash", () => {
    expect(possibleLeadHint({ possibleLeads: [brice] })).not.toMatch(/[\u2014\u2013]/);
  });

  it("shows the hint on the list row AND in the thread header, never merging rows", () => {
    const src = read("components/v2/integrations-conversations.tsx");
    expect(src.match(/<PossibleLeadLine person=\{person\} \/>/g)?.length).toBe(2);
  });
});
