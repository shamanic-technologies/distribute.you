import { chromium, devices } from "@playwright/test";
import { execSync } from "node:child_process";
const OUT = "/Users/kevinlourd/conductor/workspaces/distribute.you/basseterre-v1/.context/gs-wall";
const [domain, mode] = process.argv.slice(2); // mode: desk-signup | phone
const browser = await chromium.launch({ headless: false, args: ["--disable-blink-features=AutomationControlled"] });
const ctx = mode === "phone"
  ? await browser.newContext({ ...devices["Pixel 7"] })
  : await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("response", (r) => { if (r.status() >= 400 && /distribute\.you/.test(r.url())) console.log("HTTP", r.status(), r.url().slice(0, 140)); });
await page.goto(`https://dashboard.distribute.you/get-started?url=${domain}`);
// Wait for the preview to settle (the snapshot is written at the end of it).
for (let i = 0; i < 100; i++) {
  const snap = await page.evaluate(() => sessionStorage.getItem("distribute:get-started:v1"));
  if (snap && !(await page.getByText(/Working for|Reading|Sizing/).count())) break;
  await page.waitForTimeout(3000);
}
const real = await page.evaluate(() => JSON.parse(sessionStorage.getItem("distribute:get-started:v1") || "null"));
console.log("SNAP segments", real?.segments?.length, "email", !!real?.email);
if (!real) throw new Error("no snapshot");
if (!real.segments.length) real.segments = [{ audienceId: "00000000-0000-0000-0000-000000000000", name: "QA probe segment", rationale: "", count: 1200 }];
if (!real.email) real.email = { subject: "QA probe: a question about your detectors", bodyText: "Hi Ana,\n\nQA probe body. This text only exists in the render check, the real preview writes one per person.\n\nBest,\nKevin", recipient: { firstName: "Ana", lastName: "M.", title: "Head of Operations", companyName: "Probe Labs" } };
await page.evaluate((s) => sessionStorage.setItem("distribute:get-started:v1", JSON.stringify(s)), real);
await page.goto("https://dashboard.distribute.you/get-started?resume=1");

await page.waitForFunction(() => document.body.innerText.includes("gets you"), null, { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/${mode}-wall.png` });
const m = await page.evaluate(() => ({ vw: innerWidth, sw: document.documentElement.scrollWidth, blur: getComputedStyle(document.querySelector(".gs-scrim")).backdropFilter, email: !!document.querySelector('[aria-label="Your first email"]'), carousel: !!document.querySelector('[aria-roledescription="carousel"]'), buys: document.body.innerText.includes("gets you") }));
console.log("METRICS", JSON.stringify(m));
if (mode === "phone") { await page.screenshot({ path: `${OUT}/phone-wall-full.png`, fullPage: false }); await browser.close(); process.exit(0); }
const addr = `addison+gs${Date.now()}@baseclusterio.com`;
console.log("ADDR", addr);
const since = new Date(Date.now() - 60_000).toISOString();
await page.getByPlaceholder("you@company.com").fill(addr);
await page.getByRole("checkbox").first().check();
await page.getByRole("button", { name: "Email me a code" }).click();
await page.getByText("We sent a 6-digit code").waitFor({ timeout: 180_000 });
await page.screenshot({ path: `${OUT}/desk-code.png` });
let code = "NONE";
for (let i = 0; i < 20 && code === "NONE"; i++) {
  await page.waitForTimeout(5000);
  code = execSync(`ssh -i ~/.ssh/oracle-distribute root@167.233.196.79 'docker exec distribute-instantly-service-1 node /tmp/read-code.mjs addison@baseclusterio.com ${addr} ${since} </dev/null'`).toString().trim().split("\n").pop();
}
console.log("CODE", code);
await page.getByLabel("Code").fill(code);
await page.getByRole("button", { name: "Verify and add card" }).click();
for (let i = 0; i < 40; i++) {
  if (await page.locator('iframe[src*="stripe"], iframe[name*="embedded"]').count()) break;
  if (await page.getByText("You will not be charged yet").count() && await page.locator("iframe").count()) break;
  await page.waitForTimeout(1500);
}
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/desk-card.png` });
console.log("TEXT", (await page.locator('[role="dialog"]').innerText()).slice(0, 1500));
await browser.close();
