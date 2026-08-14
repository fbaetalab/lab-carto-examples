import { useEffect, useRef } from 'react';
import { PATTERNS, MODES, MODE_ORDER, ARRANGEMENTS, CELLULAR_PATTERNS, WALL_STYLES, SHAPE_RANGE_M } from '../config.js';
import { SURFACES, VOLUME_KINDS } from '../layers.js';
import { drawThumb } from '../lib/thumbs.js';
import { useStore, useSelected } from '../store.js';
import { Slider, Toggle, Choice, Num, ColorField, Field } from './controls.jsx';

const COMPONENTS = [
  { id: 'fill', label: 'Preench.' },
  { id: 'stroke', label: 'Borda' },
  { id: 'volume', label: 'Volume' },
];

function Thumb({ index }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) drawThumb(ref.current, index); }, [index]);
  return <canvas ref={ref} width={52} height={30} />;
}

function PatternPicker() {
  const layer = useSelected();
  const patch = useStore((s) => s.patch);
  return (
    <div className="choice" style={{ gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
      {PATTERNS.map((n, i) => (
        <button
          key={n}
          className={i === layer.fill.pattern ? 'on' : ''}
          title={n}
          style={{ padding: '5px 2px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
          onClick={() => patch('fill', { pattern: i })}
        >
          <Thumb index={i} />
          <span style={{ fontSize: 8.5, letterSpacing: '.02em' }}>{i === 0 ? 'Sólido' : n}</span>
        </button>
      ))}
    </div>
  );
}

export default function Editor() {
  const layer = useSelected();
  const component = useStore((s) => s.component);
  const setComponent = useStore((s) => s.setComponent);

  if (!layer) return null;
  const { fill, stroke, volume } = layer;
  const unit = MODES[fill.mode].unit;
  const isSolid = fill.pattern === 0;
  const isSym = fill.pattern === 8;
  const isBrick = fill.pattern === 9;
  const isShape = fill.pattern === 10;
  const hasGrain = !isSolid && !isShape;

  return (
    <>
      <div className="pane-head">
        <span className="kicker">{layer.name}</span>
        <span className="count">{layer.code}</span>
      </div>

      <nav className="tabs">
        {COMPONENTS.map((c) => (
          <button key={c.id} className={c.id === component ? 'on' : ''} onClick={() => setComponent(c.id)}>
            {c.label}
            <span className="off">{layer[c.id].on ? 'ativo' : 'desligado'}</span>
          </button>
        ))}
      </nav>

      <div className="scroll">
        {component === 'fill' && (
          <>
            <div className="sect">
              <Toggle c="fill" k="on" label="Preenchimento" hint="símbolo de área na superfície" />
              {fill.on && (
                <>
                  <Choice
                    c="fill" k="surface" label="Superfície"
                    options={SURFACES.map((s) => ({ id: s.id, label: s.label, hint: s.hint }))}
                  />
                  {fill.surface === 'plane' && (
                    <Slider c="fill" k="elevation" label="Cota do plano" min={-20} max={60} step={0.5} fmt={(v) => v.toFixed(1)} unit=" m" />
                  )}
                </>
              )}
            </div>

            {fill.on && (
              <>
                <div className="sect">
                  <div className="kicker">Padrão</div>
                  <PatternPicker />
                </div>

                <div className="sect">
                  <div className="kicker">Escala</div>
                  <Choice
                    c="fill" k="mode" columns="repeat(3,1fr)"
                    options={MODE_ORDER.map((i) => ({ value: i, label: MODES[i].btn, hint: MODES[i].cap }))}
                  />
                  <p className="field-hint" style={{ marginBottom: 12 }}>{MODES[fill.mode].cap}</p>
                  {hasGrain && (
                    <Slider
                      c="fill" k="spacing"
                      label={fill.mode === 2 ? 'Alvo na tela' : 'Espaçamento'}
                      min={2} max={120} step={0.5} fmt={(v) => v.toFixed(1)}
                      unit={fill.mode === 2 ? ' px' : ` ${unit}`}
                    />
                  )}
                  {hasGrain && !isSym && (
                    <Slider c="fill" k="lw" label="Espessura" min={0.2} max={30} step={0.1} fmt={(v) => v.toFixed(1)} unit={` ${unit}`} />
                  )}
                  {isSym && <Slider c="fill" k="sym" label="Tamanho do símbolo" min={4} max={80} step={1} fmt={(v) => v.toFixed(0)} unit={` ${unit}`} />}
                  {hasGrain && <Slider c="fill" k="rot" label="Rotação" min={0} max={180} step={1} fmt={(v) => v} unit="°" />}
                  {isBrick && <Slider c="fill" k="brickOff" label="Desloc. da fiada" min={0} max={1} step={0.05} fmt={(v) => (v * 100).toFixed(0)} unit="%" />}
                  {isShape && <Slider c="fill" k="shapeW" label="Alcance da orla" min={2} max={SHAPE_RANGE_M} step={1} fmt={(v) => v.toFixed(0)} unit=" m" />}
                  {fill.mode === 2 && (
                    <Field label="Limites da pirâmide" unit="px">
                      <Num c="fill" k="minPx" min={2} max={64} coerce={(v) => Math.max(2, parseFloat(v) || 8)} />
                      <span className="field-unit">até</span>
                      <Num c="fill" k="maxPx" min={24} max={400} coerce={(v) => Math.max(24, parseFloat(v) || 120)} />
                    </Field>
                  )}
                </div>

                {CELLULAR_PATTERNS.includes(fill.pattern) && (
                  <div className="sect">
                    <div className="kicker">Arranjo</div>
                    <Choice c="fill" k="arrange" columns="repeat(3,1fr)" options={ARRANGEMENTS.map((l, i) => ({ value: i, label: l }))} />
                    {fill.arrange === 2 && (
                      <Field label="Semente"><Num c="fill" k="seed" min={0} max={99999} /></Field>
                    )}
                  </div>
                )}

                <div className="sect">
                  <div className="kicker">Cores do preenchimento</div>
                  <ColorField c="fill" colorKey="color" alphaKey="opacity" label="Base" />
                  {!isSolid && <ColorField c="fill" colorKey="patternColor" alphaKey="patternOpacity" label="Traço do padrão" />}
                </div>
              </>
            )}
          </>
        )}

        {component === 'stroke' && (
          <>
            <div className="sect">
              <Toggle c="stroke" k="on" label="Borda" hint="largura em metros, não em pixels" />
            </div>
            {stroke.on && (
              <>
                <div className="sect">
                  <div className="kicker">Traço</div>
                  <ColorField c="stroke" colorKey="color" alphaKey="width" label="Cor e largura" alphaUnit="m" alphaMax={6} alphaScale={1} />
                  <Slider c="stroke" k="dash" label="Dash" min={0} max={24} step={1} fmt={(v) => (v ? v : 'sólido')} unit={stroke.dash ? ' m' : ''} />
                </div>
                <div className="sect">
                  <div className="kicker">Casing</div>
                  <ColorField c="stroke" colorKey="casingColor" alphaKey="casingWidth" label="Cor e largura" alphaUnit="m" alphaMax={6} alphaScale={1} />
                  <p className="field-hint">
                    Fita concêntrica por baixo da borda. Existe para a linha continuar legível
                    sobre qualquer base — sem ela, traço claro some sobre areia e escuro some
                    sobre água funda. Largura 0 desliga.
                  </p>
                </div>
              </>
            )}
          </>
        )}

        {component === 'volume' && (
          <>
            <div className="sect">
              <Toggle c="volume" k="on" label="Volume" hint="como a feição ocupa o espaço" />
              {volume.on && (
                <Choice
                  c="volume" k="kind" label="Tipo" columns="repeat(3,1fr)"
                  options={VOLUME_KINDS.map((v) => ({ id: v.id, label: v.label, hint: v.hint }))}
                />
              )}
            </div>
            {volume.on && (
              <>
                <div className="sect">
                  <div className="kicker">Cotas</div>
                  {volume.kind === 'walls' ? (
                    <Slider c="volume" k="top" label="Topo das paredes" min={1} max={80} step={1} fmt={(v) => v.toFixed(0)} unit=" m" />
                  ) : (
                    <>
                      <Slider c="volume" k="base" label="Base" min={-40} max={40} step={1} fmt={(v) => v.toFixed(0)} unit=" m" />
                      <Slider c="volume" k="top" label="Topo" min={-40} max={80} step={1} fmt={(v) => v.toFixed(0)} unit=" m" />
                    </>
                  )}
                </div>
                <div className="sect">
                  <div className="kicker">Cor do volume</div>
                  <ColorField c="volume" colorKey="color" alphaKey="opacity" label="Cor e intensidade" />
                  <p className="field-hint">
                    Independente do preenchimento: é comum querer volume em outra cor para
                    separar a leitura de área da leitura de ocupação.
                  </p>
                </div>
                {volume.kind === 'walls' && (
                  <div className="sect">
                    <div className="kicker">Animação da parede</div>
                    <Choice c="volume" k="wallStyle" columns="repeat(4,1fr)" options={WALL_STYLES.map((l, i) => ({ value: i, label: l }))} />
                    <Toggle c="volume" k="animate" label="Animar" />
                    {volume.animate && <Slider c="volume" k="speed" label="Velocidade" min={0.2} max={3} step={0.1} fmt={(v) => v.toFixed(1)} unit="×" />}
                  </div>
                )}
                {volume.kind === 'prism' && (
                  <div className="sect">
                    <Toggle c="volume" k="pulse" label="Pulsar" hint="respiração lenta do prisma" />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
