import * as THREE from 'three';

export const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const len2 = (a) => Math.hypot(a[0], a[1]);
export function norm2(a) { const l = len2(a) || 1; return [a[0] / l, a[1] / l]; }

/* Ponto em polígono (ray casting) — usado para semear os volumes distribuídos. */
export function pip(x, z, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], zi = ring[i][1], xj = ring[j][0], zj = ring[j][1];
    if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) c = !c;
  }
  return c;
}

/* Polígono XZ com furos. O -p[1] converte a convenção 2D (y para baixo) para
   Z de mundo antes de deitar a geometria no plano. */
export function shapeToXZ(outer, holes) {
  const sh = new THREE.Shape(outer.map((p) => new THREE.Vector2(p[0], -p[1])));
  (holes || []).forEach((h) => sh.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p[0], -p[1])))));
  const g = new THREE.ShapeGeometry(sh);
  g.rotateX(-Math.PI / 2);
  return g;
}

/* Reamostra o anel em passos de no máximo `step` metros, para que as paredes
   acompanhem o relevo em vez de cortar o terreno em linha reta. */
export function subdivRing(ring, step) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const L = len2(sub2(b, a)), n = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return out;
}

/* "Cortina" vertical no perímetro: base e topo por função, com aT (0 base,
   1 topo) e dist (perímetro acumulado) para os shaders animados. */
export function buildCurtain(ring, topFn, baseFn) {
  const pts = subdivRing(ring, 8);
  const n = pts.length, pos = [], aT = [], dist = [], idx = [];
  let acc = 0;
  for (let i = 0; i <= n; i++) {
    const p = pts[i % n];
    if (i > 0) acc += len2(sub2(p, pts[(i - 1) % n]));
    const b = baseFn(p[0], p[1]), t = topFn(p[0], p[1]);
    pos.push(p[0], b, p[1], p[0], t, p[1]);
    aT.push(0, 1); dist.push(acc, acc);
    if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1));
  g.setAttribute('dist', new THREE.Float32BufferAttribute(dist, 1));
  g.setIndex(idx);
  return g;
}

/* Fita de borda com largura em METROS (não em pixels): a junta é estendida
   pelo inverso do cosseno do meio-ângulo, com teto para não explodir em
   vértices agudos. */
export function buildRibbon(ring, widthM, y) {
  const n = ring.length, pos = [], distA = [], idx = [];
  let acc = 0;
  for (let i = 0; i <= n; i++) {
    const p = ring[i % n], pPrev = ring[(i - 1 + n) % n], pNext = ring[(i + 1) % n];
    const d0 = norm2(sub2(p, pPrev)), d1 = norm2(sub2(pNext, p));
    const n0 = [-d0[1], d0[0]], n1 = [-d1[1], d1[0]];
    const m = norm2([n0[0] + n1[0], n0[1] + n1[1]]);
    const scale = 1 / Math.max(0.34, m[0] * n1[0] + m[1] * n1[1]);
    if (i > 0) acc += len2(sub2(p, pPrev));
    const hw = widthM * 0.5 * scale;
    pos.push(p[0] + m[0] * hw, y, p[1] + m[1] * hw, p[0] - m[0] * hw, y, p[1] - m[1] * hw);
    distA.push(acc, acc);
    if (i < n) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('dist', new THREE.Float32BufferAttribute(distA, 1));
  g.setIndex(idx);
  return g;
}
