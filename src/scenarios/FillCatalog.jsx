import { useMemo } from 'react';
import * as THREE from 'three';
import { Html, OrthographicCamera } from '@react-three/drei';
import { PATTERNS, ARRANGEMENTS } from '../config.js';
import { buildMaskTexture } from '../lib/textures.js';
import { makePatternMaterial, rgba } from '../render/patternMaterial.js';
import { useStore } from '../store.js';

/* CENÁRIO 1 — PREENCHIMENTO CARTOGRÁFICO (2D)
   ===========================================
   Aqui só existe simbolização de área: o padrão desenhado NA superfície.
   Nada de volume, parede ou cota — esse é o outro eixo do problema e tem
   cenário próprio.

   Deliberadamente plano, ortográfico e visto de cima:
   - sem perspectiva, o espaçamento de todas as células é comparável;
   - sem terreno, o sombreado PBR não interfere na leitura do padrão;
   - lado a lado, dá para julgar hierarquia de densidade (Bertin) de relance,
     que é a decisão real do cartógrafo.

   É uma prancha de contato, não uma cena. */

const CELL = 60;       // lado da célula, em metros
const GAP = 16;
const COLS = 4;

const rectRing = (cx, cz, s) => {
  const h = s / 2;
  return [[cx - h, cz - h], [cx + h, cz - h], [cx + h, cz + h], [cx - h, cz + h]];
};

export default function FillCatalog() {
  const arrange = useStore((s) => s.arrange);
  const baseColor = useStore((s) => s.baseColor);
  const patColor = useStore((s) => s.patColor);
  const baseA = useStore((s) => s.baseA);
  const patA = useStore((s) => s.patA);

  const layout = useMemo(() => {
    const rows = Math.ceil(PATTERNS.length / COLS);
    const step = CELL + GAP;
    const w = COLS * step - GAP, h = rows * step - GAP;
    const cells = PATTERNS.map((name, i) => {
      const col = i % COLS, row = (i / COLS) | 0;
      return {
        i, name,
        cx: -w / 2 + CELL / 2 + col * step,
        cz: -h / 2 + CELL / 2 + row * step,
      };
    });
    return { cells, w, h };
  }, []);

  /* Uma máscara cobrindo TODAS as células: assim o shapeburst decai a partir
     da borda da própria célula, sem caso especial. */
  const mask = useMemo(() => {
    const pad = CELL;
    const bounds = {
      xmin: -layout.w / 2 - pad, zmin: -layout.h / 2 - pad,
      sx: layout.w + pad * 2, sz: layout.h + pad * 2,
    };
    return {
      texture: buildMaskTexture(
        layout.cells.map((c) => ({ outer: rectRing(c.cx, c.cz, CELL) })),
        bounds,
      ),
      bounds,
    };
  }, [layout]);

  const geometry = useMemo(() => new THREE.PlaneGeometry(CELL, CELL).rotateX(-Math.PI / 2), []);

  /* Padrões de EIXO ficam a 0°: o tijolado precisa da fiada horizontal e o
     tabuleiro precisa dos quadros alinhados, senão viram outro padrão. Os
     demais vão a 45°, que é a convenção de hachura em carta. */
  const AXIS_ALIGNED = new Set([6, 9]);

  const materials = useMemo(() => layout.cells.map((c) => makePatternMaterial({
    uPattern: c.i,
    uMode: 0,                    // metros: o catálogo é medido, não responsivo
    uSpacing: 7, uLw: 1.1, uSym: 5,
    uRot: AXIS_ALIGNED.has(c.i) ? 0 : Math.PI / 4,
    uArrange: arrange,
    uShapeW: 12,
    uBase: rgba(baseColor, baseA),
    uPat: rgba(patColor, patA),
  }, mask)), [layout, mask, arrange, baseColor, patColor, baseA, patA]);

  return (
    <>
      <OrthographicCamera
        makeDefault
        position={[0, 400, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        zoom={2.6}
        near={1}
        far={2000}
      />
      <color attach="background" args={['#0C1114']} />

      {layout.cells.map((c, i) => (
        <group key={c.name} position={[c.cx, 0, c.cz]}>
          <mesh geometry={geometry} material={materials[i]} />
          <Html
            position={[0, 0, CELL / 2 + 5]}
            center
            style={{
              font: '600 9px/1 ui-monospace, monospace',
              letterSpacing: '.14em',
              color: '#6E8089',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              textTransform: 'uppercase',
            }}
          >
            {c.name}
          </Html>
        </group>
      ))}

      <Html
        position={[0, 0, -layout.h / 2 - CELL * 0.7]}
        center
        style={{
          font: '600 10px/1.5 ui-monospace, monospace',
          color: '#45D6C4',
          letterSpacing: '.18em',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        {`PREENCHIMENTO · MODO METROS · ARRANJO ${ARRANGEMENTS[arrange].toUpperCase()}`}
      </Html>
    </>
  );
}
