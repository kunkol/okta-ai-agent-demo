/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'okta-blue': '#00297A',
        'okta-teal': '#00D4AA',
        'okta-purple': '#6366f1',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s infinite',
        'fade-in-up': 'fade-in-up 0.3s ease-out forwards',
      },
    },
  },
  plugins: [],
};
