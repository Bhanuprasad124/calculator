/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          saffron: {
            50: '#fff7ed',
            100: '#ffedd5',
            200: '#fed7aa',
            300: '#fdba74',
            400: '#fb923c',
            500: '#f97316',
            600: '#ea580c',
            700: '#c2410c',
            800: '#9a3412',
          },
          maroon: {
            50: '#fef2f2',
            100: '#fee2e2',
            600: '#991b1b',
            700: '#7f1d1d',
            800: '#6b1414',
            900: '#450a0a',
          },
          gold: {
            300: '#e8c547',
            400: '#D4AF37',
            500: '#C59B27',
            600: '#a8841f',
          },
        },
        temple: {
          brown: '#3E1E12',
          muted: '#7A5230',
          tab: '#4A2E1B',
          inflow: '#007A55',
          outflow: '#C5162D',
          balance: '#A31525',
          parchment: '#FFF8EE',
        },
      },
      fontFamily: {
        display: ['"Cinzel"', '"Playfair Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 10px 25px rgba(0, 0, 0, 0.08)',
        lift: '0 14px 40px rgba(100, 60, 20, 0.18)',
        header: '0 8px 32px 0 rgba(100, 60, 20, 0.15)',
        'tab-active': '0 4px 14px rgba(230, 81, 0, 0.35)',
        input: 'inset 0 1px 3px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
};
