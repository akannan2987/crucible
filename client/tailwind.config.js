/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'nestle': {
          50: '#fef7e8',
          100: '#fdebc5',
          200: '#fcd986',
          300: '#fac247',
          400: '#f7a81e',
          500: '#e88a0c',
          600: '#cc6607',
          700: '#a8470a',
          800: '#8a380f',
          900: '#722f10',
          950: '#421604',
        },
        'pandora': {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        }
      }
    },
  },
  plugins: [],
}
