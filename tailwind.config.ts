import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      keyframes: {
        "fade-in": {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        "pulse-spin": {
          '0%': {
            transform: 'rotate(0deg) scale(1)',
          },
          '50%': {
            transform: 'rotate(90deg) scale(1.5)'
          },
          '100%': {
            transform: 'rotate(360deg) scale(1)'
          }
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s linear',
        'fast-fade-in': 'fade-in 0.25s linear',
        'pulse-spin': 'pulse-spin 2s linear infinite',
      }
    },
  },
  plugins: [],
}
export default config