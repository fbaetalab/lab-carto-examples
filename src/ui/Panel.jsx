import { useState } from 'react';
import { MODES, MODE_ORDER, WALL_STYLES, ARRANGEMENTS, CELLULAR_PATTERNS, SHAPE_RANGE_M } from '../config.js';
import { useStore } from '../store.js';
import { replaceSymbolTexture } from '../render/uniforms.js';
import { imageToSymbolCanvas } from '../lib/textures.js';
import { Slider, Check, NumberInput, Segmented, ColorRow } from './controls.jsx';
import PatternGallery from './PatternGallery.jsx';
import Presets from './Presets.jsx';

const TABS = [
  ['tPresets', 'Presets'], ['tPattern', 'Padrão'], ['tScale', 'Escala'],
  ['tColors', 'Cores'], ['t3D', '3D'], ['tMore', 'Mais'],
];

function SymbolUpload() {
  const setKey = useStore((s) => s.setKey);
  const showToast = useStore((s) => s.showToast);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      replaceSymbolTexture(imageToSymbolCanvas(img));
      setKey('pattern', 8);
      URL.revokeObjectURL(url);
      showToast('Símbolo carregado');
    };
    img.onerror = () => { URL.revokeObjectURL(url); showToast('Não consegui ler esse arquivo'); };
    img.src = url;
  };

  return (
    <>
      <input type="file" accept=".svg,image/*" onChange={onFile} />
      <Check k="tint" label="tingir com a cor do padrão" style={{ marginTop: 8 }} />
    </>
  );
}

