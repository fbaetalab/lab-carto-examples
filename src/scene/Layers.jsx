import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GEOMETRIES } from '../layers.js';
import { shapeToXZ, buildCurtain, buildRibbon, drapeGeometry, subdivRing, pip } from '../lib/geometry.js';
import { terrainH } from '../lib/terrain.js';
import { buildMaskTexture } from '../lib/textures.js';
import { makePatternMaterial, rgba, fillMaterials } from '../render/patternMaterial.js';
import { WALL_VS, WALL_FS, VOL_FS, OUT_VS, OUT_FS } from '../shaders/demarcation.js';
import { useStore } from '../store.js';

/* Renderiza TODAS as camadas visíveis, cada uma com os seus três componentes
   independentes. Cada camada tem os próprios materiais — é o que permite
   preenchimentos com padrões e cores distintos convivendo na mesma cena. */

const clock = { t: 0 };

export default function Layers() {
  const layers = useStore((s) => s.layers);
  useFrame((_, dt) => { clock.t += dt; });
  return layers.filter((l) => l.visible).map((l) => <Layer key={l.id} layer={l} />);
}

function Layer({ layer }) {
  const geo = GEOMETRIES[layer.geometry];
  return (
    <>
      {layer.fill.on && <Fill layer={layer} geo={geo} />}
      {layer.stroke.on && <Stroke layer={layer} geo={geo} />}
      {layer.volume.on && <Volume layer={layer} geo={geo} />}
    </>
  );
}

/* ---------------- preenchimento ---------------- */
function Fill({ layer, geo }) {
  const f = layer.fill;
  const draped = f.surface === 'drape';

  /* O shapeburst precisa de distância-à-borda; cada camada tem a sua, porque
     cada uma tem geometria própria. */
  const mask = useMemo(() => {
    if (f.pattern !== 10) return null;
    const xs = geo.outer.map((p) => p[0]), zs = geo.outer.map((p) => p[1]);
    const pad = 40;
    const bounds = {
      xmin: Math.min(...xs) - pad, zmin: Math.min(...zs) - pad,
      sx: Math.max(...xs) - Math.min(...xs) + pad * 2,
      sz: Math.max(...zs) - Math.min(...zs) + pad * 2,
    };
    return { texture: buildMaskTexture([{ outer: geo.outer, holes: geo.holes }], bounds), bounds };
  }, [f.pattern, geo]);
  useEffect(() => () => mask?.texture.dispose(), [mask]);

  const geometry = useMemo(() => {
    const flat = shapeToXZ(geo.outer, geo.holes);
    if (!draped) return flat;
    const g = drapeGeometry(flat, (x, z) => terrainH(x, z) + 0.35);
    flat.dispose();
    return g;
  }, [geo, draped]);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(() => makePatternMaterial({
    uPattern: f.pattern, uMode: f.mode,
    uSpacing: f.spacing, uLw: f.lw, uSym: f.sym, uRot: f.rot * Math.PI / 180,
    uArrange: f.arrange, uSeed: f.seed, uBrickOff: f.brickOff, uShapeW: f.shapeW,
    uTint: f.tint ? 1 : 0,
    uBase: rgba(f.color, f.opacity),
    uPat: rgba(f.patternColor, f.patternOpacity),
    uSw: f.spacing, uHwW: f.lw * 0.5, uArmW: 0.3 * f.spacing, uSymW: f.sym,
  }, mask), [f, mask]);

  useLayoutEffect(() => {
    fillMaterials.set(layer.id, { material, fill: f });
    return () => { fillMaterials.delete(layer.id); material.dispose(); };
  }, [layer.id, material, f]);

  return (
    <mesh
      geometry={geometry}
      material={material}
      position-y={draped ? 0 : f.elevation}
      renderOrder={2}
      castShadow={false}
      receiveShadow={false}
    />
  );
}

/* ---------------- borda ---------------- */
function Stroke({ layer, geo }) {
  const s = layer.stroke;
  const f = layer.fill;
  const draped = f.surface === 'drape';
  const yAt = draped ? (x, z) => terrainH(x, z) + 0.55 : f.elevation + 0.12;

  const { edge, casing } = useMemo(() => {
    /* Ao drapear, o anel precisa de mais vértices para a fita acompanhar o
       relevo em vez de cortar reto entre dois cantos distantes. */
    const rings = draped ? geo.rings.map((r) => subdivRing(r, 6)) : geo.rings;
    return {
      edge: s.width > 0 ? rings.map((r) => buildRibbon(r, s.width, yAt)) : [],
      casing: s.width > 0 && s.casingWidth > 0
        ? rings.map((r) => buildRibbon(r, s.width + s.casingWidth * 2, draped ? (x, z) => terrainH(x, z) + 0.5 : f.elevation + 0.10))
        : [],
    };
  }, [geo, s.width, s.casingWidth, draped, f.elevation]);

  useLayoutEffect(() => () => [...edge, ...casing].forEach((g) => g.dispose()), [edge, casing]);

  const edgeMat = useMemo(() => outlineMaterial(s.color, s.dash), [s.color, s.dash]);
  const casingMat = useMemo(() => outlineMaterial(s.casingColor, 0), [s.casingColor]);
  useLayoutEffect(() => () => { edgeMat.dispose(); casingMat.dispose(); }, [edgeMat, casingMat]);

  return (
    <>
      {casing.map((g, i) => <mesh key={`c${i}`} geometry={g} material={casingMat} renderOrder={4} castShadow={false} receiveShadow={false} />)}
      {edge.map((g, i) => <mesh key={`e${i}`} geometry={g} material={edgeMat} renderOrder={5} castShadow={false} receiveShadow={false} />)}
    </>
  );
}

