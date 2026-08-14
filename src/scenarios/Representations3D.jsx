import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { POLY_A_OUTER, POLY_A_HOLE } from '../config.js';
import { shapeToXZ, buildCurtain, buildRibbon, pip } from '../lib/geometry.js';
import { terrainH } from '../lib/terrain.js';
import { buildMaskTexture } from '../lib/textures.js';
import { sharedPat } from '../render/uniforms.js';
import { fillMat, wallMat, volMat, capMat, outMat, scatterMat } from '../render/materials.js';

/* CENÁRIO 2 — REPRESENTAÇÃO VOLUMÉTRICA 3D
   =======================================
   Padrão FIXO e igual em todas as células. A variável é outra: como a mesma
   feição cartográfica ocupa o espaço.

   Isolar assim é o ponto. Com padrão e representação variando juntos não dá
   para saber se a leitura mudou porque a hachura ficou mais densa ou porque a
   feição virou volume — e essa é a pergunta que decide o design do twin.

   As células correm no eixo Z, não em X: o relevo tem gradiente de -0,075 por
   metro em X, o que jogaria as pontas da fileira 75 m de altura uma da outra
   (metade acabaria submersa). Em Z o terreno varia ~5 m e as cinco ficam
   comparáveis. */

const SCALE = 0.45;
const SPACING = 205;
const PLANE_Y = 34;      // cota fixa, deliberadamente acima do relevo
const WALL_TOP = 40;
const VOL_BASE = 2;
const VOL_TOP = 28;

const scaleRing = (ring, k) => ring.map(([x, z]) => [x * k, z * k]);

const REPS = [
  { id: 'plane', label: 'Plano em cota', hint: 'cota fixa · ignora o relevo' },
  { id: 'drape', label: 'Drapeado', hint: 'segue o terreno · sem volume' },
  { id: 'walls', label: 'Paredes', hint: 'perímetro legível de longe' },
  { id: 'volume', label: 'Volume', hint: 'ocupa uma faixa de cota' },
  { id: 'scatter', label: 'Distribuição', hint: 'densidade dentro do volume' },
];

export default function Representations3D() {
  const outer = useMemo(() => scaleRing(POLY_A_OUTER, SCALE), []);
  const hole = useMemo(() => scaleRing(POLY_A_HOLE, SCALE), []);
  const rings = useMemo(() => [outer, hole], [outer, hole]);

  const cells = useMemo(
    () => REPS.map((r, i) => ({ ...r, z: (i - (REPS.length - 1) / 2) * SPACING })),
    [],
  );
  const drapeZ = cells.find((c) => c.id === 'drape').z;

  /* O drape é propriedade do TERRENO, não da feição: existe uma máscara só, e
     ela precisa conter apenas a célula drapeada — senão o padrão apareceria no
     chão sob todas as outras e a comparação perderia o sentido. */
  useEffect(() => {
    const bounds = { xmin: -160, zmin: drapeZ - 160, sx: 320, sz: 320 };
    const tex = buildMaskTexture(
      [{
        outer: outer.map(([x, z]) => [x, z + drapeZ]),
        holes: [hole.map(([x, z]) => [x, z + drapeZ])],
      }],
      bounds,
    );
    const prev = {
      t: sharedPat.uMaskT.value,
      min: sharedPat.uMaskMin.value.clone(),
      size: sharedPat.uMaskSize.value.clone(),
    };
    sharedPat.uMaskT.value = tex;
    sharedPat.uMaskMin.value.set(bounds.xmin, bounds.zmin);
    sharedPat.uMaskSize.value.set(bounds.sx, bounds.sz);
    return () => {
      sharedPat.uMaskT.value = prev.t;
      sharedPat.uMaskMin.value.copy(prev.min);
      sharedPat.uMaskSize.value.copy(prev.size);
      tex.dispose();
    };
  }, [outer, hole, drapeZ]);

  return (
    <>
      {cells.map((c) => (
        <group key={c.id} position={[0, 0, c.z]}>
          <Cell id={c.id} outer={outer} hole={hole} rings={rings} worldZ={c.z} />
          <Html position={[130, 30, 0]} center style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
            <div style={{ font: '600 10px/1.4 ui-monospace, monospace', letterSpacing: '.16em', color: '#45D6C4', textTransform: 'uppercase' }}>
              {c.label}
            </div>
            <div style={{ font: '9px/1.4 ui-monospace, monospace', color: '#8CA0A8' }}>
              {c.hint}
            </div>
          </Html>
        </group>
      ))}
    </>
  );
}

function Cell({ id, outer, hole, rings, worldZ }) {
  const planeGeo = useMemo(() => shapeToXZ(outer, [hole]), [outer, hole]);

  const wallGeos = useMemo(() => {
    if (id !== 'walls') return [];
    const baseFn = (x, z) => Math.min(terrainH(x, z + worldZ) - 0.6, WALL_TOP - 1);
    return rings.map((r) => buildCurtain(r, () => WALL_TOP, baseFn));
  }, [id, rings, worldZ]);

  const volGeos = useMemo(
    () => (id === 'volume' ? rings.map((r) => buildCurtain(r, () => VOL_TOP, () => VOL_BASE)) : []),
    [id, rings],
  );

  const outlineGeos = useMemo(
    () => (id === 'plane' ? rings.map((r) => buildRibbon(r, 1.6, PLANE_Y + 0.12)) : []),
    [id, rings],
  );

  const spots = useMemo(() => {
    if (id !== 'scatter') return null;
    const out = [];
    for (let x = -95; x <= 95; x += 12) {
      for (let z = -80; z <= 80; z += 12) {
        if (pip(x, z, outer) && !pip(x, z, hole)) {
          for (let y = VOL_BASE + 3; y <= VOL_TOP - 3; y += 6) out.push([x, y, z]);
        }
      }
    }
    return out;
  }, [id, outer, hole]);

  useLayoutEffect(() => () => {
    planeGeo.dispose();
    [...wallGeos, ...volGeos, ...outlineGeos].forEach((g) => g.dispose());
  }, [planeGeo, wallGeos, volGeos, outlineGeos]);

  if (id === 'drape') return null;   // o drape vive no shader do terreno

  if (id === 'plane') {
    return (
      <>
        <mesh geometry={planeGeo} material={fillMat} position-y={PLANE_Y} renderOrder={2} />
        {outlineGeos.map((g, i) => <mesh key={i} geometry={g} material={outMat} renderOrder={5} />)}
      </>
    );
  }
  if (id === 'walls') {
    return wallGeos.map((g, i) => <mesh key={i} geometry={g} material={wallMat} renderOrder={3} />);
  }
  if (id === 'volume') {
    return (
      <>
        {volGeos.map((g, i) => <mesh key={i} geometry={g} material={volMat} renderOrder={3} />)}
        <mesh geometry={planeGeo} material={capMat} position-y={VOL_TOP} renderOrder={3} />
      </>
    );
  }
  if (id === 'scatter') return <Scatter spots={spots} />;
  return null;
}

function Scatter({ spots }) {
  const ref = useRef();
  const geometry = useMemo(() => new THREE.BoxGeometry(3, 3, 3), []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m || !spots) return;
    const M = new THREE.Matrix4();
    spots.forEach((s, i) => { M.setPosition(s[0], s[1], s[2]); m.setMatrixAt(i, M); });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [spots]);
  if (!spots?.length) return null;
  return <instancedMesh key={spots.length} ref={ref} args={[geometry, scatterMat, spots.length]} renderOrder={3} />;
}
