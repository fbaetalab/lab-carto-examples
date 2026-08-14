import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base = subpasta do GitHub Pages (https://<user>.github.io/<repo>/).
// Em dev fica '/', para o servidor local servir da raiz.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/lab-carto-examples/' : '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Sem sourcemap: são 6 MB que ninguém baixa em produção. O GLSL continua
    // legível no bundle, que é o que importa para usar isto como referência.
    sourcemap: false,
  },
}));
