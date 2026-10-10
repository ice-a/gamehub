/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './app.vue',
    './composables/**/*.{js,ts}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5'
        }
      }
    }
  },
  plugins: []
}
