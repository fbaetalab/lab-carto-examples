import { useStore } from '../store.js';

/* Primitivas do painel. Cada uma lê e escreve UMA chave do estado, o que
   mantém o re-render restrito ao controle que mudou. */

export function Slider({ k, label, min, max, step, fmt, hidden }) {
  const value = useStore((s) => s[k]);
  const setKey = useStore((s) => s.setKey);
  if (hidden) return null;
  return (
    <div className="row">
      <label>{label}</label>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => setKey(k, parseFloat(e.target.value))}
      />
      <output>{fmt ? fmt(value) : value}</output>
    </div>
  );
}

export function Check({ k, label, style }) {
  const value = useStore((s) => s[k]);
  const setKey = useStore((s) => s.setKey);
  return (
    <label className="chk" style={style}>
      <input type="checkbox" checked={!!value} onChange={(e) => setKey(k, e.target.checked)} />
      {label}
    </label>
  );
}

export function NumberInput({ k, min, max, step, coerce }) {
  const value = useStore((s) => s[k]);
  const setKey = useStore((s) => s.setKey);
  return (
    <input
      type="number" className="num" min={min} max={max} step={step} value={value}
      onChange={(e) => setKey(k, coerce ? coerce(e.target.value) : (parseFloat(e.target.value) || 0))}
    />
  );
}

export function Segmented({ k, options, columns, style }) {
  const value = useStore((s) => s[k]);
  const setKey = useStore((s) => s.setKey);
  return (
    <div className="seg3" style={{ ...(columns ? { gridTemplateColumns: columns } : null), ...style }}>
      {options.map((o) => (
        <button
          key={o.value}
          className={o.value === value ? 'on' : ''}
          onClick={() => setKey(k, o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* Linha de cor no formato do Figma: swatch com <input type=color> invisível
   por cima, campo hex editável e um numérico à direita. */
export function ColorRow({ k, label, pctKey, pctLabel, pctMin = 0, pctMax = 100, pctStep = 1, toPct, fromPct }) {
  const color = useStore((s) => s[k]);
  const pct = useStore((s) => s[pctKey]);
  const setKey = useStore((s) => s.setKey);

  const commitHex = (raw) => {
    let v = raw.trim();
    if (v[0] !== '#') v = '#' + v;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) setKey(k, v.toUpperCase());
  };

  return (
    <div className="crow">
      <label>{label}</label>
      <span className="sw" style={{ background: color }}>
        <input type="color" value={color} onChange={(e) => setKey(k, e.target.value.toUpperCase())} />
      </span>
      <input
        type="text" className="hex" maxLength={7} spellCheck={false}
        value={color}
        onChange={(e) => setKey(k, e.target.value)}
        onBlur={(e) => commitHex(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commitHex(e.currentTarget.value); }}
      />
      <input
        type="number" className="pct" min={pctMin} max={pctMax} step={pctStep}
        value={toPct ? toPct(pct) : pct}
        onChange={(e) => setKey(pctKey, fromPct ? fromPct(e.target.value) : (parseFloat(e.target.value) || 0))}
      />
      <span className="unit">{pctLabel}</span>
    </div>
  );
}
