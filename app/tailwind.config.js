/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');

const whitelist = [
  'gray', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'
].reduce((result, color) => {
  result.push(`text-${color}-600`, `bg-${color}-600`, `bg-${color}-500`);
  return result;
}, []);

module.exports = {
  mode: 'jit',
  purge: {
    content: [
      './pages/**/*.{js,ts,jsx,tsx}',
      './components/**/*.{js,ts,jsx,tsx}',
      './public/**/*.html',
    ],
    options: {
      whitelist,
    },
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans TC"', 'Roboto', 'Inter var', ...defaultTheme.fontFamily.sans],
        roboto: ['Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
  ],
};