import type { Metadata } from "next";
import { StartFlow } from "@/components/start/start-flow";

export const metadata: Metadata = {
  title: "Start",
  // The picks a visitor makes here are theirs, and the page states our own
  // clients' figures. Neither belongs in an index.
  robots: { index: false, follow: false },
};

export default function StartPage() {
  return <StartFlow />;
}
