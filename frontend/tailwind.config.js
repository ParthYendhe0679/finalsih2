/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#F7F9FC',       // Clean soft slate dashboard canvas
          card: '#FFFFFF',     // Pure crisp white card background
          border: '#E2E8F0',   // Subtle border boundary
          glow: '#2563EB',     // Primary brand royal blue
          accent: '#4F46E5',   // Indigo navigation accent
          safety: '#10B981',   // Emerald green
          fuel: '#3B82F6',     // Royal blue metric
          time: '#EF4444',     // Coral red alert/time metric
          dark: '#1F2937',     // Dark circle icon background from reference image
          muted: '#64748B',    // Muted slate body text
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['Inter', 'JetBrains Mono', 'monospace']
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'card-hover': '0 4px 12px 0 rgba(0, 0, 0, 0.08)',
        glow: '0 0 15px rgba(37, 99, 235, 0.15)',
        'glow-green': '0 0 15px rgba(16, 185, 129, 0.15)',
        'glow-blue': '0 0 15px rgba(59, 130, 246, 0.15)',
        'glow-red': '0 0 15px rgba(239, 68, 68, 0.15)',
      }
    },
  },
  plugins: [],
}
