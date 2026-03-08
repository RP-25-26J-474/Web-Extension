import { defineConfig, loadEnv } from 'vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Use config file dir so .env is found regardless of where dev server is started
  const envDir = resolve(__dirname);
  const env = loadEnv(mode, envDir, '');
  const apiUrl = env.VITE_API_URL || 'http://localhost:3000/api';
  const apiOrigin = new URL(apiUrl).origin;

  return {
    envDir: envDir,
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
    },
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiOrigin,
          changeOrigin: true,
        },
      },
    },
  };
});

