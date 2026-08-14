import { POLY_A_OUTER, POLY_A_HOLE, POLY_B } from './config.js';

/* MODELO DE CAMADA
   ================
   O objeto do domínio é CAMADA, não "um padrão". Um operador não configura
   "hachura 45°" — configura *berço de atracação*, *zona de fundeio*, *canal de
   navegação*. Todas coexistem na mesma cena. É o modelo do painel "Camadas" do
   produto.

   E cada camada tem TRÊS COMPONENTES INDEPENDENTES, cada um com cor própria:

     fill    o preenchimento da área — padrão cartográfico, na superfície
     stroke  a borda — largura em metros, dash, casing
     volume  a ocupação do espaço — paredes, prisma extrudado ou distribuição

   Tratar os três como um objeto só foi o erro original: na prática se quer
   preenchimento discreto com borda forte, ou volume âmbar sobre preenchimento
   neutro. Cada componente liga/desliga e se colore sozinho.

   `fill.surface` decide ONDE o preenchimento é desenhado — drapeado no relevo
   ou num plano de cota fixa. Não é uma "representação" separada; é uma
   propriedade do preenchimento. */

/* Geometrias dispostas como um porto de verdade: a costa fica em x≈190 (onde
   terrainH cruza zero), terra à esquerda, água à direita. Camadas com
   geometrias distintas é o que permite lê-las como camadas — empilhar todas
   no mesmo polígono só produz sopa. Em produção estas vêm de shapefile/MVT. */
const g = (label, outer, holes = []) => ({ label, outer, holes, rings: [outer, ...holes] });

export const GEOMETRIES = {
  /* retroárea em terra, com um furo — valida integridade do furo no drape */
  retroarea: g('Retroárea', POLY_A_OUTER.map(([x, z]) => [x * 0.55 - 60, z * 0.75]), [POLY_A_HOLE.map(([x, z]) => [x * 0.55 - 60, z * 0.75])]),
  /* faixa de cais, alongada no eixo do berço */
  cais: g('Faixa de cais', [[120, -270], [186, -270], [186, -40], [120, -40]]),
  /* canal correndo ao largo, levemente divergente */
  canal: g('Canal', [[250, -390], [345, -390], [395, 390], [300, 390]]),
  /* fundeio ao largo, polígono irregular */
  fundeio: g('Fundeio', [[440, -140], [650, -180], [672, 60], [560, 120], [455, 80]]),
  /* área dragada junto ao cais */
  dragada: g('Área dragada', [[196, 30], [330, 8], [352, 205], [206, 232]]),
  /* limite administrativo envolvendo o conjunto */
  limite: g('Limite administrativo', [[-330, -400], [700, -400], [700, 400], [-330, 400]]),
};

/* Polilinhas ABERTAS — feição linear de verdade, com comprimento e sem área. */
export const LINES = {
  eixoCanal: { label: 'Eixo do canal', pts: [[298, -400], [312, -200], [330, 0], [352, 200], [372, 400]] },
  isobata10: { label: 'Isóbata −10 m', pts: [[210, -400], [232, -230], [246, -60], [258, 110], [276, 290], [292, 400]] },
  isobata20: { label: 'Isóbata −20 m', pts: [[420, -400], [438, -210], [452, -20], [470, 170], [492, 400]] },
  duto: { label: 'Duto submarino', pts: [[150, 120], [260, 150], [380, 132], [500, 96]] },
};

/* Pontos. `family` decide o renderizador: 'generic' usa glifos por SDF,
   'nautical' amostra o atlas IALA — onde a cor é normativa, não escolha. */
