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
            400: '#facc15',
            500: '#eab308',
            600: '#ca8a04',
          },
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(107, 20, 20, 0.05), 0 8px 24px rgba(107, 20, 20, 0.06)',
        lift: '0 14px 45px rgba(107, 20, 20, 0.1)',
      },
    },
  },
  plugins: [],
};
