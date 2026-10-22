/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      colors: {
        ink: "#05070d",
        panel: "#0b101a",
        line: "#1b2638",
        blueglow: "#2f7cff",
      },
      boxShadow: {
        blue: "0 0 0 1px rgba(47, 124, 255, 0.18), 0 24px 80px rgba(25, 86, 213, 0.12)",
      },
    },
  },
  plugins: [],
};
