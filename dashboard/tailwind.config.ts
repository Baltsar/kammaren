import type { Config } from 'tailwindcss';

// Färger och typografi extraherade från live kammaren.nu styleguide:
// IBM Plex Sans/Mono + Playfair Display headings, varm cream-bakgrund
// och djup mörkbrun. Tokens speglar :root-variablerna i public/index.html.
const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: {
        '2xl': '720px',
      },
    },
    extend: {
      colors: {
        kammaren: {
          'bg-cream': '#EAE5DC',
          'bg-dark': '#141210',
          'bg-warm': '#1A1714',
          strong: '#1A1714',
          body: '#3A3530',
          label: '#6B6560',
          'label-light': '#9A9490',
          cream: '#F2EDE4',
          'cream-mid': '#E4DFD6',
          pass: '#1A6020',
          'pass-light': '#2D8B35',
          wait: '#6B4400',
          red: '#9E1E14',
          tgreen: '#6FCF74',
          tamber: '#F5C36A',
          tagent: '#F07568',
        },
        background: '#EAE5DC',
        foreground: '#1A1714',
        muted: {
          DEFAULT: '#E4DFD6',
          foreground: '#6B6560',
        },
        card: {
          DEFAULT: 'rgba(255,255,255,0.78)',
          foreground: '#1A1714',
        },
        border: 'rgba(0,0,0,0.09)',
        input: 'rgba(0,0,0,0.12)',
        ring: '#1A1714',
        primary: {
          DEFAULT: '#1A1714',
          foreground: '#F2EDE4',
        },
        accent: {
          DEFAULT: '#F5C36A',
          foreground: '#1A1714',
        },
        destructive: {
          DEFAULT: '#9E1E14',
          foreground: '#F2EDE4',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'IBM Plex Mono', 'ui-monospace', 'monospace'],
        display: ['var(--font-display)', 'Playfair Display', 'serif'],
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.25rem',
      },
      maxWidth: {
        prose: '720px',
        wizard: '480px',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease forwards',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
