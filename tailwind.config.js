/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      /* ───────────────────────────────────────────────────────────────
         FONT FAMILIES - Use CSS variable tokens
         ─────────────────────────────────────────────────────────────── */
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },

      /* ───────────────────────────────────────────────────────────────
         FONT SIZES - Match token scale
         ─────────────────────────────────────────────────────────────── */
      fontSize: {
        '2xs': ['var(--text-2xs)', { lineHeight: 'var(--leading-tight)' }],
        'xs': ['var(--text-xs)', { lineHeight: 'var(--leading-tight)' }],
        'sm': ['var(--text-sm)', { lineHeight: 'var(--leading-snug)' }],
        'base': ['var(--text-base)', { lineHeight: 'var(--leading-normal)' }],
        'md': ['var(--text-md)', { lineHeight: 'var(--leading-normal)' }],
        'lg': ['var(--text-lg)', { lineHeight: 'var(--leading-snug)' }],
        'xl': ['var(--text-xl)', { lineHeight: 'var(--leading-tight)' }],
        '2xl': ['var(--text-2xl)', { lineHeight: 'var(--leading-tight)' }],
        '3xl': ['var(--text-3xl)', { lineHeight: 'var(--leading-tight)' }],
        '4xl': ['var(--text-4xl)', { lineHeight: 'var(--leading-none)' }],
        'hero': ['var(--text-hero)', { lineHeight: 'var(--leading-none)' }],
      },

      /* ───────────────────────────────────────────────────────────────
         COLORS - Semantic tokens from CSS variables
         ─────────────────────────────────────────────────────────────── */
      colors: {
        // Preserve essential Tailwind defaults
        transparent: 'transparent',
        current: 'currentColor',
        white: '#FFFFFF',
        black: '#000000',

        // Standard Tailwind color scales (needed for components)
        neutral: {
          50: '#fafafa', 100: '#f5f5f5', 200: '#e5e5e5', 300: '#d4d4d4',
          400: '#a3a3a3', 500: '#737373', 600: '#525252', 700: '#404040',
          800: '#262626', 900: '#171717', 950: '#0a0a0a',
        },
        stone: {
          50: '#fafaf9', 100: '#f5f5f4', 200: '#e7e5e4', 300: '#d6d3d1',
          400: '#a8a29e', 500: '#78716c', 600: '#57534e', 700: '#44403c',
          800: '#292524', 900: '#1c1917', 950: '#0c0a09',
        },
        gray: {
          50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db',
          400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151',
          800: '#1f2937', 900: '#111827', 950: '#030712',
        },
        zinc: {
          50: '#fafafa', 100: '#f4f4f5', 200: '#e4e4e7', 300: '#d4d4d8',
          400: '#a1a1aa', 500: '#71717a', 600: '#52525b', 700: '#3f3f46',
          800: '#27272a', 900: '#18181b', 950: '#09090b',
        },
        slate: {
          50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
          400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155',
          800: '#1e293b', 900: '#0f172a', 950: '#020617',
        },
        red: {
          50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5',
          400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c',
          800: '#991b1b', 900: '#7f1d1d', 950: '#450a0a',
        },
        orange: {
          50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74',
          400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c',
          800: '#9a3412', 900: '#7c2d12', 950: '#431407',
        },
        amber: {
          50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
          400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
          800: '#92400e', 900: '#78350f', 950: '#451a03',
        },
        yellow: {
          50: '#fefce8', 100: '#fef9c3', 200: '#fef08a', 300: '#fde047',
          400: '#facc15', 500: '#eab308', 600: '#ca8a04', 700: '#a16207',
          800: '#854d0e', 900: '#713f12', 950: '#422006',
        },
        green: {
          50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
          400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d',
          800: '#166534', 900: '#14532d', 950: '#052e16',
        },
        emerald: {
          50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7',
          400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857',
          800: '#065f46', 900: '#064e3b', 950: '#022c22',
        },
        teal: {
          50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4',
          400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e',
          800: '#115e59', 900: '#134e4a', 950: '#042f2e',
        },
        blue: {
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
          400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
          800: '#1e40af', 900: '#1e3a8a', 950: '#172554',
        },
        purple: {
          50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe',
          400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce',
          800: '#6b21a8', 900: '#581c87', 950: '#3b0764',
        },
        rose: {
          50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af',
          400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c',
          800: '#9f1239', 900: '#881337', 950: '#4c0519',
        },
        pink: {
          50: '#fdf2f8', 100: '#fce7f3', 200: '#fbcfe8', 300: '#f9a8d4',
          400: '#f472b6', 500: '#ec4899', 600: '#db2777', 700: '#be185d',
          800: '#9d174d', 900: '#831843', 950: '#500724',
        },

        // Backgrounds
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
          elevated: 'var(--bg-elevated)',
          overlay: 'var(--bg-overlay)',
        },
        // Surfaces
        surface: {
          primary: 'var(--surface-primary)',
          secondary: 'var(--surface-secondary)',
          tertiary: 'var(--surface-tertiary)',
          hover: 'var(--surface-hover)',
          active: 'var(--surface-active)',
          disabled: 'var(--surface-disabled)',
        },
        // Text
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          disabled: 'var(--text-disabled)',
          inverse: 'var(--text-inverse)',
          'on-brand': 'var(--text-on-brand)',
        },
        // Brand
        brand: {
          DEFAULT: 'var(--brand-primary)',
          primary: 'var(--brand-primary)',
          hover: 'var(--brand-primary-hover)',
          active: 'var(--brand-primary-active)',
          subtle: 'var(--brand-primary-subtle)',
          secondary: 'var(--brand-secondary)',
        },
        // Borders
        border: {
          DEFAULT: 'var(--border-default)',
          default: 'var(--border-default)',
          subtle: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
          focus: 'var(--border-focus)',
          error: 'var(--border-error)',
          success: 'var(--border-success)',
        },
        // Status colors
        success: {
          DEFAULT: 'var(--status-success-bg)',
          bg: 'var(--status-success-bg)',
          text: 'var(--status-success-text)',
          subtle: 'var(--status-success-subtle)',
        },
        error: {
          DEFAULT: 'var(--status-error-bg)',
          bg: 'var(--status-error-bg)',
          text: 'var(--status-error-text)',
          subtle: 'var(--status-error-subtle)',
        },
        warning: {
          DEFAULT: 'var(--status-warning-bg)',
          bg: 'var(--status-warning-bg)',
          text: 'var(--status-warning-text)',
          subtle: 'var(--status-warning-subtle)',
        },
        info: {
          DEFAULT: 'var(--status-info-bg)',
          bg: 'var(--status-info-bg)',
          text: 'var(--status-info-text)',
          subtle: 'var(--status-info-subtle)',
        },
        // Workout-specific
        workout: {
          strength: 'var(--workout-strength)',
          'strength-subtle': 'var(--workout-strength-subtle)',
          cardio: 'var(--workout-cardio)',
          'cardio-subtle': 'var(--workout-cardio-subtle)',
          mobility: 'var(--workout-mobility)',
          'mobility-subtle': 'var(--workout-mobility-subtle)',
          rest: 'var(--workout-rest)',
          'rest-subtle': 'var(--workout-rest-subtle)',
          power: 'var(--workout-power)',
          'power-subtle': 'var(--workout-power-subtle)',
        },
        // Interactive states
        interactive: {
          hover: 'var(--interactive-hover)',
          active: 'var(--interactive-active)',
          selected: 'var(--interactive-selected)',
        },
      },

      /* ───────────────────────────────────────────────────────────────
         SPACING - Token-based spacing scale
         ─────────────────────────────────────────────────────────────── */
      spacing: {
        'px': 'var(--space-px)',
        '0': 'var(--space-0)',
        '0.5': 'var(--space-0-5)',
        '1': 'var(--space-1)',
        '1.5': 'var(--space-1-5)',
        '2': 'var(--space-2)',
        '2.5': 'var(--space-2-5)',
        '3': 'var(--space-3)',
        '3.5': 'var(--space-3-5)',
        '4': 'var(--space-4)',
        '5': 'var(--space-5)',
        '6': 'var(--space-6)',
        '7': 'var(--space-7)',
        '8': 'var(--space-8)',
        '9': 'var(--space-9)',
        '10': 'var(--space-10)',
        '11': 'var(--space-11)',
        '12': 'var(--space-12)',
        '14': 'var(--space-14)',
        '16': 'var(--space-16)',
        '20': 'var(--space-20)',
        '24': 'var(--space-24)',
        '28': 'var(--space-28)',
        '32': 'var(--space-32)',
        // Component-specific
        'card': 'var(--space-card-padding)',
        'card-lg': 'var(--space-card-padding-lg)',
        'section': 'var(--space-section-gap)',
        'page': 'var(--space-page-padding)',
        'page-lg': 'var(--space-page-padding-lg)',
        // Safe areas
        'safe-top': 'var(--safe-top)',
        'safe-bottom': 'var(--safe-bottom)',
        'safe-left': 'var(--safe-left)',
        'safe-right': 'var(--safe-right)',
        // Component heights
        'touch-min': 'var(--height-touch-min)',
        'button': 'var(--height-button)',
        'button-sm': 'var(--height-button-sm)',
        'button-lg': 'var(--height-button-lg)',
        'input': 'var(--height-input)',
        'input-sm': 'var(--height-input-sm)',
        'navbar': 'var(--height-navbar)',
        'navbar-total': 'var(--height-navbar-total)',
        'header': 'var(--height-header)',
      },

      /* ───────────────────────────────────────────────────────────────
         BORDER RADIUS - Token-based
         ─────────────────────────────────────────────────────────────── */
      borderRadius: {
        'none': 'var(--radius-none)',
        'xs': 'var(--radius-xs)',
        'sm': 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        'full': 'var(--radius-full)',
      },

      /* ───────────────────────────────────────────────────────────────
         BOX SHADOW - Token-based
         ─────────────────────────────────────────────────────────────── */
      boxShadow: {
        'xs': 'var(--shadow-xs)',
        'sm': 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'xl': 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',
        'glow-brand': 'var(--shadow-glow-brand)',
        'glow-success': 'var(--shadow-glow-success)',
        'glow-error': 'var(--shadow-glow-error)',
        'ring-focus': 'var(--ring-focus)',
        'ring-error': 'var(--ring-error)',
      },

      /* ───────────────────────────────────────────────────────────────
         Z-INDEX - Clear hierarchy
         ─────────────────────────────────────────────────────────────── */
      zIndex: {
        'base': 'var(--z-base)',
        'above': 'var(--z-above)',
        'dropdown': 'var(--z-dropdown)',
        'sticky': 'var(--z-sticky)',
        'overlay': 'var(--z-overlay)',
        'modal': 'var(--z-modal)',
        'popover': 'var(--z-popover)',
        'tooltip': 'var(--z-tooltip)',
        'toast': 'var(--z-toast)',
        'max': 'var(--z-max)',
      },

      /* ───────────────────────────────────────────────────────────────
         TRANSITIONS - Token-based durations and easings
         ─────────────────────────────────────────────────────────────── */
      transitionDuration: {
        'instant': 'var(--duration-instant)',
        'fast': 'var(--duration-fast)',
        DEFAULT: 'var(--duration-normal)',
        'normal': 'var(--duration-normal)',
        'slow': 'var(--duration-slow)',
        'slower': 'var(--duration-slower)',
        'slowest': 'var(--duration-slowest)',
      },

      transitionTimingFunction: {
        DEFAULT: 'var(--ease-default)',
        'default': 'var(--ease-default)',
        'in': 'var(--ease-in)',
        'out': 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
        'spring': 'var(--ease-spring)',
        'bounce': 'var(--ease-bounce)',
        'smooth': 'var(--ease-smooth)',
      },

      /* ───────────────────────────────────────────────────────────────
         ANIMATIONS - Reference to CSS animations
         ─────────────────────────────────────────────────────────────── */
      animation: {
        'fade-in': 'fade-in var(--duration-normal) var(--ease-out)',
        'fade-in-up': 'fade-in-up var(--duration-normal) var(--ease-out)',
        'fade-in-down': 'fade-in-down var(--duration-normal) var(--ease-out)',
        'fade-in-scale': 'fade-in-scale var(--duration-fast) var(--ease-spring)',
        'slide-in-right': 'slide-in-right var(--duration-normal) var(--ease-out)',
        'slide-in-up': 'slide-in-up var(--duration-normal) var(--ease-out)',
        'scale-in': 'scale-in var(--duration-fast) var(--ease-spring)',
        'page-enter': 'page-enter var(--duration-slow) var(--ease-out)',
        'spin': 'spin var(--duration-slowest) linear infinite',
        'pulse': 'pulse 2s var(--ease-in-out) infinite',
        'pulse-subtle': 'pulse-subtle 3s var(--ease-in-out) infinite',
        'bounce-subtle': 'bounce-subtle 2s var(--ease-in-out) infinite',
        'shimmer': 'shimmer 1.5s linear infinite',
        'breathe': 'breathe 2s var(--ease-in-out) infinite',
      },

      /* ───────────────────────────────────────────────────────────────
         MIN/MAX WIDTHS - iPhone screen sizes
         ─────────────────────────────────────────────────────────────── */
      maxWidth: {
        'screen-mini': 'var(--screen-mini)',
        'screen-standard': 'var(--screen-standard)',
        'screen-pro': 'var(--screen-pro)',
        'screen-plus': 'var(--screen-plus)',
        'screen-max': 'var(--screen-max)',
      },

      minWidth: {
        'touch': 'var(--height-touch-min)',
      },

      minHeight: {
        'touch': 'var(--height-touch-min)',
        'button': 'var(--height-button)',
        'input': 'var(--height-input)',
      },

      height: {
        'touch-min': 'var(--height-touch-min)',
        'button': 'var(--height-button)',
        'button-sm': 'var(--height-button-sm)',
        'button-lg': 'var(--height-button-lg)',
        'input': 'var(--height-input)',
        'input-sm': 'var(--height-input-sm)',
        'navbar': 'var(--height-navbar)',
        'header': 'var(--height-header)',
      },
    },
  },
  plugins: [],
}
