import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { createLOD, updateLOD } from '../lib/lod.js';
import { fillMaterials } from './patternMaterial.js';
import { terrainUniforms } from './uniforms.js';
import { writeReadouts } from './readouts.js';
import { readState } from '../store.js';

/* Ponte entre estado e uniforms. Tudo que muda por frame passa por aqui e por
   nenhum outro lugar — nada disso toca setState.

   A pirâmide de LOD é POR CAMADA: o nível depende do espaçamento-alvo, e duas
   camadas com alvos diferentes trocam de nível em zooms diferentes. O que
   continua global é a regra — um único nível por camada por frame, com
   histerese e transição temporal, nunca por fragmento. */
export default function FrameDriver() {
  const { camera, size, viewport, controls } = useThree();
  const lods = useMemo(() => new Map(), []);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, rawDt) => {
    const s = readState();
    const dt = Math.min(rawDt, 0.1);
    const dpr = viewport.dpr || 1;
    const target = controls?.target ?? a.set(0, 0, 0);

    a.copy(target).project(camera);
    b.copy(target).add({ x: 1, y: 0, z: 0 }).project(camera);
    const ppmC = Math.max(
      Math.hypot((b.x - a.x) * size.width * dpr / 2, (b.y - a.y) * size.height * dpr / 2),
      1e-6,
    );
    const zEq = Math.log2(Math.max(ppmC / dpr, 1e-6) * 156543.03);

    terrainUniforms.uContours.value = s.scene.contours ? 1 : 0;

    let shown = null;
    for (const [id, entry] of fillMaterials) {
      const { material, fill } = entry;
      const u = material.userData.uniforms;

      let fade = 1;
      const layer = s.layers.find((l) => l.id === id);
      if (layer?.vis.on) {
        fade = Math.min((zEq - layer.vis.minZ) / layer.vis.fadeR, (layer.vis.maxZ - zEq) / layer.vis.fadeR);
        fade = Math.min(Math.max(fade, 0), 1);
      }
      u.uFade.value = fade;

      if (fill.mode !== 2) continue;

      let lod = lods.get(id);
      if (!lod) { lod = createLOD(); lods.set(id, lod); }
      updateLOD(lod, ppmC, dt, { spacing: fill.spacing, minPx: fill.minPx, maxPx: fill.maxPx, dpr });

      const grow = Math.pow(2, lod.f);
      u.uSw.value = lod.s;
      u.uF.value = fill.pattern === 6 ? 0 : lod.f;   /* checker: snap discreto */
      u.uHwW.value = 0.5 * (fill.lw / fill.spacing) * lod.s * grow;
      u.uArmW.value = 0.30 * lod.s * grow;
      u.uSymW.value = (fill.sym / fill.spacing) * lod.s * grow;
      u.uSpacing.value = fill.spacing * dpr;
      u.uLw.value = fill.lw * dpr;
      u.uSym.value = fill.sym * dpr;

      /* Os readouts mostram a camada selecionada — é dela que se está
         ajustando a escala. */
      if (id === s.selectedId) shown = { lod, grow, fill };
    }

    const sel = shown ?? { fill: s.layers.find((l) => l.id === s.selectedId)?.fill };
    writeReadouts({
      z: zEq.toFixed(1),
      ppm: (ppmC / dpr).toFixed(2),
      spacing: sel.lod
        ? `${(sel.lod.s * sel.grow * ppmC / dpr).toFixed(1)} px`
        : sel.fill
          ? (sel.fill.mode === 1 ? `${sel.fill.spacing.toFixed(1)} px` : `${(sel.fill.spacing * ppmC / dpr).toFixed(1)} px`)
          : '—',
      level: sel.lod
        ? `${Math.log2(sel.lod.s) | 0}${sel.lod.dir ? (sel.lod.dir > 0 ? ' ↑' : ' ↓') : ''}`
        : '—',
    });
  });

  return null;
}
