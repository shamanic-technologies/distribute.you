import { describe, expect, it } from "vitest";
import { copilotErrorText } from "../src/lib/copilot-error";

const CF_524 = '<!DOCTYPE html> <!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]--> <head><title>distribute.you | 524: A timeout occurred</title>';

describe("copilotErrorText (COPILOT-LATENCY-1125)", () => {
  it("never shows Cloudflare's HTML page", () => {
    expect(copilotErrorText(CF_524, 524)).toBe("The copilot took too long to answer (error 524). Try again.");
  });
  it("never shows HTML wrapped in the proxy's JSON either", () => {
    expect(copilotErrorText(JSON.stringify({ error: CF_524 }))).toBe("The copilot took too long to answer. Try again.");
  });
  it("shows the backend's sentence", () => {
    expect(copilotErrorText(JSON.stringify({ error: "Message is required" }))).toBe("Message is required");
    expect(copilotErrorText("Chat service unavailable")).toBe("Chat service unavailable");
  });
  it("an empty body still says something", () => {
    expect(copilotErrorText("")).toBe("The copilot took too long to answer. Try again.");
  });
});
