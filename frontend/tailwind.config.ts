import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f7ff',
          100: '#ebf0ff',
          200: '#d6e0ff',
          300: '#b8c9ff',
          400: '#94a8ff',
          500: '#667eea',
          600: '#5568d3',
          700: '#4451b8',
          800: '#363d8f',
          900: '#2d3270',
        },
        secondary: {
          500: '#764ba2',
          600: '#6a4391',
          700: '#5e3b80',
        },
      },
    },
  },
  plugins: [],
}
export default config


