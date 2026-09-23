import type { Config } from "tailwindcss";

// Design tokens for FileVault's admin interface.
//
// Palette decisions (per Part 1 brief: "dark navy, slate, white, and blue"):
//   - navy   → the fixed dark sidebar / chrome, never used for body copy
//   - slate  → neutral text, borders, and card backgrounds
//   - accent → a single restrained blue, reserved for primary actions,
//              active nav state, and focus rings — not decoration
//   - status → semantic colors for badges/alerts, kept desaturated so they
//              don't compete with the accent blue
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0A0F1E",
          900: "#0F172A",
          800: "#16213D",
          700: "#1F2C4C",
        },
        slate: {
          50: "#F6F7F9",
          100: "#EEF1F5",
          200: "#E2E6EC",
          300: "#C9CFD9",
          400: "#98A2B3",
          500: "#6B7280",
          600: "#4B5563",
          700: "#374151",
          800: "#1F2733",
          900: "#111827",
        },
        accent: {
          50: "#EEF3FF",
          100: "#DCE6FF",
          400: "#5C87F2",
          500: "#3563E9",
          600: "#284ECB",
          700: "#1F3DA0",
        },
        success: {
          50: "#ECFDF3",
          100: "#DCFCE7",
          500: "#16A34A",
          600: "#15803D",
          700: "#166534",
          800: "#14532D",
        },
        warning: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          500: "#D97706",
          600: "#B45309",
          700: "#92400E",
        },
        danger: {
          50: "#FEF2F2",
          100: "#FEE2E2",
          500: "#DC2626",
          600: "#B91C1C",
          700: "#991B1B",
          800: "#7F1D1D",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.06), 0 1px 3px 0 rgb(15 23 42 / 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
