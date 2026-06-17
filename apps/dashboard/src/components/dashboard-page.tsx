import type { ComponentPropsWithoutRef } from "react";

type DashboardPageWidth = "narrow" | "standard" | "wide" | "full";

const widthClass: Record<DashboardPageWidth, string> = {
  narrow: "max-w-4xl",
  standard: "max-w-6xl",
  wide: "max-w-7xl",
  full: "max-w-none",
};

type DashboardPageProps = ComponentPropsWithoutRef<"div"> & {
  width?: DashboardPageWidth;
};

export function DashboardPage({
  children,
  className = "",
  width = "wide",
  ...props
}: DashboardPageProps) {
  return (
    <div
      className={`w-full ${widthClass[width]} mx-auto p-4 md:p-8 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
