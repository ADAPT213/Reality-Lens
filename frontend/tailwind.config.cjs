/**** Tailwind config ****/
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dex: {
          bg: '#0f1115',
          surface: '#1a1d23',
          surfaceAlt: '#20242c',
          border: '#2a2f38',
          accent: '#3d7dff',
          accentAlt: '#5fa8ff',
          warn: '#ffb347',
          danger: '#ff5f56',
          success: '#35d682',
          info: '#60c2ff'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
};
