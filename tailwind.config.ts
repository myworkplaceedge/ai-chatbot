import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#1B2B8A",
          "navy-deep": "#131F66",
          blue: "#2E40C5",
          "blue-soft": "#4F60D9",
          ink: "#0F1535",
          accent: "#7C86F5",
          light: "#EEF0FB",
          mist: "#F5F7FC",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 21, 53, 0.04), 0 2px 8px rgba(15, 21, 53, 0.05)",
        card: "0 1px 3px rgba(15, 21, 53, 0.05), 0 8px 24px -8px rgba(15, 21, 53, 0.08)",
        lift: "0 4px 12px -2px rgba(27, 43, 138, 0.12), 0 12px 32px -8px rgba(27, 43, 138, 0.18)",
        ring: "0 0 0 4px rgba(46, 64, 197, 0.12)",
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #1B2B8A 0%, #2E40C5 55%, #4F60D9 100%)",
        "hero-fade":
          "radial-gradient(1000px 600px at 50% -10%, rgba(46, 64, 197, 0.10), transparent 60%)",
        "panel-fade":
          "linear-gradient(180deg, rgba(245, 247, 252, 0.6) 0%, rgba(255, 255, 255, 0) 60%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "pulse-dot": {
          "0%, 80%, 100%": { opacity: "0.3", transform: "scale(0.85)" },
          "40%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 220ms ease-out both",
        "fade-in": "fade-in 180ms ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
