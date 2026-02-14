/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: {
          950: "#020010",
          900: "#05001A",
          800: "#0A0025",
          700: "#110035",
          600: "#1A0050",
          500: "#220066",
        },
        nebula: {
          600: "#5B21B6",
          500: "#7C3AED",
          400: "#8B5CF6",
          300: "#A78BFA",
          200: "#C4B5FD",
        },
        plasma: {
          500: "#EF4444",
          400: "#F87171",
          300: "#FCA5A5",
        },
        stardust: {
          500: "#F59E0B",
          400: "#FBBF24",
          300: "#FDE68A",
        },
        aurora: {
          500: "#10B981",
          400: "#34D399",
          300: "#6EE7B7",
        },
        cosmic: {
          500: "#3B82F6",
          400: "#60A5FA",
          300: "#93C5FD",
        },
        accent: {
          purple: "#A855F7",
          pink: "#EC4899",
          violet: "#8B5CF6",
          fuchsia: "#D946EF",
          indigo: "#6366F1",
        },
        pixel: {
          dark: "#1a1a2e",
          mid: "#16213e",
          border: "#4a3f6b",
          highlight: "#e0c3fc",
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', "cursive"],
        display: ["Orbitron", "sans-serif"],
        body: ["Exo 2", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "grid-pattern":
          "linear-gradient(rgba(139,92,246,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.05) 1px, transparent 1px)",
        "purple-mesh":
          "radial-gradient(at 40% 20%, rgba(139,92,246,0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(168,85,247,0.1) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(124,58,237,0.1) 0px, transparent 50%)",
      },
      backgroundSize: {
        grid: "60px 60px",
      },
      animation: {
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        "float-delayed": "float 6s ease-in-out 3s infinite",
        "spin-slow": "spin 20s linear infinite",
        shimmer: "shimmer 2s linear infinite",
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "slide-up": "slideUp 0.6s ease-out forwards",
        "slide-down": "slideDown 0.6s ease-out forwards",
        "scale-in": "scaleIn 0.5s ease-out forwards",
        "gradient-shift": "gradientShift 8s ease infinite",
        "border-glow": "borderGlow 3s ease-in-out infinite",
        "aurora-glow": "auroraGlow 4s ease-in-out infinite",
        twinkle: "twinkle 3s ease-in-out infinite",
        "pixel-blink": "pixelBlink 1s steps(2, start) infinite",
        "pixel-bounce": "pixelBounce 0.5s steps(4) infinite",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        gradientShift: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        borderGlow: {
          "0%, 100%": { borderColor: "rgba(139,92,246,0.3)" },
          "50%": { borderColor: "rgba(168,85,247,0.6)" },
        },
        auroraGlow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(139,92,246,0.2), 0 0 60px rgba(139,92,246,0.05)" },
          "50%": { boxShadow: "0 0 40px rgba(168,85,247,0.4), 0 0 80px rgba(139,92,246,0.1)" },
        },
        twinkle: {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "1" },
        },
        pixelBlink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        pixelBounce: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
      boxShadow: {
        "glow-purple": "0 0 30px rgba(139,92,246,0.3), 0 0 60px rgba(139,92,246,0.1)",
        "glow-purple-lg": "0 0 60px rgba(139,92,246,0.4), 0 0 120px rgba(139,92,246,0.15)",
        "glow-pink": "0 0 30px rgba(236,72,153,0.3), 0 0 60px rgba(236,72,153,0.1)",
        "glow-aurora": "0 0 30px rgba(16,185,129,0.3), 0 0 60px rgba(16,185,129,0.1)",
        "glow-gold": "0 0 30px rgba(245,158,11,0.3), 0 0 60px rgba(245,158,11,0.1)",
        "pixel": "4px 4px 0 rgba(0,0,0,0.5)",
        "pixel-sm": "2px 2px 0 rgba(0,0,0,0.5)",
        "pixel-inset": "inset 2px 2px 0 rgba(255,255,255,0.1), inset -2px -2px 0 rgba(0,0,0,0.3)",
      },
    },
  },
  plugins: [],
};
