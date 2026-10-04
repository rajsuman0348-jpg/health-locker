/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#EEF0E9",
        panel: "#F8F9F4",
        ink: "#1C2B2A",
        inkmuted: "#586661",
        locker: {
          50: "#EAF2EE",
          100: "#CFE3D7",
          300: "#7FB39D",
          500: "#2F6F5E",
          600: "#25594B",
          700: "#1C4438",
        },
        brick: {
          50: "#F7E9E6",
          300: "#DA9A8C",
          500: "#B23A2E",
          600: "#8F2E24",
        },
        ochre: {
          400: "#D6A544",
          500: "#C08A2E",
        },
        line: "#DADFD3",
      },
      fontFamily: {
        serif: ["'Source Serif 4'", "Georgia", "serif"],
        sans: ["'Public Sans'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "10px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(28,43,42,0.06), 0 1px 1px rgba(28,43,42,0.04)",
      },
    },
  },
  plugins: [],
};
