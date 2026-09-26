import postcss from "../../../node_modules/.pnpm/postcss@8.5.6/node_modules/postcss/lib/postcss.mjs";
import tailwind from "@tailwindcss/postcss";
import { readFileSync, writeFileSync } from "node:fs";
const from = new URL("./entry.css", import.meta.url).pathname;
const css = readFileSync(from, "utf8");
const out = await postcss([tailwind()]).process(css, { from, to: new URL("./out.css", import.meta.url).pathname });
writeFileSync(new URL("./out.css", import.meta.url), out.css);
console.log("css bytes", out.css.length);
