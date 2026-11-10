/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Theme colors are set via CSS variables (see src/styles/themes.css),
        // referenced here so Tailwind utility classes pick them up.
        surface: "var(--color-surface)",
        "surface-alt": "var(--color-surface-alt)",
        text: "var(--color-text)",
        "text-muted": "var(--color-text-muted)",
        accent: "var(--color-accent)",
        "accent-alt": "var(--color-accent-alt)",
        border: "var(--color-border)",
      },
      fontFamily: {
        sans: ["Nunito", "system-ui", "sans-serif"],
        display: ["Fredoka", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
