/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f6f7f8',
          100: '#eceef1',
          200: '#d5dae1',
          300: '#b0bac7',
          400: '#8593a7',
          500: '#66748b',
          600: '#515d72',
          700: '#434c5d',
          800: '#3a414f',
          900: '#0f1319',
          950: '#080a0e',
        },
        accent: {
          50: '#eef7f4',
          100: '#d5ece4',
          200: '#addacd',
          300: '#7cc1ae',
          400: '#4ea28d',
          500: '#328574',
          600: '#226b5e',
          700: '#1c554c',
          800: '#19443e',
          900: '#153935',
        },
        sand: '#faf9f7',
      },      fontFamily: {
        sans: ['Inter var', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Source Serif 4', 'Charter', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,19,25,0.04), 0 1px 3px rgba(15,19,25,0.06)',
        lift: '0 4px 12px -2px rgba(15,19,25,0.08), 0 2px 6px -2px rgba(15,19,25,0.06)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s cubic-bezier(0.2,0.7,0.3,1) both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
