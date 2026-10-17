import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Run from the repo root (`npm run ui:dev` / `npm run ui:build`). `root` is
// resolved against the working directory, so `outDir: 'dist'` lands in ui/dist.
export default defineConfig({
  root: 'ui',
  base: '/app/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
