import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // The brand ramp, byte-equal with apps/dashboard/src/app/globals.css
        // (--color-brand-*, oklch hue 258). tests/unit/brand-guidelines.test.ts pins it.
        brand: {
          50: "oklch(97% 0.02 258)",
          100: "oklch(94% 0.05 258)",
          200: "oklch(88% 0.09 258)",
          300: "oklch(80% 0.14 258)",
          400: "oklch(72% 0.17 258)",
          500: "oklch(64% 0.17 258)",
          600: "oklch(54% 0.16 258)",
          700: "oklch(47% 0.14 258)",
          800: "oklch(41% 0.115 258)",
          900: "oklch(35% 0.09 258)",
        },
        // Neutral greys, as dashboard v2 (Keel): no blue cast.
        gray: {
          50: "#fafafa",
          100: "#f3f3f4",
          200: "#e6e6e8",
          300: "#d4d4d8",
          400: "#a9a9b0",
          500: "#74747c",
          600: "#5e5e66",
          700: "#3f3f46",
          800: "#27272b",
          900: "#101012",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      typography: {
        DEFAULT: {
          css: {
            a: {
              color: "oklch(54% 0.16 258)",
              "&:hover": {
                color: "oklch(47% 0.14 258)",
              },
            },
            code: {
              color: "oklch(47% 0.14 258)",
              backgroundColor: "oklch(97% 0.02 258)",
              padding: "0.25rem 0.5rem",
              borderRadius: "0.25rem",
              fontWeight: "400",
            },
            "code::before": {
              content: '""',
            },
            "code::after": {
              content: '""',
            },
          },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
