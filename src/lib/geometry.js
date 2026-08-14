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
/* Subdivide até nenhuma aresta passar de maxEdge, e então desloca em Y por
   uma função de altura. É assim que o preenchimento DRAPEADO vira propriedade
   da FEIÇÃO e não do terreno — o que permite N camadas drapeadas com padrões
   diferentes ao mesmo tempo. Com a máscara no shader do terreno só uma seria
   possível, porque o terreno é um só.

   Subdividir em vez de recortar uma grade preserva a borda exata do polígono
   (inclusive o furo): nada de serrilhado na divisa da zona, que é justamente
   onde o olho vai. */
export function drapeGeometry(geo, heightAt, maxEdge = 6, maxTris = 120000) {
  let src = geo.index ? geo.toNonIndexed() : geo;
  let pos = Array.from(src.attributes.position.array);

  for (let pass = 0; pass < 8; pass++) {
    const tris = pos.length / 9;
    if (tris >= maxTris) break;
    const out = [];
    let split = false;
    for (let t = 0; t < tris; t++) {
      const o = t * 9;
      const a = [pos[o], pos[o + 1], pos[o + 2]];
      const b = [pos[o + 3], pos[o + 4], pos[o + 5]];
      const c = [pos[o + 6], pos[o + 7], pos[o + 8]];
      const e = Math.max(
        Math.hypot(a[0] - b[0], a[2] - b[2]),
        Math.hypot(b[0] - c[0], b[2] - c[2]),
        Math.hypot(c[0] - a[0], c[2] - a[2]),
      );
      if (e <= maxEdge) { out.push(...a, ...b, ...c); continue; }
      split = true;
      const ab = [(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2];
      const bc = [(b[0] + c[0]) / 2, 0, (b[2] + c[2]) / 2];
      const ca = [(c[0] + a[0]) / 2, 0, (c[2] + a[2]) / 2];
      out.push(...a, ...ab, ...ca, ...ab, ...b, ...bc, ...ca, ...bc, ...c, ...ab, ...bc, ...ca);
    }
    pos = out;
    if (!split) break;
  }

  for (let i = 0; i < pos.length; i += 3) pos[i + 1] = heightAt(pos[i], pos[i + 2]);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export function buildRibbon(ring, widthM, y, closed = true) {
  const n = ring.length, pos = [], distA = [], crossA = [], idx = [];
  const last = closed ? n : n - 1;
  let acc = 0;
  for (let i = 0; i <= last; i++) {
    const p = ring[i % n];
    /* Numa polilinha ABERTA as pontas não têm vizinho para o outro lado — a
       normal da junta degenera. Repetir o próprio ponto faz a extremidade usar
       a direção do único segmento existente, que é o corte reto (butt cap). */
    const pPrev = closed ? ring[(i - 1 + n) % n] : ring[Math.max(i - 1, 0)];
    const pNext = closed ? ring[(i + 1) % n] : ring[Math.min(i + 1, n - 1)];
    const d0 = norm2(sub2(p, pPrev)), d1 = norm2(sub2(pNext, p));
    const n0 = [-d0[1], d0[0]], n1 = [-d1[1], d1[0]];
    const m = norm2([n0[0] + n1[0], n0[1] + n1[1]]);
    const scale = 1 / Math.max(0.34, m[0] * n1[0] + m[1] * n1[1]);
    if (i > 0) acc += len2(sub2(p, pPrev));
    const hw = widthM * 0.5 * scale;
    /* y aceita número (cota fixa) ou função (acompanha o relevo), para a borda
       poder seguir o mesmo regime do preenchimento da camada. */
    const yA = typeof y === 'function' ? y(p[0] + m[0] * hw, p[1] + m[1] * hw) : y;
    const yB = typeof y === 'function' ? y(p[0] - m[0] * hw, p[1] - m[1] * hw) : y;
    pos.push(p[0] + m[0] * hw, yA, p[1] + m[1] * hw, p[0] - m[0] * hw, yB, p[1] - m[1] * hw);
    distA.push(acc, acc);
    crossA.push(1, -1);            /* posição transversal: linha dupla e glow */
    if (i < last) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('dist', new THREE.Float32BufferAttribute(distA, 1));
  g.setAttribute('cross', new THREE.Float32BufferAttribute(crossA, 1));
  g.setIndex(idx);
  return g;
}
