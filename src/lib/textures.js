import * as THREE from 'three';
import { MASK, SHAPE_RANGE_M, POLY_A_OUTER, POLY_A_HOLE, POLY_B } from '../config.js';

const MASK_RES = 1024;

/* Símbolo padrão: asterisco de três traços. */
export function defaultSymbolCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff'; g.lineWidth = 22; g.lineCap = 'round';
  g.translate(128, 128);
  for (let i = 0; i < 3; i++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(0, -96); g.lineTo(0, 96); g.stroke(); }
  return c;
}

export function symbolTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

/* Encaixa a imagem carregada num quadrado 256², preservando proporção. */
export function imageToSymbolCanvas(img) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = Math.min(256 / img.width, 256 / img.height);
  g.drawImage(img, (256 - img.width * r) / 2, (256 - img.height * r) / 2, img.width * r, img.height * r);
  return c;
}

/* Transformada de distância por chamfer em duas passadas.
   Os custos são anisotrópicos (mx, my, diagonal) porque a máscara cobre uma
   área retangular numa textura quadrada — usar custo 1 daria distância errada
   no eixo mais comprimido. Saída já em METROS. */
function chamferDistanceMeters(inside, w, h, mx, my) {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = inside[i] ? INF : 0;
  const dg = Math.hypot(mx, my);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let m = d[i];
      if (y > 0) {
        m = Math.min(m, d[i - w] + my);
        if (x > 0) m = Math.min(m, d[i - w - 1] + dg);
        if (x < w - 1) m = Math.min(m, d[i - w + 1] + dg);
      }
      if (x > 0) m = Math.min(m, d[i - 1] + mx);
      d[i] = m;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let m = d[i];
      if (y < h - 1) {
        m = Math.min(m, d[i + w] + my);
        if (x > 0) m = Math.min(m, d[i + w - 1] + dg);
        if (x < w - 1) m = Math.min(m, d[i + w + 1] + dg);
      }
      if (x < w - 1) m = Math.min(m, d[i + 1] + mx);
      d[i] = m;
    }
  }
  return d;
}

/* Máscara top-down dos polígonos (mundo → textura), com dois canais:
     R = cobertura, consumida pelo drape do terreno;
     G = distância até a borda em metros / SHAPE_RANGE_M, consumida pelo
         shapeburst.
   O furo sai do evenodd, o que mantém o polígono com furo íntegro — e, de
   quebra, a distância também respeita o furo, então o shapeburst decai a
   partir da borda interna. */
export function buildMaskTexture(shapes, bounds) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = MASK_RES;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.clearRect(0, 0, MASK_RES, MASK_RES);
  g.fillStyle = '#fff';
  const P = (pts) => {
    pts.forEach((p, i) => {
      const px = (p[0] - bounds.xmin) / bounds.sx * MASK_RES;
      const py = (1 - (p[1] - bounds.zmin) / bounds.sz) * MASK_RES;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    });
    g.closePath();
  };
  /* Um beginPath por feição: assim o evenodd de cada furo não interfere na
     feição vizinha. */
  for (const sh of shapes) {
    g.beginPath();
    P(sh.outer);
    (sh.holes || []).forEach(P);
    g.fill('evenodd');
  }

  const src = g.getImageData(0, 0, MASK_RES, MASK_RES).data;
  const inside = new Uint8Array(MASK_RES * MASK_RES);
  for (let i = 0; i < inside.length; i++) inside[i] = src[i * 4 + 3] > 127 ? 1 : 0;

  const dist = chamferDistanceMeters(
    inside, MASK_RES, MASK_RES,
    bounds.sx / MASK_RES, bounds.sz / MASK_RES,
  );

  /* DataTexture não aplica flipY, e o desenho acima assume a origem do canvas
     no topo — daí a inversão de linha ao copiar. */
  const data = new Uint8Array(MASK_RES * MASK_RES * 4);
  for (let r = 0; r < MASK_RES; r++) {
    const srcRow = MASK_RES - 1 - r;
    for (let x = 0; x < MASK_RES; x++) {
      const si = srcRow * MASK_RES + x;
      const di = (r * MASK_RES + x) * 4;
      data[di] = inside[si] ? 255 : 0;
      data[di + 1] = Math.round(Math.min(dist[si] / SHAPE_RANGE_M, 1) * 255);
      data[di + 2] = 0;
      data[di + 3] = 255;
    }
  }

  const t = new THREE.DataTexture(data, MASK_RES, MASK_RES, THREE.RGBAFormat);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/* Máscara padrão da cena principal: os três anéis fixos. */
export function makeMaskTexture() {
  return buildMaskTexture(
    [{ outer: POLY_A_OUTER, holes: [POLY_A_HOLE] }, { outer: POLY_B }],
    MASK,
  );
}
