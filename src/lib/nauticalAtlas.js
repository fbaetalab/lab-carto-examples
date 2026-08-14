import * as THREE from 'three';

/* ATLAS DE SIMBOLOGIA IALA — REGIÃO B (BRASIL)
   ============================================
   Gerado por Canvas2D em vez de SDF porque cada marca tem PARTES com cores
   diferentes — corpo, faixas e topmark — e um SDF de cor única não expressa
   isso. O atlas é procedural: nenhum asset externo, e a paleta fica a um
   lugar só de distância se precisar mudar.

   Paleta DESSATURADA, tirada do companion de simbologia. A cor da boia é
   informação primária, não decoração — é a única exceção ao monocromático do
   Twin, e não pode vazar para o resto do produto.

   Região B: PORTO = VERDE, BORESTE = VERMELHO. É o inverso da Europa.
   A forma é canônica junto com a cor: cilíndrica ("can") a bombordo, cônica
   ("nun") a boreste — de modo que a marca continua legível para quem é
   daltônico e em carta monocromática. */

const C = {
  green: '#3FA86B',
  red: '#D43F3F',
  yellow: '#D9B441',
  black: '#1A1C1F',
  white: '#E5E7EB',
  blue: '#4A7BB8',
  mast: '#71747A',
};

export const CELL = 192;
export const COLS = 4;

/* Ordem = índice no atlas. Não reordenar: a spec exporta pelo id, mas a
   geometria de instância carrega o índice. */
export const MARKS = [
  { id: 'lateralPort', label: 'Lateral bombordo', hint: 'Região B · verde · cilíndrica · ímpar' },
  { id: 'lateralStbd', label: 'Lateral boreste', hint: 'Região B · vermelha · cônica · par' },
  { id: 'prefChannelStbd', label: 'Canal pref. boreste', hint: 'verde com faixa vermelha' },
  { id: 'prefChannelPort', label: 'Canal pref. bombordo', hint: 'vermelha com faixa verde' },
  { id: 'cardinalN', label: 'Cardinal Norte', hint: 'cones para cima · preto sobre amarelo' },
  { id: 'cardinalE', label: 'Cardinal Leste', hint: 'bases juntas · preto-amarelo-preto' },
  { id: 'cardinalS', label: 'Cardinal Sul', hint: 'cones para baixo · amarelo sobre preto' },
  { id: 'cardinalW', label: 'Cardinal Oeste', hint: 'pontas juntas · amarelo-preto-amarelo' },
  { id: 'isolatedDanger', label: 'Perigo isolado', hint: 'preto com faixa vermelha · duas esferas' },
  { id: 'safeWater', label: 'Águas seguras', hint: 'listras vermelho/branco · esfera' },
  { id: 'specialMark', label: 'Marca especial', hint: 'amarela · topmark X' },
  { id: 'emergencyWreck', label: 'Naufrágio', hint: 'listras azul/amarelo · cruz' },
];

export const markIndex = (id) => Math.max(0, MARKS.findIndex((m) => m.id === id));

/* Geometria da célula. O corpo ocupa a metade inferior; mastro e topmark a
   superior — proporção de carta, onde o topmark precisa ler de longe.

   O glifo preenche ~75% da célula de propósito: como o billboard tem tamanho
   fixo em pixels, cada pixel de margem no atlas é pixel perdido na tela. Com
   margem generosa o símbolo sai ilegível mesmo com uSizePx alto. */
const BODY_TOP = 92, BODY_BOT = 176, HALF = 46;
const MAST_TOP = 60;
const TM = { cx: CELL / 2, y: 44, r: 30 };

function bodyPath(g, shape) {
  const cx = CELL / 2;
  g.beginPath();
  if (shape === 'can') {
    g.moveTo(cx - HALF, BODY_TOP); g.lineTo(cx + HALF, BODY_TOP);
    g.lineTo(cx + HALF, BODY_BOT); g.lineTo(cx - HALF, BODY_BOT);
  } else if (shape === 'nun') {
    g.moveTo(cx, BODY_TOP - 6); g.lineTo(cx + HALF, BODY_BOT); g.lineTo(cx - HALF, BODY_BOT);
  } else if (shape === 'sphere') {
    g.arc(cx, (BODY_TOP + BODY_BOT) / 2, HALF, 0, Math.PI * 2);
  } else { /* pillar */
    g.moveTo(cx - HALF * 0.62, BODY_TOP); g.lineTo(cx + HALF * 0.62, BODY_TOP);
    g.lineTo(cx + HALF * 0.78, BODY_BOT); g.lineTo(cx - HALF * 0.78, BODY_BOT);
  }
  g.closePath();
}

/* Faixas horizontais (cardeais, perigo isolado) ou verticais (águas seguras,
   naufrágio), sempre recortadas pela silhueta do corpo. */
function paintBody(g, shape, bands, vertical = false) {
  g.save();
  bodyPath(g, shape);
  g.clip();
  const x0 = CELL / 2 - HALF, span = HALF * 2;
  let acc = 0;
  for (const [color, frac] of bands) {
    g.fillStyle = color;
    if (vertical) g.fillRect(x0 + span * acc, BODY_TOP - 12, span * frac + 0.5, BODY_BOT - BODY_TOP + 24);
    else g.fillRect(x0 - 8, BODY_TOP + (BODY_BOT - BODY_TOP) * acc, span + 16, (BODY_BOT - BODY_TOP) * frac + 0.5);
    acc += frac;
  }
  g.restore();
  g.strokeStyle = 'rgba(10,12,14,.85)'; g.lineWidth = 2;
  bodyPath(g, shape); g.stroke();
}

