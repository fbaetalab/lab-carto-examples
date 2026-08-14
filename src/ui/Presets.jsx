import { PRESETS } from '../presets.js';
import { useStore } from '../store.js';

/* O "dot" de cada chip mostra as duas cores que definem o preset — cor de
   padrão em cima, preenchimento embaixo — para dar reconhecimento visual
   antes de clicar. */
export default function Presets() {
  const applyPreset = useStore((s) => s.applyPreset);
  return (
    <div className="chips">
      {PRESETS.map((pr) => (
        <button key={pr.n} className="chip" onClick={() => applyPreset(pr.p)}>
          <span
            className="dot"
            style={{
              background: `linear-gradient(135deg, ${pr.p.patColor || pr.p.outColor || '#888'} 50%, ${pr.p.baseColor || 'transparent'} 50%)`,
            }}
          />
          {pr.n}
        </button>
      ))}
    </div>
  );
}
