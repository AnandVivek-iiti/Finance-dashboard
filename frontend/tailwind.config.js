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
          glow: "#6d8bff",
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
        muted: {
          DEFAULT: "#8c92a3",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "fade-in-up": "fadeInUp 0.5s ease-out forwards",
        "stagger-children": "staggerChildren 0.3s ease-out forwards",
        "border-glow": "borderGlow 2s ease-in-out infinite",
        "pulse-slow": "pulseSlow 4s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: 0, transform: "translateY(10px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        fadeInUp: {
          "0%": { opacity: 0, transform: "translateY(20px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        staggerChildren: {
          "0%": { opacity: 0, transform: "translateY(10px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        borderGlow: {
          "0%, 100%": { boxShadow: "0 0 0 1px rgba(54, 97, 240, 0.1)" },
          "50%": { boxShadow: "0 0 20px rgba(54, 97, 240, 0.4)" },
        },
        pulseSlow: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.5 },
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)",
        "card-hover": "0 4px 20px rgba(16, 24, 40, 0.1), 0 2px 8px rgba(16, 24, 40, 0.05)",
        accent: "0 0 20px rgba(54, 97, 240, 0.15)",
        button: "0 2px 10px rgba(54, 97, 240, 0.2)",
      },
    },
  },
  plugins: [],
};