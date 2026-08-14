import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base = subpasta do GitHub Pages (https://<user>.github.io/<repo>/).
// Em dev fica '/', para o servidor local servir da raiz.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/lab-carto-examples/' : '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    // O playground é referência visual: sourcemap facilita ler o GLSL no browser.
    sourcemap: true,
  },
}));
