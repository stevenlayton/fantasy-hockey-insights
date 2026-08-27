/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        rink: {
          950: '#05070a',
          900: '#0a0e14',
          800: '#121826',
          700: '#1b2435',
          600: '#28344a',
          border: '#26314455',
        },
        ice: {
          400: '#5eead4',
          500: '#22d3ee',
          600: '#06b6d4',
        },
        up: '#34d399',
        down: '#f87171',
        gold: '#fbbf24',
      },
      fontFamily: {
        display: ['"Oswald"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(34,211,238,0.15), 0 8px 24px -8px rgba(34,211,238,0.25)',
      },
    },
  },
  plugins: [],
};
