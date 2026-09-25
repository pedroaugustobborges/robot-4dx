import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "cyan-glow": "#00d4ff",
        "medical-green": "#00e676",
        "space-dark": "#030b18",
        "iris-blue": "#0891b2",
        "iris-dark": "#0c1a2e",
      },
      fontFamily: {
        orbitron: ["var(--font-orbitron)", "monospace"],
        grotesk: ["var(--font-space-grotesk)", "sans-serif"],
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "float-particle": "float linear infinite",
        scanline: "scanline 3s linear infinite",
        blink: "blink 0.13s ease-in-out",
        "antenna-blink": "antenna-blink 0.9s ease-in-out infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 10px #00d4ff, 0 0 20px #00d4ff" },
          "50%": { boxShadow: "0 0 20px #00d4ff, 0 0 40px #00d4ff, 0 0 60px #00d4ff" },
        },
        "antenna-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.2" },
        },
      },
      boxShadow: {
        "cyan-glow": "0 0 15px #00d4ff, 0 0 30px rgba(0,212,255,0.5)",
        "green-glow": "0 0 15px #00e676, 0 0 30px rgba(0,230,118,0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
