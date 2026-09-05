import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        primary: ['Space Mono', 'monospace'],
        display: ['Unbounded', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
        telemetry: ['Space Mono', 'monospace'],
      },
      colors: {
        obsidian: {
          950: '#030303',
          900: '#0A0A0A',
          850: '#0F0F0F',
          800: '#141414',
          700: '#1A1A1A',
          600: '#262626',
        },
        accent: {
          cyan: '#FFFFFF',
          blue: '#D4D4D4',
          violet: '#A3A3A3',
        },
        rarity: {
          mythic: '#FFFFFF',
          legendary: '#E5E5E5',
          epic: '#A3A3A3',
          rare: '#737373',
          common: '#404040',
        },
        // Override standard colors to force grayscale
        purple: { 400: '#E5E5E5', 500: '#737373' },
        emerald: { 400: '#D4D4D4', 500: '#737373' },
        pink: { 400: '#A3A3A3', 500: '#525252' },
        cyan: { 400: '#FFFFFF', 500: '#A3A3A3' },
        amber: { 400: '#D4D4D4', 500: '#525252' },
        indigo: { 400: '#A3A3A3', 500: '#404040' },
        red: { 400: '#A3A3A3', 500: '#404040' },
      },
      boxShadow: {
        'mythic-glow': '0 0 16px rgba(255, 255, 255, 0.2)',
        'legendary-glow': '0 0 16px rgba(229, 229, 229, 0.2)',
        'epic-glow': '0 0 16px rgba(163, 163, 163, 0.2)',
        'rare-glow': '0 0 16px rgba(115, 115, 115, 0.2)',
        'common-glow': '0 0 10px rgba(64, 64, 64, 0.15)',
        'accent-glow': '0 0 12px rgba(255, 255, 255, 0.2)',
      },
      backgroundImage: {
        'obsidian-radial': 'radial-gradient(ellipse at top, #141414 0%, #0A0A0A 70%, #030303 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