export const POINTS = {
  estacoes: {
    label: 'Estações',
    family: 'generic',
    items: [
      { at: [430, 60], kind: 3, label: 'Estação maregráfica' },
      { at: [176, -150], kind: 4, label: 'Ponto de atracação' },
      { at: [120, 40], kind: 1, label: 'Torre de controle' },
    ],
  },
  /* Balizamento do canal, Região B: entrando do mar (−z para +z), a margem
     ESQUERDA é bombordo/verde com numeração ÍMPAR e a direita boreste/
     vermelha com numeração PAR. */
  balizamento: {
    label: 'Balizamento IALA',
    family: 'nautical',
    items: [
      { at: [258, -300], mark: 'lateralPort', label: 'Verde 3' },
      { at: [352, -290], mark: 'lateralStbd', label: 'Vermelha 2' },
      { at: [272, -40], mark: 'lateralPort', label: 'Verde 5' },
      { at: [368, -20], mark: 'lateralStbd', label: 'Vermelha 4' },
      { at: [318, 210], mark: 'safeWater', label: 'Águas seguras' },
      { at: [452, 140], mark: 'isolatedDanger', label: 'Perigo isolado' },
      { at: [500, -60], mark: 'cardinalS', label: 'Cardinal Sul' },
      { at: [206, 170], mark: 'specialMark', label: 'Marca especial' },
    ],
  },
};

export const VOLUME_KINDS = [
  { id: 'walls', label: 'Paredes', hint: 'perímetro legível de longe' },
  { id: 'prism', label: 'Prisma', hint: 'ocupa faixa de cota' },
  { id: 'scatter', label: 'Distribuição', hint: 'densidade no volume' },
];

export const SURFACES = [
  { id: 'drape', label: 'Drapeado', hint: 'segue o relevo' },
  { id: 'plane', label: 'Cota fixa', hint: 'plano horizontal' },
];

export const defaultFill = () => ({
  on: true,
  surface: 'drape',
  elevation: 0.5,
  pattern: 2, mode: 2,
  spacing: 24, lw: 1.6, sym: 16, rot: 45,
  arrange: 0, seed: 1337, brickOff: 0.5, shapeW: 45,
  minPx: 8, maxPx: 120, tint: true,
  color: '#D64545', opacity: 0.22,          // preenchimento base
  patternColor: '#FF5050', patternOpacity: 0.55,  // traço do padrão
});

export const defaultStroke = () => ({
  on: true,
  color: '#FF5050', width: 1.5, dash: 6,
  casingColor: '#0D0F11', casingWidth: 0,
});

export const defaultVolume = () => ({
  on: false,
  kind: 'walls',
  color: '#FF5050', opacity: 1,
  base: -16, top: 26,
  wallStyle: 0, animate: true, speed: 1, pulse: false,
});

export const defaultVis = () => ({ on: false, minZ: 12, maxZ: 22, fadeR: 1 });

/* Estilo da primitiva LINHA. Largura em metros, como a borda — feição
   cartográfica linear tem largura física, não de tela. */
export const defaultLine = () => ({
  on: true, style: 1,
  color: '#7FB8E8', opacity: 1,
  width: 3, dash: 18, gap: 12,
  surface: 'drape', elevation: 0.6,
});

/* Estilo da primitiva PONTO. Tamanho em PIXELS. */
export const defaultPoint = () => ({
  on: true, kind: 0, size: 22,
  color: '#8FE0BF', opacity: 1,
  labels: true,
  /* Marcas náuticas ignoram `color`: a cor IALA é normativa. */
  tint: false,
});

const layer = (id, name, code, geometry, fill, stroke, volume) => ({
  id, name, code, kind: 'polygon', geometry, visible: true,
  fill: { ...defaultFill(), ...fill },
  stroke: { ...defaultStroke(), ...stroke },
  volume: { ...defaultVolume(), ...volume },
  vis: defaultVis(),
});

const lineLayer = (id, name, code, geometry, line) => ({
  id, name, code, kind: 'line', geometry, visible: true,
  line: { ...defaultLine(), ...line },
  vis: defaultVis(),
});

const pointLayer = (id, name, code, geometry, point) => ({
  id, name, code, kind: 'point', geometry, visible: true,
  point: { ...defaultPoint(), ...point },
  vis: defaultVis(),
});