function outlineMaterial(color, dash) {
  return new THREE.ShaderMaterial({
    vertexShader: OUT_VS,
    fragmentShader: OUT_FS,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uDash: { value: dash },
      uAlpha: { value: 1 },
    },
    transparent: true,
    side: THREE.DoubleSide,
  });
}

/* ---------------- volume ---------------- */
function Volume({ layer, geo }) {
  const v = layer.volume;

  const uniforms = useMemo(() => ({
    uCol: { value: new THREE.Color(v.color) },
    uTime: { value: 0 }, uSpeed: { value: v.speed },
    uGFade: { value: v.opacity }, uAnim: { value: v.animate ? 1 : 0 },
    uWStyle: { value: v.wallStyle }, uVolAnim: { value: v.pulse ? 1 : 0 },
  }), [v]);

  useFrame(() => { uniforms.uTime.value = clock.t; });

  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: WALL_VS,
    fragmentShader: v.kind === 'walls' ? WALL_FS : VOL_FS,
    uniforms,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }), [v.kind, uniforms]);
  useLayoutEffect(() => () => material.dispose(), [material]);

  const curtains = useMemo(() => {
    if (v.kind === 'scatter') return [];
    if (v.kind === 'walls') {
      const baseFn = (x, z) => Math.min(terrainH(x, z) - 0.6, v.top - 1);
      return geo.rings.map((r) => buildCurtain(r, () => v.top, baseFn));
    }
    const b = Math.min(v.base, v.top), t = Math.max(v.base, v.top);
    return geo.rings.map((r) => buildCurtain(r, () => t, () => b));
  }, [geo, v.kind, v.top, v.base]);
  useLayoutEffect(() => () => curtains.forEach((g) => g.dispose()), [curtains]);

  const cap = useMemo(
    () => (v.kind === 'prism' ? shapeToXZ(geo.outer, geo.holes) : null),
    [geo, v.kind],
  );
  useLayoutEffect(() => () => cap?.dispose(), [cap]);

  const capMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: v.color, transparent: true, opacity: 0.16 * v.opacity,
    depthWrite: false, side: THREE.DoubleSide,
  }), [v.color, v.opacity]);
  useLayoutEffect(() => () => capMat.dispose(), [capMat]);

  if (v.kind === 'scatter') return <Scatter geo={geo} v={v} />;

  return (
    <>
      {curtains.map((g, i) => <mesh key={i} geometry={g} material={material} renderOrder={3} castShadow={false} receiveShadow={false} />)}
      {cap && <mesh geometry={cap} material={capMat} position-y={Math.max(v.base, v.top)} renderOrder={3} castShadow={false} receiveShadow={false} />}
    </>
  );
}

function Scatter({ geo, v }) {
  const ref = useRef();
  const spots = useMemo(() => {
    const b = Math.min(v.base, v.top) + 3, t = Math.max(v.base, v.top) - 2;
    const xs = geo.outer.map((p) => p[0]), zs = geo.outer.map((p) => p[1]);
    const out = [];
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 22) {
      for (let z = Math.min(...zs); z <= Math.max(...zs); z += 22) {
        const inside = pip(x, z, geo.outer) && !geo.holes.some((h) => pip(x, z, h));
        if (!inside) continue;
        for (let y = b; y <= Math.max(b, t); y += 10) out.push([x, y, z]);
      }
    }
    return out.slice(0, 3000);
  }, [geo, v.base, v.top]);

  const geometry = useMemo(() => new THREE.BoxGeometry(3.5, 3.5, 3.5), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    color: v.color, transparent: true, opacity: 0.32 * v.opacity, depthWrite: false,
  }), [v.color, v.opacity]);
  useLayoutEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const M = new THREE.Matrix4();
    spots.forEach((s, i) => { M.setPosition(s[0], s[1], s[2]); m.setMatrixAt(i, M); });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [spots]);

  if (!spots.length) return null;
  return <instancedMesh key={spots.length} ref={ref} args={[geometry, material, spots.length]} renderOrder={3} />;
}
