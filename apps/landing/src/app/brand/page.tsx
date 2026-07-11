import type { Metadata } from "next";
import { PROD_URLS } from "@/lib/env-urls";
import { URLS } from "@distribute/content";

export const revalidate = 86400;

const BRAND_URL = `${PROD_URLS.landing}/brand`;
const SUPPORT_EMAIL = "support@distribute.you";

export const metadata: Metadata = {
  title: "Brand assets",
  description:
    "Download the distribute logo, wordmark, icon, banner, and favicon in SVG, plus colors, typography, and usage guidelines.",
  alternates: { canonical: BRAND_URL },
  openGraph: {
    title: "distribute brand assets",
    description:
      "Logo, wordmark, icon, banner, favicon, colors, and usage guidelines.",
    url: BRAND_URL,
    type: "website",
    images: [{ url: "/brand/banner.svg", width: 1200, height: 630, alt: "distribute" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "distribute brand assets",
    description: "Logo, wordmark, icon, banner, favicon, colors, and usage guidelines.",
    images: ["/brand/banner.svg"],
  },
};

type Asset = {
  name: string;
  file: string;
  tile: "dark" | "light" | "checker";
  note?: string;
};

const LOGOS: Asset[] = [
  { name: "Logo, on dark", file: "logo-full-on-dark.svg", tile: "dark", note: "Primary. Use on dark surfaces." },
  { name: "Logo, on light", file: "logo-full-on-light.svg", tile: "light", note: "Use on light surfaces." },
  { name: "Logo, mono white", file: "logo-full-mono-white.svg", tile: "dark", note: "Single color, dark backgrounds." },
  { name: "Logo, mono black", file: "logo-full-mono-black.svg", tile: "light", note: "Single color, light backgrounds." },
  { name: "Wordmark, on dark", file: "logo-wordmark-on-dark.svg", tile: "dark" },
  { name: "Wordmark, on light", file: "logo-wordmark-on-light.svg", tile: "light" },
];

const ICONS: Asset[] = [
  { name: "Icon", file: "icon.svg", tile: "checker", note: "App icon and social avatar." },
  { name: "Mark", file: "logo-mark.svg", tile: "checker", note: "The dot, on transparent." },
  { name: "Favicon", file: "favicon.svg", tile: "checker", note: "SVG favicon." },
];

const COLORS: { name: string; hex: string; text: "light" | "dark" }[] = [
  { name: "Ink", hex: "#070A0F", text: "light" },
  { name: "Surface", hex: "#10151D", text: "light" },
  { name: "Line", hex: "#26303D", text: "light" },
  { name: "Signal green", hex: "#45E38E", text: "dark" },
  { name: "Text", hex: "#F2F5F7", text: "dark" },
  { name: "Muted", hex: "#99A4B6", text: "dark" },
];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
.bp{--bg:#070a0f;--panel:#10151d;--panel-2:#151b25;--line:#26303d;--text:#f2f5f7;--muted:#99a4b6;--faint:#657184;--green:#45e38e;
  background:radial-gradient(circle at 78% 2%,rgba(69,227,142,.08),transparent 30rem),var(--bg);
  color:var(--text);font-family:'Inter',sans-serif;line-height:1.55;min-height:100vh;-webkit-font-smoothing:antialiased}
.bp *{box-sizing:border-box}
.bp a{color:inherit;text-decoration:none}
.bp-wrap{max-width:1080px;margin:0 auto;padding:0 24px}
.bp-top{display:flex;align-items:center;justify-content:space-between;padding:22px 0;border-bottom:1px solid var(--line)}
.bp-logo{display:flex;align-items:center;gap:10px;font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:19px;letter-spacing:-.4px}
.bp-dot{width:9px;height:9px;border-radius:50%;background:var(--green);box-shadow:0 0 16px rgba(69,227,142,.8)}
.bp-back{font-size:14px;color:var(--muted)}
.bp-hero{padding:64px 0 40px}
.bp-eyebrow{font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--green)}
.bp-hero h1{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:clamp(2rem,6vw,3.25rem);letter-spacing:-1.5px;margin:14px 0 12px}
.bp-hero p{color:var(--muted);max-width:60ch;font-size:17px}
.bp-btn{display:inline-flex;align-items:center;gap:8px;margin-top:24px;padding:12px 20px;border-radius:10px;background:var(--green);color:#082314;font-weight:600;font-size:15px}
.bp-sec{padding:40px 0;border-top:1px solid var(--line)}
.bp-sec h2{font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:26px;letter-spacing:-.6px;margin:0 0 6px}
.bp-sec .sub{color:var(--muted);font-size:15px;margin:0 0 26px}
.bp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
.bp-card{border:1px solid var(--line);border-radius:15px;overflow:hidden;background:var(--panel)}
.bp-preview{height:150px;display:flex;align-items:center;justify-content:center;padding:24px}
.bp-preview.dark{background:#070a0f}
.bp-preview.light{background:#f2f5f7}
.bp-preview.checker{background:#0b0f15;background-image:linear-gradient(45deg,#151b25 25%,transparent 25%),linear-gradient(-45deg,#151b25 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#151b25 75%),linear-gradient(-45deg,transparent 75%,#151b25 75%);background-size:18px 18px;background-position:0 0,0 9px,9px -9px,-9px 0}
.bp-preview img{max-width:100%;max-height:100%}
.bp-preview.checker img{width:72px;height:72px}
.bp-meta{padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid var(--line)}
.bp-meta .nm{font-size:14px;font-weight:500}
.bp-meta .nt{font-size:12px;color:var(--faint);margin-top:2px}
.bp-dl{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--green);white-space:nowrap;border:1px solid var(--line);border-radius:8px;padding:6px 10px}
.bp-swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.bp-sw{border:1px solid var(--line);border-radius:12px;overflow:hidden}
.bp-sw .chip{height:82px;display:flex;align-items:flex-end;padding:10px;font-family:'IBM Plex Mono',monospace;font-size:12px}
.bp-sw .lbl{padding:10px 12px;font-size:13px;background:var(--panel)}
.bp-sw .lbl span{color:var(--faint);font-family:'IBM Plex Mono',monospace;font-size:11px}
.bp-type{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
.bp-tf{border:1px solid var(--line);border-radius:15px;padding:22px;background:var(--panel)}
.bp-tf .big{font-size:30px;letter-spacing:-.5px}
.bp-tf .role{color:var(--faint);font-size:12px;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}
.bp-rules{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.bp-rule{border:1px solid var(--line);border-radius:15px;padding:20px;background:var(--panel)}
.bp-rule h3{font-size:15px;margin:0 0 10px;font-family:'Space Grotesk',sans-serif}
.bp-rule ul{margin:0;padding-left:18px;color:var(--muted);font-size:14px}
.bp-rule li{margin:6px 0}
.bp-foot{border-top:1px solid var(--line);padding:34px 0 60px;color:var(--faint);font-size:14px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px}
@media(max-width:640px){.bp-rules{grid-template-columns:1fr}}
`;

function AssetCard({ a }: { a: Asset }) {
  return (
    <div className="bp-card">
      <div className={`bp-preview ${a.tile}`}>
        <img src={`/brand/${a.file}`} alt={a.name} loading="lazy" />
      </div>
      <div className="bp-meta">
        <div>
          <div className="nm">{a.name}</div>
          {a.note ? <div className="nt">{a.note}</div> : null}
        </div>
        <a className="bp-dl" href={`/brand/${a.file}`} download>
          SVG ↓
        </a>
      </div>
    </div>
  );
}

export default function BrandPage() {
  return (
    <div className="bp">
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="bp-wrap">
        <header className="bp-top">
          <a className="bp-logo" href="/">
            <span className="bp-dot" aria-hidden="true" />
            distribute
          </a>
          <a className="bp-back" href="/">
            Back to site
          </a>
        </header>

        <section className="bp-hero">
          <div className="bp-eyebrow">Brand kit</div>
          <h1>distribute brand assets</h1>
          <p>
            The logo, wordmark, icon, banner, and favicon in SVG, plus our
            colors, typography, and a few rules. Use these to reference or link
            to distribute. Do not modify or redraw the mark.
          </p>
          <a className="bp-btn" href="/brand/distribute-brand.zip" download>
            Download all assets (.zip) ↓
          </a>
        </section>

        <section className="bp-sec">
          <h2>Logo</h2>
          <p className="sub">
            The full logo is the dot and the wordmark together. Keep the dot to
            the left of the word.
          </p>
          <div className="bp-grid">
            {LOGOS.map((a) => (
              <AssetCard key={a.file} a={a} />
            ))}
          </div>
        </section>

        <section className="bp-sec">
          <h2>Icon &amp; favicon</h2>
          <p className="sub">Square icon for avatars and app tiles. The mark is the dot on its own.</p>
          <div className="bp-grid">
            {ICONS.map((a) => (
              <AssetCard key={a.file} a={a} />
            ))}
          </div>
        </section>

        <section className="bp-sec">
          <h2>Banner</h2>
          <p className="sub">1200 x 630 social and share image.</p>
          <div className="bp-grid">
            <div className="bp-card">
              <div className="bp-preview dark" style={{ height: 220 }}>
                <img src="/brand/banner.svg" alt="distribute banner" loading="lazy" />
              </div>
              <div className="bp-meta">
                <div className="nm">Banner, 1200 x 630</div>
                <a className="bp-dl" href="/brand/banner.svg" download>
                  SVG ↓
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="bp-sec">
          <h2>Colors</h2>
          <p className="sub">Ink and signal green are the core. Everything else supports them.</p>
          <div className="bp-swatches">
            {COLORS.map((c) => (
              <div className="bp-sw" key={c.hex}>
                <div
                  className="chip"
                  style={{ background: c.hex, color: c.text === "dark" ? "#070a0f" : "#f2f5f7" }}
                >
                  {c.hex}
                </div>
                <div className="lbl">
                  {c.name}
                  <br />
                  <span>{c.hex}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bp-sec">
          <h2>Typography</h2>
          <p className="sub">Space Grotesk for display, Inter for body, IBM Plex Mono for labels and numbers.</p>
          <div className="bp-type">
            <div className="bp-tf">
              <div className="role">Display</div>
              <div className="big" style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600 }}>
                Space Grotesk
              </div>
            </div>
            <div className="bp-tf">
              <div className="role">Body</div>
              <div className="big" style={{ fontFamily: "'Inter',sans-serif" }}>Inter</div>
            </div>
            <div className="bp-tf">
              <div className="role">Mono</div>
              <div className="big" style={{ fontFamily: "'IBM Plex Mono',monospace" }}>IBM Plex Mono</div>
            </div>
          </div>
        </section>

        <section className="bp-sec">
          <h2>Usage</h2>
          <p className="sub">A few rules so the mark stays recognizable.</p>
          <div className="bp-rules">
            <div className="bp-rule">
              <h3>Do</h3>
              <ul>
                <li>Keep clear space around the logo, at least the height of the dot.</li>
                <li>Use the on-dark logo on dark, the on-light logo on light.</li>
                <li>Write the name lowercase: distribute.</li>
                <li>Scale the SVG. It stays sharp at any size.</li>
              </ul>
            </div>
            <div className="bp-rule">
              <h3>Don&apos;t</h3>
              <ul>
                <li>Recolor the mark or change the green.</li>
                <li>Stretch, rotate, or add effects.</li>
                <li>Put the logo on a busy or low-contrast background.</li>
                <li>Recreate the wordmark in another font.</li>
              </ul>
            </div>
          </div>
        </section>

        <footer className="bp-foot">
          <span>Questions about usage? <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "#45e38e" }}>{SUPPORT_EMAIL}</a></span>
          <span>
            <a href={URLS.signUp} style={{ color: "#99a4b6" }}>Start free</a>
          </span>
        </footer>
      </div>
    </div>
  );
}
