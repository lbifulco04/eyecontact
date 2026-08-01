/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Sfondo chiaro con leggera tinta lilla, non bianco puro.
        paper: {
          50: "#FBF9FD",
          100: "#F4EFFA",
          200: "#EAE1F4",
        },
        // Scala testo/inchiostro scuro (era "mist" invertita)
        ink: {
          900: "#251F30",
          700: "#3E3650",
          500: "#6B6478",
          300: "#A79FB6",
        },
        // Accento primario: lilla — brand, navigazione, azioni principali
        lilac: {
          200: "#E4D9F5",
          300: "#C9B8EA",
          400: "#A78BD9",
          500: "#8B6FC7",
          600: "#7259AE",
        },
        // Accento secondario: verde mare — traguardi, streak, stato "attivo"
        sea: {
          300: "#9FE3D2",
          400: "#5FC9AE",
          500: "#3FAF93",
          600: "#2E8E76",
        },
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      boxShadow: {
        glow: "0 8px 30px -8px rgba(139, 111, 199, 0.35)",
        seaGlow: "0 8px 30px -10px rgba(63, 175, 147, 0.35)",
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(0.9)", opacity: "0.9" },
          "70%": { transform: "scale(1.6)", opacity: "0" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        driftDot: {
          "0%, 100%": { transform: "translate(0,0)" },
          "50%": { transform: "translate(6px,-4px)" },
        },
      },
      animation: {
        pulseRing: "pulseRing 2.2s cubic-bezier(0.2,0.6,0.4,1) infinite",
        driftDot: "driftDot 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
