import { chromium, devices } from "@playwright/test";
const dir = new URL("./", import.meta.url).pathname;
const b = await chromium.launch(); const ctx = await b.newContext({...devices["Pixel 7"]}); const p = await ctx.newPage();
await p.goto(`file://${dir}offer-settings.html`); await p.waitForTimeout(2000);
console.log(await p.evaluate(() => [...document.querySelectorAll("[data-offer-campaign-row]")].slice(0,4).map(li => [getComputedStyle(li).borderTopColor, getComputedStyle(li).borderTopWidth, li.className])));
await b.close();
