import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx,vue,svelte}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#7f9fbb',
          strong: '#b7cee2',
          soft: '#dce7f0',
          muted: '#5f7892'
        },
        surface: {
          light: '#ffffff',
          dark: '#050816'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', 'Georgia', 'ui-serif', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      boxShadow: {
        card: '0 24px 60px rgba(15, 23, 42, 0.08)',
        panel: '0 18px 40px rgba(2, 8, 23, 0.08)',
        glow: '0 0 0 1px rgba(148, 163, 184, 0.1), 0 32px 80px rgba(15, 23, 42, 0.14)'
      },
      maxWidth: {
        reading: '72ch'
      },
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': theme('colors.zinc.700'),
            '--tw-prose-headings': theme('colors.zinc.950'),
            '--tw-prose-links': theme('colors.accent.DEFAULT'),
            '--tw-prose-bold': theme('colors.zinc.950'),
            '--tw-prose-counters': theme('colors.zinc.500'),
            '--tw-prose-bullets': theme('colors.accent.muted'),
            '--tw-prose-hr': theme('colors.zinc.200'),
            '--tw-prose-quotes': theme('colors.zinc.800'),
            '--tw-prose-quote-borders': theme('colors.accent.soft'),
            '--tw-prose-captions': theme('colors.zinc.500'),
            '--tw-prose-code': theme('colors.zinc.900'),
            '--tw-prose-pre-code': theme('colors.zinc.100'),
            '--tw-prose-pre-bg': '#0f172a',
            '--tw-prose-th-borders': theme('colors.zinc.300'),
            '--tw-prose-td-borders': theme('colors.zinc.200'),
            maxWidth: 'none',
            fontSize: '1.05rem',
            lineHeight: '1.95',
            h2: {
              fontFamily: theme('fontFamily.serif').join(', '),
              fontWeight: '600',
              letterSpacing: '-0.02em'
            },
            h3: {
              fontWeight: '600',
              letterSpacing: '-0.02em'
            },
            a: {
              textDecoration: 'none',
              fontWeight: '500'
            },
            'a:hover': {
              color: theme('colors.accent.strong')
            },
            blockquote: {
              borderLeftWidth: '1px',
              fontStyle: 'normal',
              paddingLeft: '1.25rem'
            },
            code: {
              fontWeight: '500'
            },
            'code::before, code::after': {
              content: 'none'
            },
            pre: {
              borderRadius: '1.5rem',
              border: `1px solid ${theme('colors.slate.800')}`,
              boxShadow: '0 20px 50px rgba(15, 23, 42, 0.24)'
            },
            img: {
              borderRadius: '1.5rem',
              border: `1px solid ${theme('colors.zinc.200')}`
            },
            table: {
              fontSize: '0.95rem'
            }
          }
        },
        invert: {
          css: {
            '--tw-prose-body': theme('colors.zinc.300'),
            '--tw-prose-headings': theme('colors.zinc.50'),
            '--tw-prose-links': theme('colors.accent.strong'),
            '--tw-prose-bold': theme('colors.zinc.100'),
            '--tw-prose-counters': theme('colors.zinc.400'),
            '--tw-prose-bullets': theme('colors.accent.muted'),
            '--tw-prose-hr': theme('colors.zinc.800'),
            '--tw-prose-quotes': theme('colors.zinc.100'),
            '--tw-prose-quote-borders': theme('colors.slate.700'),
            '--tw-prose-captions': theme('colors.zinc.400'),
            '--tw-prose-code': theme('colors.zinc.100'),
            '--tw-prose-pre-code': theme('colors.zinc.100'),
            '--tw-prose-pre-bg': '#020617',
            '--tw-prose-th-borders': theme('colors.zinc.700'),
            '--tw-prose-td-borders': theme('colors.zinc.800'),
            blockquote: {
              color: theme('colors.zinc.200')
            },
            img: {
              border: `1px solid ${theme('colors.zinc.800')}`
            }
          }
        }
      })
    }
  },
  plugins: [typography]
};
