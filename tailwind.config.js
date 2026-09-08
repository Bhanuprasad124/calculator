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
        maratha: {
          crimson: '#3A0A0E',
          burgundy: '#1D0507',
          gold: '#D4AF37',
          'gold-dark': '#C59B27',
          parchment: '#F5E6C8',
          ivory: '#FFFFFF',
          inflow: '#34d399',
          outflow: '#f87171',
        },
      },
      fontFamily: {
        display: ['"Cinzel"', '"Playfair Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 24px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(212, 175, 55, 0.12)',
        lift: '0 16px 48px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(212, 175, 55, 0.15)',
        gold: '0 0 0 1px rgba(212, 175, 55, 0.35), 0 4px 20px rgba(212, 175, 55, 0.12)',
        'gold-glow': '0 0 24px rgba(212, 175, 55, 0.25)',
      },
      backgroundImage: {
        'maratha-gradient': 'linear-gradient(145deg, #3A0A0E 0%, #2a0709 45%, #1D0507 100%)',
      },
    },
  },
  plugins: [],
};
