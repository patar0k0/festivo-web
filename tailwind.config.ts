import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0a84ff",
          foreground: "#ffffff",
        },
        neutral: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          600: "#475569",
          900: "#0b1220",
        },
        ink: {
          DEFAULT: "#0B0F17",
        },
        sand: "#f5f2ed",
        clay: "#d9c9b8",
        pine: "#1e3a34",
        accent: "#c46b4a",
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,.08)",
        soft2: "0 6px 18px rgba(0,0,0,.06)",
        card: "0 12px 40px rgba(15, 23, 42, 0.12)",
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
