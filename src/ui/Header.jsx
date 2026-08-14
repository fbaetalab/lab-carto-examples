import { useEffect, useRef } from 'react';
import { readoutEls } from '../render/readouts.js';
import { buildJSON, copyText, downloadCanvasPNG } from '../lib/exporters.js';
import { PATTERNS, MODES, SCENARIOS } from '../config.js';
import { useStore } from '../store.js';

/* Os quatro readouts são escritos pelo FrameDriver direto no DOM — por isso
   registram refs em vez de virem do estado. */
function Readout({ id, label }) {
  const ref = useRef(null);
  useEffect(() => {
    readoutEls[id] = ref.current;
    return () => { readoutEls[id] = null; };
  }, [id]);
  return (
    <div className="ro">
      <b ref={ref}>–</b>
      <i>{label}</i>
    </div>
  );
}

export default function Header() {
  const showToast = useStore((s) => s.showToast);
  const scenario = useStore((s) => s.scenario);
  const setKey = useStore((s) => s.setKey);

  const exportPNG = () => {
    const canvas = document.querySelector('#viewport canvas');
    if (!canvas) return;
    const s = useStore.getState();
    downloadCanvasPNG(canvas, `pattern3d-${PATTERNS[s.pattern]}-${MODES[s.mode].id}.png`);
    showToast('PNG exportado');
  };

  const copyJSON = async () => {
    const ok = await copyText(JSON.stringify(buildJSON(useStore.getState()), null, 2));
    showToast(ok ? 'JSON copiado' : 'Não consegui copiar');
  };

  return (
    <header>
      <h1>LAB <span>CARTOGRÁFICO</span></h1>
      <nav id="scenarios">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            className={s.id === scenario ? 'on' : ''}
            title={s.hint}
            onClick={() => setKey('scenario', s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div id="readouts" style={scenario === 'catalog' ? { display: 'none' } : undefined}>
        <Readout id="z" label="ZOOM Z" />
        <Readout id="ppm" label="PX / METRO" />
        <Readout id="spacing" label="ESPAÇ. EFETIVO" />
        <Readout id="level" label="NÍVEL LOD" />
      </div>
      <button onClick={exportPNG}>Exportar PNG</button>
      <button onClick={copyJSON}>Copiar JSON</button>
    </header>
  );
}
