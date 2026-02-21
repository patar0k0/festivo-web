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
        ink: "#121417",
        sand: "#f5f2ed",
        clay: "#d9c9b8",
        pine: "#1e3a34",
        accent: "#c46b4a",
      },
      boxShadow: {
        soft: "0 8px 30px rgba(16, 24, 40, 0.08)",
        card: "0 12px 40px rgba(15, 23, 42, 0.12)",
      },
      borderRadius: {
        xl: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
