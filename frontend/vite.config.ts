/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const CHUNKS: Record<string, RegExp> = {
  react: /[\\/]node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
  motion: /[\\/]node_modules[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/,
  query: /[\\/]node_modules[\\/]@tanstack[\\/]/,
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // En desarrollo el backend corre en 3300 (ver backend/.env); VITE_API_URL queda vacío.
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:3300',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          for (const [name, pattern] of Object.entries(CHUNKS)) {
            if (pattern.test(id)) return name;
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{spec,test}.{ts,tsx}'],
    css: false,
    env: {
      // Rutas absolutas para fetch en Node; MSW intercepta este host.
      VITE_API_URL: 'http://api.test',
    },
  },
});
