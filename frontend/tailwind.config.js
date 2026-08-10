/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0A0E14',
          panel: '#121826',
          panel2: '#1B2338',
          border: '#262F47'
        },
        iris: {
          DEFAULT: '#4CC9F0',
          dim: '#2A8FB0'
        },
        amber: {
          DEFAULT: '#F4A259'
        },
        mist: {
          DEFAULT: '#EDEFF7',
          muted: '#8B93AC'
        },
        okgreen: '#6EE7B7',
        alert: '#F87171'
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(76,201,240,0.25), 0 0 24px rgba(76,201,240,0.12)',
        card: '0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px rgba(0,0,0,0.35)'
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(0.9)', opacity: '0.8' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' }
        },
        spinSlow: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' }
        }
      },
      animation: {
        pulseRing: 'pulseRing 2.2s cubic-bezier(0.4,0,0.2,1) infinite',
        spinSlow: 'spinSlow 8s linear infinite'
      }
    }
  },
  plugins: []
}
