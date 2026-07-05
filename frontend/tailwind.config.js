/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Sora", "Inter", "sans-serif"],
        body: ["Inter", "-apple-system", "sans-serif"],
      },
      colors: {
        canvas: "#f7f8fb",
        surface: "#ffffff",
        border: "#e6e8ef",
        ink: {
          DEFAULT: "#171b2b",
          muted: "#6b7280",
          dim: "#9ca3af",
        },
        accent: {
          DEFAULT: "#3661f0",
          soft: "#eaeffe",
        },
        positive: {
          DEFAULT: "#0f9d67",
          soft: "#e5f7ef",
        },
        negative: {
          DEFAULT: "#e0483f",
          soft: "#fdeceb",
        },
        warn: {
          DEFAULT: "#b7791f",
          soft: "#fbf1de",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)",
      },
    },
  },
  plugins: [],
};