export default function Panel() {
  const [tab, setTab] = useState('tPattern');
  const s = useStore();

  const isSolid = s.pattern === 0;
  const isSym = s.pattern === 8;
  const isBrick = s.pattern === 9;
  const isShape = s.pattern === 10;
  const isCellular = CELLULAR_PATTERNS.includes(s.pattern);
  /* Shapeburst não é periódico: rotação, espaçamento e espessura não o afetam. */
  const hasGrain = !isSolid && !isShape;
  const unit = MODES[s.mode].unit;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;

  return (
    <aside className={tab}>
      <nav id="tabbar">
        {TABS.map(([cls, label]) => (
          <button key={cls} className={tab === cls ? 'on' : ''} onClick={() => setTab(cls)}>
            {label}
          </button>
        ))}
      </nav>

      <section className="s" id="sPresets">
        <h2>PRESETS</h2>
        <Presets />
      </section>

      <section className="s" id="sPattern">
        <h2>PADRÃO</h2>
        <PatternGallery />
        <div style={{ marginTop: 8 }}>
          <Slider k="rot" label="rotação" min={0} max={180} step={1} fmt={(v) => `${v}°`} hidden={!hasGrain} />
        </div>
        {isCellular && (
          <>
            <div className="caption" style={{ margin: '2px 1px 6px' }}>arranjo</div>
            <Segmented k="arrange" options={ARRANGEMENTS.map((l, i) => ({ value: i, label: l }))} />
            {s.arrange === 2 && (
              <div className="row" style={{ marginTop: 8 }}>
                <label>semente</label>
                <NumberInput k="seed" min={0} max={99999} />
                <span className="unit">determinística</span>
              </div>
            )}
          </>
        )}
        {isBrick && (
          <Slider k="brickOff" label="desloc. fiada" min={0} max={1} step={0.05} fmt={(v) => `${(v * 100) | 0}%`} />
        )}
        {isShape && (
          <>
            <Slider k="shapeW" label="alcance" min={2} max={SHAPE_RANGE_M} step={1} fmt={(v) => `${v.toFixed(0)} m`} />
            <div className="caption">Decai da borda para dentro, a partir da distância-à-borda pré-calculada. Respeita o furo do polígono.</div>
          </>
        )}
      </section>

      <section className="s" id="sScale">
        <h2>ESCALA</h2>
        <Segmented
          k="mode"
          options={MODE_ORDER.map((i) => ({ value: i, label: MODES[i].btn }))}
        />
        <div className="caption">{MODES[s.mode].cap}</div>
        <Slider
          k="spacing"
          label={s.mode === 2 ? 'alvo (px)' : `espaçamento (${unit})`}
          min={2} max={120} step={0.5} fmt={(v) => v.toFixed(1)} hidden={!hasGrain}
        />
        <Slider
          k="lw" label={`espessura (${unit})`} min={0.2} max={30} step={0.1}
          fmt={(v) => v.toFixed(1)} hidden={!hasGrain || isSym}
        />
        <Slider
          k="sym" label={`símbolo (${unit})`} min={4} max={80} step={1}
          fmt={(v) => v.toFixed(0)} hidden={!isSym}
        />
        {s.mode === 2 && (
          <div className="row">
            <label>limites</label>
            <NumberInput k="minPx" min={2} max={64} coerce={(v) => Math.max(2, parseFloat(v) || 8)} />
            <span className="unit">–</span>
            <NumberInput k="maxPx" min={24} max={400} coerce={(v) => Math.max(24, parseFloat(v) || 120)} />
            <span className="unit">px</span>
          </div>
        )}
      </section>

      <section className="s" id="sColors">
        <h2>CORES</h2>
        <ColorRow
          k="baseColor" label="preenchimento" pctKey="baseA" pctLabel="%"
          toPct={(v) => Math.round(v * 100)}
          fromPct={(v) => Math.min(Math.max((parseFloat(v) || 0) / 100, 0), 1)}
        />
        {!isSolid && (
          <ColorRow
            k="patColor" label="padrão" pctKey="patA" pctLabel="%"
            toPct={(v) => Math.round(v * 100)}
            fromPct={(v) => Math.min(Math.max((parseFloat(v) || 0) / 100, 0), 1)}
          />
        )}
        <ColorRow
          k="outColor" label="borda" pctKey="outW" pctLabel="m"
          pctMin={0} pctMax={6} pctStep={0.5}
        />
        <ColorRow
          k="casingColor" label="casing" pctKey="casingW" pctLabel="m"
          pctMin={0} pctMax={6} pctStep={0.5}
        />
        <div className="crow">
          <label>dash da borda</label>
          <NumberInput k="dash" min={0} max={24} />
          <span className="unit">m · 0 = sólido</span>
        </div>
      </section>

      <section className="s" id="s3D">
        <h2>DEMARCAÇÃO 3D</h2>
        <Check k="repPlane" label="plano em cota fixa" />
        {s.repPlane && <Slider k="planeY" label="cota do plano" min={-20} max={60} step={0.5} fmt={(v) => `${v.toFixed(1)} m`} />}
        <Check k="repDrape" label="drapeado no terreno" />
        <Check k="repWalls" label="paredes no perímetro" />
        {s.repWalls && (
          <>
            <Slider k="wallH" label="topo das paredes" min={4} max={80} step={1} fmt={(v) => `${v.toFixed(0)} m`} />
            <Segmented
              k="wallStyle"
              columns="repeat(4,1fr)"
              style={{ marginBottom: 8 }}
              options={WALL_STYLES.map((l, i) => ({ value: i, label: l }))}
            />
          </>
        )}
        <Check k="repVolume" label="volume extrudado" />
        {(s.repVolume || s.repScatter) && (
          <div className="row">
            <label>base / topo</label>
            <NumberInput k="volBase" min={-40} max={40} />
            <span className="unit">–</span>
            <NumberInput k="volTop" min={-40} max={80} />
            <span className="unit">m</span>
          </div>
        )}
        <Check k="volAnim" label="pulsar volume" />
        <Check k="repScatter" label="volumes distribuídos" />
        <Check k="animOn" label="animação das paredes" style={{ marginTop: 8 }} />
        {s.animOn && s.repWalls && (
          <Slider k="animSpeed" label="velocidade" min={0.2} max={3} step={0.1} fmt={(v) => `${v.toFixed(1)}×`} />
        )}
        <Check k="contours" label="curvas de nível (terra + batimetria)" style={{ marginTop: 8 }} />
        <Check k="sea" label="mar" />
      </section>

      {isSym && (
        <details className="s" id="dSym" open>
          <summary>SÍMBOLO · SVG / PNG / JPG</summary>
          <SymbolUpload />
        </details>
      )}

      <details className="s" id="dVis">
        <summary>VISIBILIDADE POR ZOOM</summary>
        <Check k="visOn" label="ativar min/max zoom (níveis z)" />
        <Slider k="minZ" label="zoom mín" min={0} max={24} step={0.5} fmt={(v) => `z ${v.toFixed(1)}`} />
        <Slider k="maxZ" label="zoom máx" min={0} max={24} step={0.5} fmt={(v) => `z ${v.toFixed(1)}`} />
        <Slider k="fadeR" label="fade (níveis)" min={0.1} max={3} step={0.1} fmt={(v) => v.toFixed(1)} />
      </details>

      <details className="s" id="dScene" open>
        <summary>CENA</summary>
        <Segmented
          k="theme"
          columns="1fr 1fr"
          options={[{ value: 'dark', label: 'Névoa fria' }, { value: 'light', label: 'Névoa clara' }]}
        />
        <Check k="bld" label="edifícios de teste (oclusão)" style={{ marginTop: 8 }} />
        <Check k="post" label="pós-processamento" />
        {s.post && <Slider k="bloom" label="bloom" min={0} max={2} step={0.05} fmt={(v) => `${v.toFixed(2)}×`} />}
        <Check k="shadows" label="sombras do sol" />
        <Check k="ssao" label="oclusão ambiente (N8AO)" />
        <Slider k="sunAz" label="azimute do sol" min={0} max={360} step={1} fmt={(v) => `${v}°`} />
        <Slider k="sunEl" label="elevação do sol" min={2} max={80} step={1} fmt={(v) => `${v}°`} />
      </details>

      {coarse ? null : null}
    </aside>
  );
}
