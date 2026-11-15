// Tailwind-oppsett for RailSync. GitHub Actions bygger det til assets/railsync.css
// (se .github/workflows/deploy.yml). Tidligere lå dette i index.html sammen med Tailwind fra CDN.
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './app.js'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "\"Plus Jakarta Sans\"",
          "system-ui",
          "-apple-system",
          "sans-serif"
        ]
      },
      colors: {
        brand: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
          950: "#042f2e"
        },
        fjord: {
          100: "#d5ebe7",
          200: "#a7d3cc",
          300: "#7fb8af",
          700: "#155e5a",
          800: "#0f4c4a",
          900: "#0b3b39",
          950: "#082b2a"
        },
        sand: {
          50: "#fbf9f5",
          100: "#f6f3ee",
          200: "#ece6db",
          300: "#dfd6c6"
        },
        rail: {
          navy: "#0f172a",
          petrol: "#0a3641",
          accent: "#f97316",
          accentHover: "#ea580c",
          coral: "#fb7185",
          surface: "#ffffff",
          muted: "#64748b"
        }
      }
    }
  }
};
