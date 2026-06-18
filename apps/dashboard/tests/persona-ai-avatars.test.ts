import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Persona AI avatars", () => {
  const api = fs.readFileSync(path.join(__dirname, "../src/lib/api.ts"), "utf-8");
  const betaOnboarding = fs.readFileSync(
    path.join(__dirname, "../src/components/onboarding/beta-onboarding.tsx"),
    "utf-8",
  );
  const personasPage = fs.readFileSync(
    path.join(__dirname, "../src/components/personas/customer-personas-page.tsx"),
    "utf-8",
  );
  const personaCard = fs.readFileSync(
    path.join(__dirname, "../src/components/personas/persona-card.tsx"),
    "utf-8",
  );

  it("accepts optional persona avatar URLs from the API contract", () => {
    expect(api).toContain("avatarUrl?: string | null");
    expect(api).toContain("avatarUrl: z.string().nullable().optional()");
  });

  it("routes regeneration through the persona avatar endpoint", () => {
    expect(api).toContain("regeneratePersonaAvatar");
    expect(api).toContain("/avatar/regenerate");
    expect(betaOnboarding).toContain("regeneratePersonaAvatar");
    expect(personasPage).toContain("regeneratePersonaAvatar");
  });

  it("auto-generates missing persisted avatars on the personas page after reload", () => {
    expect(personasPage).toContain("requestedAvatarIds");
    expect(personasPage).toContain("const missingAvatarId = serverPersonas.find((p) => !p.avatarUrl");
    expect(personasPage).toContain("regenerateAvatar(missingAvatarId)");
  });

  it("shows a hover/focus regenerate control on persisted persona avatars", () => {
    expect(personaCard).toContain("Regenerate ${name || \"audience\"} avatar");
    expect(personaCard).toContain("group-hover/avatar:opacity-100");
    expect(personaCard).toContain("onRegenerate={!isNew ? onRegenerateAvatar : undefined}");
  });

  it("does not introduce an OpenAI fallback in the dashboard wiring", () => {
    const touched = [api, betaOnboarding, personasPage, personaCard].join("\n");
    expect(touched).not.toMatch(/openai|open ai/i);
  });
});