/* Camadas iniciais — vocabulário portuário real. Repare que as cores dos três
   componentes divergem de propósito em várias delas: é o caso de uso. */
export const INITIAL_LAYERS = [
  layer('restrita', 'Zona restrita', 'ZR-01', 'retroarea',
    { pattern: 2, spacing: 24, lw: 1.6, rot: 45, color: '#D64545', opacity: 0.20, patternColor: '#FF5050', patternOpacity: 0.55 },
    { color: '#FF5050', width: 1.5, dash: 6 },
    { on: true, kind: 'walls', color: '#FF7A5A', top: 30, wallStyle: 0 }),

  layer('fundeio', 'Zona de fundeio', 'FD-02', 'fundeio',
    { pattern: 4, spacing: 46, lw: 2.4, rot: 0, arrange: 1, surface: 'drape', color: '#2A6FB0', opacity: 0.14, patternColor: '#7FB8E8', patternOpacity: 0.9 },
    { color: '#7FB8E8', width: 1, dash: 0 },
    { on: true, kind: 'prism', color: '#4E9BD8', base: -18, top: 0, pulse: true }),

  layer('canal', 'Canal de navegação', 'CN-03', 'canal',
    { pattern: 7, spacing: 52, lw: 21, rot: 60, color: '#2FA894', opacity: 0.10, patternColor: '#45D6C4', patternOpacity: 0.42 },
    { on: false },
    { on: true, kind: 'walls', color: '#45D6C4', top: 3, wallStyle: 1 }),

  layer('berco', 'Berço de atracação', 'BC-04', 'cais',
    { pattern: 0, mode: 0, surface: 'plane', elevation: 2, color: '#E4C75B', opacity: 0.30, patternOpacity: 0 },
    { color: '#E4C75B', width: 1.5, dash: 0, casingWidth: 0.8 },
    { on: true, kind: 'walls', color: '#F0DC96', top: 10, wallStyle: 2, animate: false }),

  layer('dragada', 'Área dragada', 'DR-05', 'dragada',
    { pattern: 3, spacing: 22, lw: 5, rot: 0, arrange: 1, color: '#3E7CB8', opacity: 0.10, patternColor: '#9DC7EA', patternOpacity: 0.9 },
    { color: '#9DC7EA', width: 1, dash: 5 },
    { on: false }),

  layer('limite', 'Limite administrativo', 'LM-06', 'limite',
    { pattern: 0, mode: 0, surface: 'plane', elevation: 28, opacity: 0, patternOpacity: 0 },
    { color: '#D4D4D8', width: 2, dash: 12, casingWidth: 1.2 },
    { on: false }),

  lineLayer('eixo', 'Eixo do canal', 'EX-07', 'eixoCanal',
    { style: 3, color: '#9DC7EA', width: 2.5, dash: 26, gap: 14 }),
  lineLayer('iso10', 'Isóbata −10 m', 'IS-08', 'isobata10',
    { style: 0, color: '#4E8FB8', width: 1.6, opacity: 0.75 }),
  lineLayer('duto', 'Duto submarino', 'DT-09', 'duto',
    { style: 5, color: '#F59E0B', width: 4 }),

  pointLayer('estacoes', 'Estações e sensores', 'ES-10', 'estacoes',
    { kind: 3, size: 20, color: '#8FE0BF' }),
  pointLayer('balizas', 'Balizamento IALA', 'BZ-11', 'balizamento',
    { size: 46, labels: true }),
];

/* Cor representativa da camada na lista: a mais "presente" dos três. */
export function layerSwatch(l) {
  if (l.kind === 'line') return l.line.color;
  if (l.kind === 'point') return l.point.color;
  if (l.fill.on && l.fill.opacity > 0.02) return l.fill.color;
  if (l.stroke.on) return l.stroke.color;
  if (l.volume.on) return l.volume.color;
  return '#4B5057';
}
