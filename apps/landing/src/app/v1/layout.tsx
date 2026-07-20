import type { Metadata } from "next";
import "./v1.css";

// /v1 — ARCHIVE (non-indexed): the pre-Adam multicolor/beige React homepage
// (Fredoka + rainbow-gradient design), restored from git @ f23b1866e
// (last live 2026-06-09, before the illustrated agency version #1691).
// Self-contained: its own component copies + scoped CSS so it renders
// faithfully and never affects the current green landing.
export const metadata: Metadata = {
  title: "distribute — archive (v1)",
  robots: { index: false, follow: false },
};

export default function V1ArchiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
