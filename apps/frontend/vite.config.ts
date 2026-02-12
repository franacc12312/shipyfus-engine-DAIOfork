import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Load env vars from monorepo root to get PORT and FRONTEND_PORT
  const rootEnv = loadEnv(mode, resolve(__dirname, '../..'), '');

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: parseInt(rootEnv.FRONTEND_PORT || '5173'),
      proxy: {
        '/api': `http://localhost:${rootEnv.PORT || '3001'}`,
      },
    },
  };
});
