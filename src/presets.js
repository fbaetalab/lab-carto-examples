/* Presets = vocabulário do domínio portuário traduzido em parâmetros.
   Cada entrada é um patch parcial sobre o estado. */
export const PRESETS = [
  {
    n: 'Zona restrita',
    p: {
      pattern: 2, mode: 2, spacing: 24, lw: 1.6, rot: 45, baseColor: '#D64545', baseA: .25, patColor: '#FF5050', patA: .55, outColor: '#FF5050', outW: 1.5, dash: 6,
      repPlane: false, repDrape: true, repWalls: true, repVolume: false, repScatter: false, wallH: 30, animOn: true, wallStyle: 0,
    },
  },
  {
    n: 'Fundeio',
    p: {
      pattern: 4, mode: 2, spacing: 46, lw: 2.4, rot: 0, baseColor: '#2A6FB0', baseA: .14, patColor: '#7FB8E8', patA: .95, outColor: '#7FB8E8', outW: 1, dash: 0,
      repPlane: false, repDrape: true, repWalls: false, repVolume: true, repScatter: true, volBase: -18, volTop: 0, volAnim: true,
    },
  },
  {
    n: 'Área dragada',
    p: {
      pattern: 3, mode: 2, spacing: 22, lw: 5, rot: 0, baseColor: '#3E7CB8', baseA: .10, patColor: '#9DC7EA', patA: .9, outColor: '#9DC7EA', outW: 1, dash: 5,
      repPlane: false, repDrape: true, repWalls: false, repVolume: false, repScatter: false,
    },
  },
  {
    n: 'Canal de naveg.',
    p: {
      pattern: 7, mode: 2, spacing: 52, lw: 21, rot: 60, baseColor: '#45D6C4', baseA: .10, patColor: '#45D6C4', patA: .45, outColor: '#45D6C4', outW: 0, dash: 0,
      repPlane: false, repDrape: true, repWalls: true, repVolume: true, repScatter: false, volBase: -16, volTop: 1, wallH: 1, animOn: true, wallStyle: 1, volAnim: false,
    },
  },
  {
    n: 'Berço',
    p: {
      pattern: 0, mode: 0, baseColor: '#E4C75B', baseA: .30, patA: 0, outColor: '#E4C75B', outW: 1.5, dash: 0,
      repPlane: true, repDrape: false, repWalls: true, repVolume: false, repScatter: false, planeY: 2, wallH: 10, animOn: false, wallStyle: 2,
    },
  },
  {
    n: 'Limite adm.',
    p: {
      pattern: 0, mode: 0, baseA: 0, patA: 0, outColor: '#C7D3D9', outW: 2, dash: 12,
      repPlane: true, repDrape: false, repWalls: false, repVolume: false, repScatter: false, planeY: 28,
    },
  },
  {
    n: 'Sobreposição',
    p: {
      pattern: 1, mode: 2, spacing: 18, lw: 1.3, rot: 45, baseColor: '#C9A227', baseA: .15, patColor: '#E4C75B', patA: .85, outColor: '#E4C75B', outW: .8, dash: 0,
      repPlane: false, repDrape: true, repWalls: false, repVolume: false, repScatter: false,
    },
  },
  {
    n: 'Símbolo',
    p: {
      pattern: 8, mode: 2, spacing: 56, sym: 26, rot: 0, baseColor: '#2F8F6E', baseA: .12, patColor: '#8FE0BF', patA: .95, outColor: '#8FE0BF', outW: 1, dash: 0,
      repPlane: false, repDrape: true, repWalls: false, repVolume: false, repScatter: false,
    },
  },
];
