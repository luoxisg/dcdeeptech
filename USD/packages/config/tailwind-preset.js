/** @type {import('tailwindcss').Config} */
const preset = {
  theme: {
    extend: {
      colors: {
        surface: "#0b1525",
        panel: "#101c31",
        ink: "#eff6ff",
        muted: "#8ba0b7",
        accent: "#f97316",
        accentSecondary: "#22c55e",
        stroke: "rgba(255,255,255,0.1)"
      },
      boxShadow: {
        glow: "0 18px 50px rgba(249, 115, 22, 0.16)"
      },
      borderRadius: {
        "4xl": "2rem"
      }
    }
  }
};

module.exports = preset;
