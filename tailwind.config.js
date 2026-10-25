/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Noto Sans JP"',
          '"BIZ UDPGothic"',
          '"DejaVu Sans"',
          "sans-serif",
        ],
        serif: ['"Noto Serif JP"', '"BIZ UDMincho"', '"IPAexMincho"', "serif"],
        klee: ['"Klee One"', "serif"],
      },
    },
  },
  plugins: [],
};
