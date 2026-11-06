/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

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
        // Un solo chunk de arranque (D4 de `improve-mobile-performance`): todo lo que el entry importa de
        // forma estática va en `app`; los `import()` (panel, menús, animación) siguen en sus chunks.
        codeSplitting: { groups: [{ name: 'app', tags: ['$initial'] }] },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{spec,test}.{ts,tsx}'],
    css: false,
    // D7 de `polish-views-updated-at-and-builder`: en frío (tras un build, con el disco sin caché) los tests largos
    // con `userEvent` del panel superan los 5 s por defecto. Solo cubre el tiempo del test y de los hooks: el
    // `asyncUtilTimeout` de `src/test/setup.ts` sigue en 1 s, así que un `findBy` lento de verdad sigue fallando.
    testTimeout: 15_000,
    hookTimeout: 30_000,
    env: {
      // Rutas absolutas para fetch en Node; MSW intercepta este host.
      VITE_API_URL: 'http://api.test',
    },
  },
});
