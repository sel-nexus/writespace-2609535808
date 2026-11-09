/** Scan application markup and retain the planned brand motion utility. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Helvetica Neue', 'Arial', 'sans-serif'],
        editorial: ['Georgia', 'serif'],
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      // Use only with motion-safe:animate-float to respect reduced motion.
      animation: { float: 'float 6s ease-in-out infinite' },
    },
  },
  plugins: [],
};
