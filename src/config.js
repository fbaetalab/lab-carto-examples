/* Constantes do domínio. Os presets mapeiam conceitos portuários reais —
   berços de atracação, zonas de fundeio, canal de navegação, limites
   administrativos — e devem continuar mapeando. */

export const PATTERNS = ['Solid', 'Hatch', 'CrossHatch', 'Dots', 'Plus', 'Cross', 'Checker', 'Bands', 'Symbol'];

export const MODES = [
  { id: 'Metros', btn: 'Metros', unit: 'm', cap: 'Tamanho físico real no terreno. Some em zoom distante — combine com visibilidade por zoom.' },
  { id: 'Pixels', btn: 'Px tela', unit: 'px', cap: 'Fixo na tela (2D/HUD). Ignora a perspectiva por definição — só como referência do paradigma Mapbox 2D.' },
  { id: 'PxPorMetro', btn: 'Px/metro', unit: 'px', cap: 'Ancorado no mundo. Escala 100–200% com o zoom e troca de nível em transição temporal (modelo pirâmide, como Mapbox).' },
];
/* Ordem de exibição dos modos: px/metro no meio, por ser o modo de referência. */
export const MODE_ORDER = [0, 2, 1];

export const WALL_STYLES = ['Pulso', 'Fluxo', 'Hex', 'Energia'];
export const WALL_STYLES_EN = ['Pulse', 'Flow', 'Hex', 'Energy'];

export const THEMES = {
  dark: { bg: 0x0C1114, zen: 0x0A0F13, hor: 0x18262E, fog: 0x141F26 },
  light: { bg: 0xDDE3E8, zen: 0xC9D4DC, hor: 0xE8EDF1, fog: 0xDDE4E9 },
};

/* Polígonos de teste: A tem furo (valida integridade do furo no drape e nas
   paredes), B é convexo e separado. */
export const POLY_A_OUTER = [[-180, -120], [120, -160], [200, -20], [90, 40], [150, 160], [-40, 120], [-120, 170], [-200, 30]];
export const POLY_A_HOLE = [[-60, -40], [30, -60], [50, 10], [-30, 30]];
export const POLY_B = [[240, -120], [320, -140], [340, -70], [260, -50]];
export const RINGS = [POLY_A_OUTER, POLY_A_HOLE, POLY_B];

/* Retângulo de mundo coberto pela máscara top-down usada no drape. */
export const MASK = { xmin: -340, zmin: -300, sx: 800, sz: 620 };

export const DEFAULT_STATE = {
  pattern: 2, mode: 2,
  spacing: 24, lw: 1.6, sym: 16, rot: 45,
  baseColor: '#D64545', baseA: 0.25,
  patColor: '#7A1010', patA: 0.9,
  outColor: '#FF5050', outW: 1.5, dash: 6,
  minPx: 8, maxPx: 120, tint: true,
  visOn: false, minZ: 12, maxZ: 22, fadeR: 1, theme: 'dark', bld: true, post: true, bloom: 0.8,
  shadows: true, ssao: true, sunAz: 130, sunEl: 34,
  repPlane: false, repDrape: true, repWalls: true, repVolume: false, repScatter: false,
  planeY: 0.5, wallH: 26, volBase: -16, volTop: 2, animOn: true, animSpeed: 1, wallStyle: 0, volAnim: false,
  contours: true, sea: true,
};
