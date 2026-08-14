import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { createLOD, updateLOD } from '../lib/lod.js';
import { hex4 } from '../lib/color.js';
import { sharedPat, terrainUniforms, wallUniforms, volUniforms, outUniforms } from './uniforms.js';
import { capMat, scatterMat } from './materials.js';
import { writeReadouts } from './readouts.js';
import { readState } from '../store.js';

/* Ponte entre o estado do React e os uniforms.

   Tudo que muda por frame passa por aqui e por nenhum outro lugar: LOD,
   parâmetros do padrão, tempo das animações e os readouts. Nada disso toca
   setState — o React só reage a mudanças de CONTROLE, nunca ao relógio. */
export default function FrameDriver() {
  const { camera, size, viewport, controls } = useThree();
  const lod = useMemo(() => createLOD(), []);
  const clock = useRef(0);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, rawDt) => {
    const s = readState();
    const dt = Math.min(rawDt, 0.1);
    clock.current += dt;

    const dpr = viewport.dpr || 1;
    const target = controls?.target ?? a.set(0, 0, 0);

    /* pixels por metro no centro da tela: projeta o alvo e o alvo + 1 m */
    a.copy(target).project(camera);
    b.copy(target).add({ x: 1, y: 0, z: 0 }).project(camera);
    const ppmC = Math.max(
      Math.hypot((b.x - a.x) * size.width * dpr / 2, (b.y - a.y) * size.height * dpr / 2),
      1e-6,
    );

    updateLOD(lod, ppmC, dt, { spacing: s.spacing, minPx: s.minPx, maxPx: s.maxPx, dpr });

    /* zoom equivalente ao nível z do Mapbox, para a visibilidade por zoom */
    const zEq = Math.log2(Math.max(ppmC / dpr, 1e-6) * 156543.03);
    let fade = 1;
    if (s.visOn) {
      fade = Math.min((zEq - s.minZ) / s.fadeR, (s.maxZ - zEq) / s.fadeR);
      fade = Math.min(Math.max(fade, 0), 1);
    }

    const pxU = s.mode === 0 ? 1 : dpr;
    const grow = Math.pow(2, lod.f);

    sharedPat.uPattern.value = s.pattern;
    sharedPat.uMode.value = s.mode;
    sharedPat.uSpacing.value = s.spacing * pxU;
    sharedPat.uLw.value = s.lw * pxU;
    sharedPat.uSym.value = s.sym * pxU;
    sharedPat.uRot.value = s.rot * Math.PI / 180;
    sharedPat.uBase.value = hex4(s.baseColor, s.baseA);
    sharedPat.uPat.value = hex4(s.patColor, s.patA);
    sharedPat.uTint.value = s.tint ? 1 : 0;
    sharedPat.uFade.value = fade;
    sharedPat.uSw.value = lod.s;
    sharedPat.uF.value = s.pattern === 6 ? 0 : lod.f;   /* checker: snap discreto */
    sharedPat.uHwW.value = 0.5 * (s.lw / s.spacing) * lod.s * grow;
    sharedPat.uArmW.value = 0.30 * lod.s * grow;
    sharedPat.uSymW.value = (s.sym / s.spacing) * lod.s * grow;

    terrainUniforms.uDrape.value = s.repDrape ? 1 : 0;
    terrainUniforms.uContours.value = s.contours ? 1 : 0;

    outUniforms.uColor.value.set(s.outColor);
    outUniforms.uDash.value = s.dash;
    outUniforms.uAlpha.value = fade;

    wallUniforms.uCol.value.set(s.patColor);
    wallUniforms.uTime.value = clock.current;
    wallUniforms.uSpeed.value = s.animSpeed;
    wallUniforms.uAnim.value = s.animOn ? 1 : 0;
    wallUniforms.uGFade.value = fade;
    wallUniforms.uWStyle.value = s.wallStyle;

    volUniforms.uTime.value = clock.current;
    volUniforms.uVolAnim.value = s.volAnim ? 1 : 0;
    volUniforms.uCol.value.set(s.baseColor);
    volUniforms.uGFade.value = fade;

    capMat.color.set(s.baseColor);
    capMat.opacity = 0.16 * fade * (s.volAnim ? (0.8 + 0.25 * Math.sin(clock.current * 1.1)) : 1);
    scatterMat.color.set(s.patColor);
    scatterMat.opacity = 0.32 * fade;

    writeReadouts({
      z: zEq.toFixed(1),
      ppm: (ppmC / dpr).toFixed(2),
      spacing: s.mode === 2 ? `${(lod.s * grow * ppmC / dpr).toFixed(1)} px`
        : s.mode === 1 ? `${s.spacing.toFixed(1)} px`
          : `${(s.spacing * ppmC / dpr).toFixed(1)} px`,
      level: s.mode === 2
        ? `${Math.log2(lod.s) | 0}${lod.dir ? (lod.dir > 0 ? ' ↑' : ' ↓') : ''}`
        : '—',
    });
  });

  return null;
}
