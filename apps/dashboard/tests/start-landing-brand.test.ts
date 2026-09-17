import { describe, it, expect } from "vitest";
import { landingBrandFromCookie } from "../src/lib/start-landing-brand";
import { landingUrlCookieString, LANDING_URL_COOKIE } from "../src/lib/landing-url-cookie";
import { foundersFloor, foundersLine } from "../src/lib/founders-floor";

// The brand a visitor named on the landing, shown back to them on every signed-out
// screen. Read off the cookie the root layout writes from `?url=`.
describe("landingBrandFromCookie", () => {
  const cookieFor = (raw: string) => landingUrlCookieString(raw)!.split(";")[0];

  it("reads the host off a stored landing URL, www stripped", () => {
    expect(landingBrandFromCookie(cookieFor("https://www.Acme.com/pricing"))).toEqual({
      url: "https://www.acme.com/pricing",
      host: "acme.com",
    });
  });

  it("is null with no cookie, which is the ordinary case", () => {
    expect(landingBrandFromCookie("")).toBeNull();
    expect(landingBrandFromCookie(null)).toBeNull();
    expect(landingBrandFromCookie("other=1; another=2")).toBeNull();
  });

  it("is null on a hand-edited cookie that is not a URL, never a guessed host", () => {
    expect(landingBrandFromCookie(`${LANDING_URL_COOKIE}=${encodeURIComponent("not a url")}`)).toBeNull();
  });
});

describe("foundersFloor", () => {
  it("floors to the nearest ten so a plus claim stays true between reads", () => {
    expect(foundersFloor(71)).toBe(70);
    expect(foundersFloor(79)).toBe(70);
    expect(foundersFloor(80)).toBe(80);
  });

  it("states nothing below one floor or on a bad total", () => {
    expect(foundersFloor(7)).toBeNull();
    expect(foundersFloor(null)).toBeNull();
    expect(foundersFloor(Number.NaN)).toBeNull();
  });

  it("spells the landing's own line", () => {
    expect(foundersLine(70)).toBe("Loved by 70+ founders");
  });
});
