import { chromium, devices } from "@playwright/test";
import { writeFileSync } from "node:fs";
const [,, name, query = "", setup = ""] = process.argv;
const dir = new URL("./", import.meta.url).pathname;
const html = (dark) => `<!doctype html><html class="${dark ? "dark" : ""}"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="out.css"></head><body class="bg-gray-50"><div id="root"></div><script>window.process={env:{NODE_ENV:"development"}};${setup}</script><script src="${name}.js"></script></body></html>`;
const out = "/Users/kevinlourd/conductor/workspaces/distribute.you/tianjin-v7/.context/";
const browser = await chromium.launch();
for (const [label, ctxOpts] of [["1280", { viewport: { width: 1280, height: 900 } }], ["pixel7", { ...devices["Pixel 7"] }]]) {
  for (const dark of [false, true]) {
    writeFileSync(dir + `${name}.html`, html(dark));
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    page.on("console", (m) => { if (["warning", "error"].includes(m.type()) || m.text().startsWith("PUSH")) errs.push(m.type() + ": " + m.text().slice(0, 160)); });
    await page.goto(`file://${dir}${name}.html${query}`);
    await page.waitForTimeout(2500);
    const overflow = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    const file = `${out}${name}-${label}-${dark ? "dark" : "light"}.png`;
    await page.screenshot({ path: file, fullPage: false });
    console.log(file, "overflow", overflow, errs.filter(e=>!e.includes("ERR_FILE_NOT_FOUND")).slice(0, 6));
    await ctx.close();
  }
}
await browser.close();