function mast(g) {
  g.strokeStyle = C.mast; g.lineWidth = 6;
  g.beginPath(); g.moveTo(CELL / 2, BODY_TOP); g.lineTo(CELL / 2, MAST_TOP); g.stroke();
}

/* Cone do topmark. up=true → ponta para cima. */
function cone(g, cx, cy, r, up, color) {
  g.fillStyle = color;
  g.beginPath();
  if (up) { g.moveTo(cx, cy - r); g.lineTo(cx + r * 0.82, cy + r * 0.6); g.lineTo(cx - r * 0.82, cy + r * 0.6); }
  else { g.moveTo(cx, cy + r); g.lineTo(cx + r * 0.82, cy - r * 0.6); g.lineTo(cx - r * 0.82, cy - r * 0.6); }
  g.closePath(); g.fill();
}

const disc = (g, cx, cy, r, color) => { g.fillStyle = color; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); };

function drawMark(g, id) {
  const cx = CELL / 2;
  const h = TM.r * 0.62;

  switch (id) {
    case 'lateralPort':
      paintBody(g, 'can', [[C.green, 1]]); mast(g);
      g.fillStyle = C.green; g.fillRect(cx - 22, TM.y - 19, 44, 38);   /* topmark cilíndrico */
      break;
    case 'lateralStbd':
      paintBody(g, 'nun', [[C.red, 1]]); mast(g);
      cone(g, cx, TM.y, 24, true, C.red);                               /* topmark cônico */
      break;
    case 'prefChannelStbd':
      paintBody(g, 'can', [[C.green, 0.36], [C.red, 0.28], [C.green, 0.36]]); mast(g);
      g.fillStyle = C.green; g.fillRect(cx - 22, TM.y - 19, 44, 38);
      break;
    case 'prefChannelPort':
      paintBody(g, 'nun', [[C.red, 0.36], [C.green, 0.28], [C.red, 0.36]]); mast(g);
      cone(g, cx, TM.y, 24, true, C.red);
      break;

    /* Cardeais: o topmark é sempre DOIS cones pretos; muda a orientação.
       A faixa do corpo repete a lógica — preto do lado para onde o cone
       aponta. */
    case 'cardinalN':
      paintBody(g, 'pillar', [[C.black, 0.5], [C.yellow, 0.5]]); mast(g);
      cone(g, cx, TM.y - h * 0.62, h, true, C.black);
      cone(g, cx, TM.y + h * 0.72, h, true, C.black);
      break;
    case 'cardinalE':
      paintBody(g, 'pillar', [[C.black, 0.34], [C.yellow, 0.32], [C.black, 0.34]]); mast(g);
      /* BASES juntas: cone de cima aponta para cima, o de baixo para baixo —
         as bases largas se encontram no meio. */
      cone(g, cx, TM.y - h * 0.72, h, true, C.black);
      cone(g, cx, TM.y + h * 0.72, h, false, C.black);
      break;
    case 'cardinalS':
      paintBody(g, 'pillar', [[C.yellow, 0.5], [C.black, 0.5]]); mast(g);
      cone(g, cx, TM.y - h * 0.72, h, false, C.black);
      cone(g, cx, TM.y + h * 0.62, h, false, C.black);
      break;
    case 'cardinalW':
      paintBody(g, 'pillar', [[C.yellow, 0.34], [C.black, 0.32], [C.yellow, 0.34]]); mast(g);
      /* PONTAS juntas (ampulheta): cone de cima aponta para baixo, o de baixo
         para cima — as pontas se encontram no meio. */
      cone(g, cx, TM.y - h * 0.62, h, false, C.black);
      cone(g, cx, TM.y + h * 0.62, h, true, C.black);
      break;

    case 'isolatedDanger':
      paintBody(g, 'pillar', [[C.black, 0.32], [C.red, 0.3], [C.black, 0.38]]); mast(g);
      disc(g, cx, TM.y - 18, 15, C.black);                              /* duas esferas */
      disc(g, cx, TM.y + 18, 15, C.black);
      break;
    case 'safeWater':
      paintBody(g, 'sphere', [[C.red, 0.25], [C.white, 0.25], [C.red, 0.25], [C.white, 0.25]], true); mast(g);
      disc(g, cx, TM.y, 19, C.red);                                     /* esfera */
      break;
    case 'specialMark':
      paintBody(g, 'pillar', [[C.yellow, 1]]); mast(g);
      g.strokeStyle = C.yellow; g.lineWidth = 9; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(cx - 19, TM.y - 19); g.lineTo(cx + 19, TM.y + 19);
      g.moveTo(cx + 19, TM.y - 19); g.lineTo(cx - 19, TM.y + 19);
      g.stroke();
      break;
    case 'emergencyWreck':
      paintBody(g, 'pillar', [[C.blue, 0.25], [C.yellow, 0.25], [C.blue, 0.25], [C.yellow, 0.25]], true); mast(g);
      g.strokeStyle = C.yellow; g.lineWidth = 9; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(cx, TM.y - 21); g.lineTo(cx, TM.y + 21);
      g.moveTo(cx - 21, TM.y); g.lineTo(cx + 21, TM.y);
      g.stroke();
      break;
    default: break;
  }
}

export function buildNauticalAtlas() {
  const rows = Math.ceil(MARKS.length / COLS);
  const cv = document.createElement('canvas');
  cv.width = COLS * CELL;
  cv.height = rows * CELL;
  const g = cv.getContext('2d');

  MARKS.forEach((m, i) => {
    g.save();
    g.translate((i % COLS) * CELL, ((i / COLS) | 0) * CELL);
    drawMark(g, m.id);
    g.restore();
  });

  const t = new THREE.CanvasTexture(cv);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return { texture: t, cols: COLS, rows };
}
