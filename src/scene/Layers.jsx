import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GEOMETRIES, LINES, POINTS } from '../layers.js';
import { shapeToXZ, buildCurtain, buildRibbon, drapeGeometry, subdivRing, pip } from '../lib/geometry.js';
import { terrainH } from '../lib/terrain.js';
import { buildMaskTexture } from '../lib/textures.js';
import { makePatternMaterial, rgba, fillMaterials } from '../render/patternMaterial.js';
import { WALL_VS, WALL_FS, VOL_FS, OUT_VS, OUT_FS } from '../shaders/demarcation.js';
import { LINE_VS, LINE_FS } from '../shaders/lines.js';
import { POINT_VS, POINT_FS, POINT_ATLAS_FS } from '../shaders/points.js';
import { buildNauticalAtlas, markIndex } from '../lib/nauticalAtlas.js';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useStore } from '../store.js';

/* Renderiza TODAS as camadas visíveis, cada uma com os seus três componentes
   independentes. Cada camada tem os próprios materiais — é o que permite
   preenchimentos com padrões e cores distintos convivendo na mesma cena. */

const clock = { t: 0 };

/* Atlas náutico como singleton preguiçoso — 12 desenhos de canvas, uma vez. */
let _atlas = null;
const getAtlas = () => (_atlas ??= buildNauticalAtlas());

export default function Layers() {
  const layers = useStore((s) => s.layers);
  useFrame((_, dt) => { clock.t += dt; });
  return layers.filter((l) => l.visible).map((l) => <Layer key={l.id} layer={l} />);
}

function Layer({ layer }) {
  if (layer.kind === 'line') return layer.line.on ? <LineLayer layer={layer} /> : null;
  if (layer.kind === 'point') return layer.point.on ? <PointLayer layer={layer} /> : null;

  const geo = GEOMETRIES[layer.geometry];
  return (
    <>
      {layer.fill.on && <Fill layer={layer} geo={geo} />}
      {layer.stroke.on && <Stroke layer={layer} geo={geo} />}
      {layer.volume.on && <Volume layer={layer} geo={geo} />}
    </>
  );
}

/* ---------------- primitiva LINHA ---------------- */
function LineLayer({ layer }) {
  const l = layer.line;
  const src = LINES[layer.geometry];
  const draped = l.surface === 'drape';

  const geometry = useMemo(() => {
    /* Reamostra antes de gerar a fita: sem isso a linha corta reto entre
       vértices distantes e não acompanha o relevo nem a curvatura. */
    const pts = draped ? subdivRing(src.pts, 8).slice(0, -1) : src.pts;
    const yAt = draped ? (x, z) => terrainH(x, z) + l.elevation : l.elevation;
    return buildRibbon(pts, l.width, yAt, false);
  }, [src, l.width, l.elevation, draped]);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: LINE_VS,
    fragmentShader: LINE_FS,
    uniforms: {
      uColor: { value: new THREE.Color(l.color) },
      uAlpha: { value: l.opacity },
      uDash: { value: l.dash },
      uGap: { value: l.gap },
      uStyle: { value: l.style },
    },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }), [l.color, l.opacity, l.dash, l.gap, l.style]);
  useLayoutEffect(() => () => material.dispose(), [material]);

  return <mesh geometry={geometry} material={material} renderOrder={5} castShadow={false} receiveShadow={false} />;
}

/* ---------------- primitiva PONTO ---------------- */
function PointLayer({ layer }) {
  const p = layer.point;
  const src = POINTS[layer.geometry];
  const { size } = useThree();
  const ref = useRef();

  const items = useMemo(
    () => src.items.map((it) => ({ ...it, y: terrainH(it.at[0], it.at[1]) + 2 })),
    [src],
  );

  const nautical = src.family === 'nautical';

  /* O atlas é gerado uma vez por processo: são 12 desenhos de canvas, e
     recriá-lo por camada seria desperdício. */
  const atlas = useMemo(() => (nautical ? getAtlas() : null), [nautical]);

  const geometry = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    g.index = base.index;
    g.attributes.position = base.attributes.position;
    g.attributes.uv = base.attributes.uv;
    g.setAttribute('offset', new THREE.InstancedBufferAttribute(
      new Float32Array(items.flatMap((it) => [it.at[0], it.y, it.at[1]])), 3));
    g.setAttribute('kind', new THREE.InstancedBufferAttribute(
      new Float32Array(items.map((it) => (nautical ? markIndex(it.mark) : (it.kind ?? p.kind)))), 1));
    g.instanceCount = items.length;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2000);
    return g;
  }, [items, p.kind, nautical]);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: POINT_VS,
    fragmentShader: nautical ? POINT_ATLAS_FS : POINT_FS,
    uniforms: nautical ? {
      uAtlas: { value: atlas.texture },
      uGrid: { value: new THREE.Vector2(atlas.cols, atlas.rows) },
      uAlpha: { value: p.opacity },
      uTintColor: { value: new THREE.Color(p.color) },
      /* 0 = respeita a cor IALA. Tingir uma boia destrói a informação. */
      uTint: { value: p.tint ? 1 : 0 },
      uSizePx: { value: p.size },
      uViewport: { value: new THREE.Vector2(1, 1) },
    } : {
      uColor: { value: new THREE.Color(p.color) },
      uAlpha: { value: p.opacity },
      uSizePx: { value: p.size },
      uViewport: { value: new THREE.Vector2(1, 1) },
    },
    transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
  }), [p.color, p.opacity, p.size, p.tint, nautical, atlas]);
  useLayoutEffect(() => () => material.dispose(), [material]);

  useFrame(({ viewport }) => {
    const dpr = viewport.dpr || 1;
    material.uniforms.uViewport.value.set(size.width * dpr, size.height * dpr);
  });

  return (
    <>
      <mesh ref={ref} geometry={geometry} material={material} renderOrder={6} frustumCulled={false} />
      {/* Rótulo com linha-guia: o nome não fica em cima do símbolo, sai por um
          filete curto. É a convenção de carta náutica e o que impede o texto de
          cobrir a própria feição que nomeia. */}
      {p.labels && items.map((it, i) => (
        <Html key={i} position={[it.at[0], it.y, it.at[1]]} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
          <div style={{ display: 'flex', alignItems: 'center', transform: 'translate(0,-50%)' }}>
            <span style={{ width: 22, height: 1, background: nautical ? '#9CA3AF' : p.color, opacity: 0.7, flex: 'none' }} />
            <span style={{
              font: '500 10px/1.3 Inter, sans-serif', color: nautical ? '#D4D4D8' : p.color,
              whiteSpace: 'nowrap', letterSpacing: '.04em', paddingLeft: 6, textShadow: '0 1px 3px rgba(0,0,0,.9)',
            }}>{it.label}</span>
          </div>
        </Html>
      ))}
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
