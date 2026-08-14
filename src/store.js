import { create } from 'zustand';
import { INITIAL_LAYERS } from './layers.js';

/* Estado do configurador. A unidade é a CAMADA; o que muda por frame (LOD,
   readouts) não passa por aqui — vai direto para uniforms/DOM. */
let toastTimer = null;

export const useStore = create((set, get) => ({
  layers: INITIAL_LAYERS,
  selectedId: INITIAL_LAYERS[0].id,
  /* Componente em edição: fill | stroke | volume. */
  component: 'fill',

  scene: { sun: { az: 130, el: 34 }, post: true, ssao: true, bloom: 0.8, shadows: true, buildings: false, sea: true, contours: true },
  toast: '',

  select: (id) => set({ selectedId: id }),
  setComponent: (component) => set({ component }),

  /* Patch imutável de um componente da camada selecionada. */
  patch: (component, changes) => set((s) => ({
    layers: s.layers.map((l) => (l.id === s.selectedId
      ? { ...l, [component]: { ...l[component], ...changes } }
      : l)),
  })),
  patchLayer: (changes) => set((s) => ({
    layers: s.layers.map((l) => (l.id === s.selectedId ? { ...l, ...changes } : l)),
  })),
  toggleVisible: (id) => set((s) => ({
    layers: s.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
  })),
  patchScene: (changes) => set((s) => ({ scene: { ...s.scene, ...changes } })),

  selected: () => get().layers.find((l) => l.id === get().selectedId),

  showToast: (msg) => {
    set({ toast: msg });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: '' }), 1800);
  },
}));

export const readState = () => useStore.getState();
export const useSelected = () => useStore((s) => s.layers.find((l) => l.id === s.selectedId));
