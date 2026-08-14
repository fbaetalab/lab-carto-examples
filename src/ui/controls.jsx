import { useStore, useSelected } from '../store.js';

/* Primitivas do editor. Cada uma escreve em UM componente da camada
   selecionada (fill | stroke | volume), nunca num estado global. */

function useField(component, k) {
  const layer = useSelected();
  const patch = useStore((s) => s.patch);
  return [layer?.[component]?.[k], (v) => patch(component, { [k]: v })];
}

export function Field({ label, hint, children, unit }) {
  return (
    <div className="field">
      <div className="field-head">
        <span className="field-label">{label}</span>
        {unit && <span className="field-unit">{unit}</span>}
      </div>
      <div className="field-body">{children}</div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

export function Slider({ c, k, label, min, max, step, fmt, unit }) {
  const [value, set] = useField(c, k);
  return (
    <div className="field">
      <div className="field-head">
        <span className="field-label">{label}</span>
        <span className="field-value">{fmt ? fmt(value) : value}{unit ? <i>{unit}</i> : null}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value ?? 0}
        onChange={(e) => set(parseFloat(e.target.value))}
      />
    </div>
  );
}

export function Toggle({ c, k, label, hint }) {
  const [value, set] = useField(c, k);
  return (
    <label className={`toggle${value ? ' on' : ''}`}>
      <input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} />
      <span className="toggle-track"><span className="toggle-knob" /></span>
      <span className="toggle-text">
        {label}
        {hint && <i>{hint}</i>}
      </span>
    </label>
  );
}

export function Choice({ c, k, label, options, columns }) {
  const [value, set] = useField(c, k);
  return (
    <div className="field">
      {label && <div className="field-head"><span className="field-label">{label}</span></div>}
      <div className="choice" style={columns ? { gridTemplateColumns: columns } : undefined}>
        {options.map((o) => (
          <button
            key={o.id ?? o.value}
            className={(o.id ?? o.value) === value ? 'on' : ''}
            title={o.hint}
            onClick={() => set(o.id ?? o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Num({ c, k, min, max, step, coerce }) {
  const [value, set] = useField(c, k);
  return (
    <input
      type="number" className="num" min={min} max={max} step={step} value={value ?? 0}
      onChange={(e) => set(coerce ? coerce(e.target.value) : (parseFloat(e.target.value) || 0))}
    />
  );
}

/* Cor + opacidade do MESMO componente, lado a lado: é assim que se pensa
   "preenchimento vermelho a 20%", não como dois controles distantes. */
export function ColorField({ c, colorKey, alphaKey, label, alphaUnit = '%', alphaMax = 100, alphaScale = 100 }) {
  const [color, setColor] = useField(c, colorKey);
  const [alpha, setAlpha] = useField(c, alphaKey);

  const commit = (raw) => {
    let v = raw.trim();
    if (v[0] !== '#') v = '#' + v;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) setColor(v.toUpperCase());
  };

  return (
    <div className="field">
      <div className="field-head"><span className="field-label">{label}</span></div>
      <div className="color-row">
        <span className="swatch" style={{ background: color }}>
          <input type="color" value={color ?? '#000000'} onChange={(e) => setColor(e.target.value.toUpperCase())} />
        </span>
        <input
          type="text" className="hex" maxLength={7} spellCheck={false}
          value={color ?? ''}
          onChange={(e) => setColor(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(e.currentTarget.value); }}
        />
        {alphaKey && (
          <>
            <input
              type="number" className="num" min={0} max={alphaMax} step={alphaMax > 10 ? 1 : 0.5}
              value={Math.round((alpha ?? 0) * alphaScale)}
              onChange={(e) => setAlpha(Math.min(Math.max((parseFloat(e.target.value) || 0) / alphaScale, 0), alphaMax / alphaScale))}
            />
            <span className="field-unit">{alphaUnit}</span>
          </>
        )}
      </div>
    </div>
  );
}
