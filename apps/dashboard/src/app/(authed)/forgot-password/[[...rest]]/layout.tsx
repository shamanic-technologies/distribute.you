import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Reset the password for your distribute account.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
