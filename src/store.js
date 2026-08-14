import { create } from 'zustand';
import { DEFAULT_STATE } from './config.js';

/* Estado único do playground. Os componentes leem fatias específicas para não
   re-renderizar à toa; o que muda a cada frame (LOD, readouts) NÃO passa por
   aqui — vai direto para uniforms/DOM. */
let toastTimer = null;

export const useStore = create((set) => ({
  ...DEFAULT_STATE,
  toast: '',

  set: (patch) => set(patch),
  setKey: (k, v) => set({ [k]: v }),
  applyPreset: (p) => set(p),

  showToast: (msg) => {
    set({ toast: msg });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: '' }), 1600);
  },
}));

/* Leitura fora de componente (dentro do useFrame), sem assinar mudanças. */
export const readState = () => useStore.getState();
