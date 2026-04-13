import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0a0a09',
          s1: '#111110',
          s2: '#18181a',
          s3: '#1f1f1d',
          s4: '#262624',
        },
        amber: '#e8a045',
        cyan: '#00d4aa',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        'dot-wave': 'dot-wave 1.2s ease-in-out infinite',
        'border-run': 'border-run 2s linear infinite',
        blink: 'blink 1s step-start infinite',
      },
    },
  },
  plugins: [],
}

export default config
