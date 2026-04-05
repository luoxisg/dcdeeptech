import type { Config } from "tailwindcss";

/**
 * Shared Tailwind preset for customer-facing surfaces (marketing + portal).
 * Contains brand colors, font stack, and spacing tokens.
 * Admin console uses its own Tailwind config — operator UI has a different design language.
 */
const preset: Config = {
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0f7ff",
          100: "#dbeeff",
          200: "#beddff",
          300: "#91c7fe",
          400: "#5ca8fc",
          500: "#3786f8",
          600: "#2065ee",
          700: "#1850db",
          800: "#1a41b1",
          900: "#1b3a8c",
          950: "#1e3a8a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
    },
  },
};

export default preset;
