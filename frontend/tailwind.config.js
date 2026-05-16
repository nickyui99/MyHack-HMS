/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Brand: bright friendly teal ───────────────────────────
        teal: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        // ── Accent: warm coral for CTAs and highlights ────────────
        coral: {
          50:  '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
        },
        // ── Sunny butter for delight moments ──────────────────────
        butter: {
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
        },
        // ── Neutrals: warm, friendly off-whites ───────────────────
        canvas: '#fef9f3',       // page background
        cream:  '#fdf2e0',       // sunken sections
        paper:  '#ffffff',
        ink: {
          DEFAULT: '#1e1b30',    // deep blue-violet ink, warmer than black
          muted:   '#5b5870',
          subtle:  '#9b97b0',
        },
        line: {
          DEFAULT: '#f3e9d4',
          strong:  '#e6d8b8',
        },
        // ── Per-stage palette: vibrant, harmonious, distinct ──────
        // Referral · mint→emerald (fresh, beginning)
        stage1: { soft: '#d1fae5', mid: '#34d399', deep: '#059669', ink: '#064e3b' },
        // Surgical · indigo (precise, calm)
        stage2: { soft: '#e0e7ff', mid: '#818cf8', deep: '#4f46e5', ink: '#312e81' },
        // Allied · rose→peach (warm, caring)
        stage3: { soft: '#ffe4e6', mid: '#fb7185', deep: '#e11d48', ink: '#881337' },
        // Graph · violet (technical, network)
        stage4: { soft: '#ede9fe', mid: '#a78bfa', deep: '#7c3aed', ink: '#4c1d95' },
        // Semantic
        ok:     '#059669',
        warn:   '#d97706',
        danger: '#e11d48',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        tightish: '-0.015em',
        tighter:  '-0.025em',
      },
      borderRadius: {
        DEFAULT: '10px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
        '4xl': '42px',
      },
      boxShadow: {
        // Soft, slightly tinted shadows — softer than slate gray
        soft:  '0 1px 1px rgba(30,27,48,0.04), 0 6px 16px -6px rgba(30,27,48,0.10)',
        pop:   '0 2px 4px rgba(30,27,48,0.06), 0 18px 36px -10px rgba(30,27,48,0.16)',
        glow:  '0 0 0 6px rgba(20,184,166,0.10)',
        coral: '0 8px 24px -8px rgba(244,63,94,0.45)',
        teal:  '0 8px 24px -8px rgba(20,184,166,0.40)',
      },
      keyframes: {
        grow: {
          from: { transform: 'scaleX(0)' },
          to:   { transform: 'scaleX(1)' },
        },
        ping2: {
          '0%':   { transform: 'scale(1)', opacity: '.4' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        ping2: 'ping2 2.4s cubic-bezier(0,0,0.2,1) infinite',
        rise:  'rise 280ms ease-out both',
      },
    },
  },
  plugins: [],
};
