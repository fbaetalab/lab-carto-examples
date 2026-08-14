/* Pirâmide de níveis do modo px/metro (modelo Mapbox).

   Decisão que não deve regredir: o nível é GLOBAL e TEMPORAL — um único nível
   por frame para toda a cena, com histerese de ±0,75 nível e transição de
   ~0,28 s. Nunca por fragmento, nunca crossfade espacial de dois padrões
   completos (isso causa duplicidade visual). */
export function createLOD() {
  return { s: 1, f: 0, dir: 0, init: false };
}

/**
 * @param lod    estado mutável vindo de createLOD()
 * @param ppmC   pixels por metro no centro da tela
 * @param dt     segundos desde o frame anterior
 * @param opts   { spacing, minPx, maxPx, dpr }
 */
export function updateLOD(lod, ppmC, dt, { spacing, minPx, maxPx, dpr }) {
  const tPx = spacing * dpr;
  let Lstar = Math.log2(tPx / ppmC);
  const Lmin = Math.log2(minPx * dpr / ppmC), Lmax = Math.log2(maxPx * dpr / ppmC);
  Lstar = Math.min(Math.max(Lstar, Lmin), Lmax);
  if (!lod.init) { lod.s = Math.pow(2, Math.round(Lstar)); lod.f = 0; lod.dir = 0; lod.init = true; }
  const Ldisp = Math.log2(lod.s) + lod.f;
  if (lod.dir === 0) {
    if (Lstar > Ldisp + 0.75) lod.dir = 1;                                 /* engrossar: ímpares saem */
    else if (Lstar < Ldisp - 0.75) { lod.s /= 2; lod.f = 1; lod.dir = -1; } /* refinar: ímpares entram */
  }
  if (lod.dir !== 0) {
    lod.f += lod.dir * dt / 0.28;
    if (lod.f >= 1) { lod.s *= 2; lod.f = 0; lod.dir = 0; }
    else if (lod.f <= 0) { lod.f = 0; lod.dir = 0; }
  }
}
