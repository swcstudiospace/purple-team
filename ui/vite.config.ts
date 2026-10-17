import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Run from the repo root (`npm run ui:dev` / `npm run ui:build`). `root` is
// resolved against the working directory, so `outDir: 'dist'` lands in ui/dist.
export default defineConfig({
  root: 'ui',
  base: '/app/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3333',
      '/ui': 'http://127.0.0.1:3333',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
