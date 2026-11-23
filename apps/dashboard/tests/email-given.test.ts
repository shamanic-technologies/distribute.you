import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EMAIL_GIVEN_EVENT, recordEmailGiven, type PosthogLike } from "../src/lib/email-given";

// A visitor who asks for a sign-up code is a lead from that moment (owner 2026-11-24):
// the address goes on their PostHog person, which crm-service's PostHog connector
// mirrors into the Unibox, even when the code never reaches them.

function fakePosthog() {
  const people: Record<string, unknown>[] = [];
  const events: { event: string; props?: Record<string, unknown> }[] = [];
  const client: PosthogLike = {
    setPersonProperties: (p) => people.push(p),
    capture: (event, props) => events.push({ event, props }),
  };
  return { client, people, events };
}

describe("recordEmailGiven", () => {
  it("puts the typed address on the person and records the attempt", () => {
    const { client, people, events } = fakePosthog();
    recordEmailGiven(client, "  Jane@NetzRecruiter.com ", "get-started");
    expect(people).toEqual([{ email: "jane@netzrecruiter.com" }]);
    expect(events).toEqual([
      { event: EMAIL_GIVEN_EVENT, props: { email: "jane@netzrecruiter.com", surface: "get-started" } },
    ]);
  });

  it("keeps every address a visitor tries, one event each", () => {
    const { client, events } = fakePosthog();
    recordEmailGiven(client, "a@x.com", "get-started");
    recordEmailGiven(client, "b@x.com", "sign-up");
    expect(events.map((e) => e.props?.email)).toEqual(["a@x.com", "b@x.com"]);
  });

  it("records nothing for an empty field", () => {
    const { client, people, events } = fakePosthog();
    recordEmailGiven(client, "   ", "sign-up");
    expect(people).toEqual([]);
    expect(events).toEqual([]);
  });
});

describe("both code screens record the address BEFORE asking Clerk for a code", () => {
  const cases = [
    {
      file: "src/components/v2/get-started/account-card-wall.tsx",
      fn: "async function submitAccount(",
      call: 'recordEmailGiven(posthog, email, "get-started")',
    },
    {
      file: "src/app/(authed)/sign-up/[[...sign-up]]/page.tsx",
      fn: "const handleEmailSignUp = async",
      call: 'recordEmailGiven(posthog, email, "sign-up")',
    },
  ];
  for (const c of cases) {
    it(c.file, () => {
      const src = readFileSync(join(__dirname, "..", c.file), "utf8");
      const at = src.indexOf(c.fn);
      expect(at).toBeGreaterThan(-1);
      const call = src.indexOf(c.call, at);
      const create = src.indexOf("signUp.create(", at);
      expect(call).toBeGreaterThan(at);
      // Before the create: a captcha wait, a refusal or a code that never arrives
      // still leaves the address on record.
      expect(call).toBeLessThan(create);
    });
  }
});
