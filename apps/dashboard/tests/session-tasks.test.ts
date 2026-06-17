import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const authedLayout = fs.readFileSync(
  path.join(__dirname, "../src/app/(authed)/layout.tsx"),
  "utf-8",
);
const chooseOrganizationTaskPage = fs.readFileSync(
  path.join(
    __dirname,
    "../src/app/(authed)/session-tasks/choose-organization/page.tsx",
  ),
  "utf-8",
);
const proxy = fs.readFileSync(
  path.join(__dirname, "../src/proxy.ts"),
  "utf-8",
);

describe("Clerk session tasks", () => {
  it("routes Clerk's choose-organization task to the in-app task page", () => {
    expect(authedLayout).toContain("taskUrls");
    expect(authedLayout).toContain('"choose-organization"');
    expect(authedLayout).toContain('"/session-tasks/choose-organization"');
  });

  it("renders the choose-organization task and completes back to /orgs", () => {
    expect(chooseOrganizationTaskPage).toContain("TaskChooseOrganization");
    expect(chooseOrganizationTaskPage).toContain('redirectUrlComplete="/orgs"');
  });

  it("lets pending sessions reach task UI without treating it as a normal public route", () => {
    expect(proxy).toContain("isSessionTaskRoute");
    expect(proxy).toContain('sessionStatus === "pending"');
    expect(proxy).toContain('new URL("/session-tasks/choose-organization", req.url)');
    expect(proxy).toContain('new URL("/sign-in", req.url)');
    expect(proxy).toContain('new URL("/orgs", req.url)');
  });
});
