/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // command center style, default dark
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#0B0F19',       // Deep space command background
          card: '#161F30',     // Semi-translucent terminal card
          border: '#23334D',   // Neon border boundary
          glow: '#38BDF8',     // Brand glow blue
          accent: '#A855F7',   // Purple navigation
          safety: '#10B981',   // Emerald green
          fuel: '#3B82F6',     // Royal blue
          time: '#EF4444',     // Neon red
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      boxShadow: {
        glow: '0 0 15px rgba(56, 189, 248, 0.25)',
        'glow-green': '0 0 15px rgba(16, 185, 129, 0.25)',
        'glow-blue': '0 0 15px rgba(59, 130, 246, 0.25)',
        'glow-red': '0 0 15px rgba(239, 68, 68, 0.25)',
      }
    },
  },
  plugins: [],
}
