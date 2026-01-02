/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cyber-blue': {
          50: '#e6f1ff',
          100: '#b3d9ff',
          200: '#80c0ff',
          300: '#4da8ff',
          400: '#1a90ff',
          500: '#0077e6',
          600: '#005cb3',
          700: '#004280',
          800: '#00294d',
          900: '#000f1a',
        },
        'cyber-purple': {
          50: '#f3e5ff',
          100: '#d9b3ff',
          200: '#bf80ff',
          300: '#a54dff',
          400: '#8b1aff',
          500: '#7200e6',
          600: '#5800b3',
          700: '#3e0080',
          800: '#24004d',
          900: '#0a001a',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-cyber': 'linear-gradient(135deg, #0077e6 0%, #7200e6 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #0077e6, 0 0 10px #0077e6' },
          '100%': { boxShadow: '0 0 10px #7200e6, 0 0 20px #7200e6' },
        },
      },
    },
  },
  plugins: [],
}

