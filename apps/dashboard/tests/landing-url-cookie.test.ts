import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  LANDING_URL_COOKIE,
  clearLandingUrlCookieString,
  landingUrlCookieString,
  normalizeLandingUrl,
  readLandingUrlCookie,
} from "../src/lib/landing-url-cookie";

/**
 * Real unit tests, not source-substring guards: `landing-url-cookie.ts` is
 * deliberately alias-free so it can be imported here. Keep it that way.
 */
describe("normalizeLandingUrl", () => {
  it("keeps the path, which is the whole point", () => {
    expect(normalizeLandingUrl("voozaa.app/us/")).toBe("https://voozaa.app/us/");
    expect(normalizeLandingUrl("https://acme.com/pricing")).toBe("https://acme.com/pricing");
  });

  it("adds a scheme to a bare host so the field shows a URL", () => {
    expect(normalizeLandingUrl("acme.com")).toBe("https://acme.com/");
  });

  it("keeps a query string", () => {
    expect(normalizeLandingUrl("acme.com/p?utm_source=x")).toBe(
      "https://acme.com/p?utm_source=x",
    );
  });

  it("refuses anything that is not a website", () => {
    expect(normalizeLandingUrl("")).toBeNull();
    expect(normalizeLandingUrl("   ")).toBeNull();
    expect(normalizeLandingUrl(null)).toBeNull();
    expect(normalizeLandingUrl(undefined)).toBeNull();
    expect(normalizeLandingUrl("localhost")).toBeNull();
    expect(normalizeLandingUrl("not a url")).toBeNull();
  });

  it("refuses a non-http scheme", () => {
    // A `javascript:` input parses fine and must never be stored, let alone
    // rendered back into a field a person then submits.
    expect(normalizeLandingUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeLandingUrl("data:text/html,<h1>x</h1>")).toBeNull();
    expect(normalizeLandingUrl("ftp://acme.com/x")).toBeNull();
  });

  it("refuses a URL long enough to bloat every request", () => {
    // The cookie rides every request to the origin, including each /api/v1 call.
    expect(normalizeLandingUrl(`https://acme.com/${"a".repeat(600)}`)).toBeNull();
  });
});

describe("cookie round-trip", () => {
  it("writes a readable cookie and reads the same URL back", () => {
    const cookie = landingUrlCookieString("voozaa.app/us/");
    expect(cookie).toContain(`${LANDING_URL_COOKIE}=`);
    expect(cookie).toContain("path=/");
    expect(cookie).toContain("SameSite=Lax");
    const value = cookie!.split(";")[0];
    expect(readLandingUrlCookie(value)).toBe("https://voozaa.app/us/");
  });

  it("survives sitting beside other cookies", () => {
    const header = `partnero_via=abc; ${LANDING_URL_COOKIE}=${encodeURIComponent("https://acme.com/x")}; other=1`;
    expect(readLandingUrlCookie(header)).toBe("https://acme.com/x");
  });

  it("returns null when it is absent", () => {
    expect(readLandingUrlCookie("partnero_via=abc")).toBeNull();
    expect(readLandingUrlCookie("")).toBeNull();
    expect(readLandingUrlCookie(null)).toBeNull();
  });

  it("re-normalizes on read, so a hand-edited cookie cannot poison the field", () => {
    expect(
      readLandingUrlCookie(`${LANDING_URL_COOKIE}=${encodeURIComponent("javascript:alert(1)")}`),
    ).toBeNull();
    expect(readLandingUrlCookie(`${LANDING_URL_COOKIE}=not%20a%20url`)).toBeNull();
  });

  it("writes nothing for an unusable value", () => {
    expect(landingUrlCookieString("")).toBeNull();
    expect(landingUrlCookieString("localhost")).toBeNull();
  });

  it("expires with max-age=0", () => {
    expect(clearLandingUrlCookieString()).toContain("max-age=0");
    expect(clearLandingUrlCookieString()).toContain(`${LANDING_URL_COOKIE}=`);
  });
});

describe("the capture component and its consumer", () => {
  const capture = fs.readFileSync(
    path.resolve(__dirname, "../src/components/landing-url-capture.tsx"),
    "utf8",
  );
  const layout = fs.readFileSync(path.resolve(__dirname, "../src/app/layout.tsx"), "utf8");
  const onboarding = fs.readFileSync(
    path.resolve(__dirname, "../src/components/onboarding/onboarding.tsx"),
    "utf8",
  );

  it("is mounted on the root layout, like its ?via= sibling", () => {
    expect(layout).toContain("<LandingUrlCapture />");
    expect(layout).toContain('from "@/components/landing-url-capture"');
  });

  it("reads window.location.search, so the root layout needs no Suspense boundary", () => {
    expect(capture).toContain("window.location.search");
    expect(capture).not.toContain("useSearchParams");
  });

  it("onboarding recovers it BEFORE the email guess can fill the field", () => {
    // The guess is a bare host by construction, so if it wins the landing path
    // is lost. Effects run in declaration order.
    const cookieEffect = onboarding.indexOf("readLandingUrlCookie(document.cookie)");
    const emailGuess = onboarding.indexOf("businessDomainFromEmail(signupEmail)");
    expect(cookieEffect).toBeGreaterThan(0);
    expect(emailGuess).toBeGreaterThan(0);
    expect(cookieEffect).toBeLessThan(emailGuess);
  });

  it("onboarding expires it only once it has landed in the field", () => {
    expect(onboarding).toContain("if (consumedCookie) document.cookie = clearLandingUrlCookieString()");
  });

  it("onboarding renders both sources as a URL", () => {
    expect(onboarding).toContain("normalizeLandingUrl(guessed) ?? guessed");
    expect(onboarding).toContain("const normalizedCurrent = normalizeLandingUrl(current);");
  });

  it("leaves extractDomain as the brand identity", () => {
    // The display change must not touch what the brand IS — the org name, the
    // header and upsertBrand all still resolve through extractDomain.
    expect(onboarding).toContain("const domain = extractDomain(url);");
  });
});
