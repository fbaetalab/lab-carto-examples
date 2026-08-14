import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RINGS, POLY_A_OUTER, POLY_A_HOLE, POLY_B } from '../config.js';
import { shapeToXZ, buildCurtain, buildRibbon, pip } from '../lib/geometry.js';
import { terrainH } from '../lib/terrain.js';
import { fillMat, wallMat, volMat, capMat, outMat, scatterMat } from '../render/materials.js';
import { useStore } from '../store.js';

/* As cinco representações 3D da mesma feição cartográfica. Todas partem dos
   MESMOS anéis de polígono — é isso que permite comparar as representações
   lado a lado sem trocar de dado.

   renderOrder crescente (2 plano → 3 volume/paredes → 4 borda) mantém o
   empilhamento estável entre transparências. */

function Planes() {
  const repPlane = useStore((s) => s.repPlane);
  const planeY = useStore((s) => s.planeY);
  const geoA = useMemo(() => shapeToXZ(POLY_A_OUTER, [POLY_A_HOLE]), []);
  const geoB = useMemo(() => shapeToXZ(POLY_B), []);
  return (
    <group visible={repPlane} position-y={planeY}>
      <mesh geometry={geoA} material={fillMat} renderOrder={2} />
      <mesh geometry={geoB} material={fillMat} renderOrder={2} />
    </group>
  );
}

function Walls() {
  const repWalls = useStore((s) => s.repWalls);
  const wallH = useStore((s) => s.wallH);
  /* A base acompanha o terreno (com folga de 0,6 m para não brigar em z), mas
     nunca sobe acima do topo — senão a parede inverteria em terreno alto. */
  const geos = useMemo(() => {
    const baseFn = (x, z) => Math.min(terrainH(x, z) - 0.6, wallH - 1.0);
    const topFn = () => wallH;
    return RINGS.map((r) => buildCurtain(r, topFn, baseFn));
  }, [wallH]);
  useLayoutEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  return (
    <group visible={repWalls}>
      {geos.map((g, i) => <mesh key={i} geometry={g} material={wallMat} renderOrder={3} />)}
    </group>
  );
}

function Volume() {
  const repVolume = useStore((s) => s.repVolume);
  const volBase = useStore((s) => s.volBase);
  const volTop = useStore((s) => s.volTop);
  const { walls, caps, top } = useMemo(() => {
    const b = Math.min(volBase, volTop), t = Math.max(volBase, volTop);
    return {
      walls: RINGS.map((r) => buildCurtain(r, () => t, () => b)),
      caps: [shapeToXZ(POLY_A_OUTER, [POLY_A_HOLE]), shapeToXZ(POLY_B)],
      top: t,
    };
  }, [volBase, volTop]);
  useLayoutEffect(() => () => {
    walls.forEach((g) => g.dispose());
    caps.forEach((g) => g.dispose());
  }, [walls, caps]);
  return (
    <group visible={repVolume}>
      {walls.map((g, i) => <mesh key={`w${i}`} geometry={g} material={volMat} renderOrder={3} />)}
      {caps.map((g, i) => (
        <mesh key={`c${i}`} geometry={g} material={capMat} position-y={top} renderOrder={3} />
      ))}
    </group>
  );
}

function Scatter() {
  const repScatter = useStore((s) => s.repScatter);
  const volBase = useStore((s) => s.volBase);
  const volTop = useStore((s) => s.volTop);
  const ref = useRef();

  /* Amostragem regular em XZ, filtrada por ponto-em-polígono (com o furo
     removido), empilhada verticalmente entre base e topo. */
  const spots = useMemo(() => {
    const b = Math.min(volBase, volTop) + 3, t = Math.max(volBase, volTop) - 2;
    const out = [];
    for (let x = -330; x <= 420; x += 26) {
      for (let z = -290; z <= 290; z += 26) {
        const inA = pip(x, z, POLY_A_OUTER) && !pip(x, z, POLY_A_HOLE);
        if (inA || pip(x, z, POLY_B)) {
          for (let y = b; y <= Math.max(b, t); y += 12) out.push([x, y, z]);
        }
      }
    }
    return out.slice(0, 2400);
  }, [volBase, volTop]);

  const geometry = useMemo(() => new THREE.BoxGeometry(3.5, 3.5, 3.5), []);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const M = new THREE.Matrix4();
    for (let i = 0; i < spots.length; i++) {
      M.setPosition(spots[i][0], spots[i][1], spots[i][2]);
      m.setMatrixAt(i, M);
    }
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [spots]);

  if (!spots.length) return null;
  return (
    <instancedMesh
      key={spots.length}
      ref={ref}
      args={[geometry, scatterMat, spots.length]}
      visible={repScatter}
      renderOrder={3}
    />
  );
}

function Outlines() {
  const repPlane = useStore((s) => s.repPlane);
  const outW = useStore((s) => s.outW);
  const planeY = useStore((s) => s.planeY);
  const geos = useMemo(
    () => (outW > 0 ? RINGS.map((r) => buildRibbon(r, outW, planeY + 0.12)) : []),
    [outW, planeY],
  );
  useLayoutEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  return (
    <group visible={repPlane && outW > 0}>
      {geos.map((g, i) => <mesh key={i} geometry={g} material={outMat} renderOrder={4} />)}
    </group>
  );
}

export default function Demarcation() {
  return (
    <>
      <Planes />
      <Walls />
      <Volume />
      <Scatter />
      <Outlines />
    </>
  );
}
