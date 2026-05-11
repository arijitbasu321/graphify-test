import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    spacing: {
      0: '0',
      1: '4px',
      2: '8px',
      3: '12px',
      4: '16px',
      6: '24px',
      8: '32px',
      px: '1px',
    },
    borderRadius: {
      none: '0',
      sm: '2px',
      DEFAULT: '4px',
      full: '9999px',
    },
    fontSize: {
      '12': ['12px', { lineHeight: '1.5' }],
      '13': ['13px', { lineHeight: '1.55' }],
      '14': ['14px', { lineHeight: '1.55' }],
      '15': ['15px', { lineHeight: '1.5' }],
      '16': ['16px', { lineHeight: '1.5' }],
      '18': ['18px', { lineHeight: '1.4' }],
      '20': ['20px', { lineHeight: '1.35' }],
    },
    extend: {
      colors: {
        bg: '#0A0A0A',
        s1: '#141414',
        s2: '#1C1C1C',
        bsubtle: '#232323',
        bdefault: '#2E2E2E',
        tprimary: '#EDEDED',
        tsecondary: '#B5B5B5',
        ttertiary: '#7C7C7C',
        gold: '#C99A4A',
        goldDim: '#8C6A2E',
        danger: '#D4604A',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        ui: '-0.011em',
      },
      transitionDuration: {
        120: '120ms',
      },
    },
  },
  plugins: [],
};

export default config;
