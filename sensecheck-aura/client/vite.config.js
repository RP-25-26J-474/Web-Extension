import { defineConfig, loadEnv } from 'vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_API_URL = 'http://localhost:3000/api';

function resolveApiConfig(rawApiUrl) {
  const candidate = String(rawApiUrl || DEFAULT_API_URL).trim();

  try {
    const parsedUrl = new URL(candidate);
    return {
      apiUrl: parsedUrl.toString().replace(/\/+$/, ''),
      apiOrigin: parsedUrl.origin,
    };
  } catch {
    const fallbackUrl = new URL(DEFAULT_API_URL);
    return {
      apiUrl: DEFAULT_API_URL,
      apiOrigin: fallbackUrl.origin,
    };
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Use config file dir so .env is found regardless of where dev server is started.
  const envDir = resolve(__dirname);
  const env = loadEnv(mode, envDir, '');
  const { apiUrl, apiOrigin } = resolveApiConfig(env.VITE_API_URL);

  return {
    envDir,
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
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/')) {
              return id.split('node_modules/')[1].split('/')[0];
            }
            return undefined;
          },
        },
      },
    },
  };
});
