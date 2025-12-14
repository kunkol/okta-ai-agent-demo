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
        'okta': {
          'navy': '#00297A',
          'teal': '#00D4AA',
          'blue': '#007DC1',
        },
        'surface': {
          '50': '#08080c',
          '100': '#0a0a0f',
          '200': '#0f0f15',
          '300': '#14141c',
          '400': '#1a1a24',
          '500': '#22222e',
        },
      },
      fontFamily: {
        'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
