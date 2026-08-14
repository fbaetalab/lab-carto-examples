import { useEffect, useRef } from 'react';
import { readoutEls } from '../render/readouts.js';
import { downloadCanvasPNG } from '../lib/exporters.js';
import { useStore } from '../store.js';

/* Readouts como KPI: número grande em offwhite, label minúsculo apagado.
   Tipografia é o herói — a leitura principal é "esse número", não "essa cor".
   Escritos direto no DOM pelo FrameDriver; passar por estado seria um
   re-render a 60 fps. */
function Readout({ id, label }) {
  const ref = useRef(null);
  useEffect(() => {
    readoutEls[id] = ref.current;
    return () => { readoutEls[id] = null; };
  }, [id]);
  return (
    <div className="ro">
      <b ref={ref}>—</b>
      <i>{label}</i>
    </div>
  );
}

export default function Header() {
  const showToast = useStore((s) => s.showToast);

  const exportPNG = () => {
    const canvas = document.querySelector('#viewport canvas');
    if (!canvas) return;
    downloadCanvasPNG(canvas, 'lab-cartografico.png');
    showToast('PNG exportado');
  };

  return (
    <header>
      <div className="brand">
        <span className="kicker">Lab Secreto · Digital Twin</span>
        <h1>Configurador cartográfico</h1>
      </div>

      <div id="readouts">
        <Readout id="z" label="Zoom z" />
        <Readout id="ppm" label="px / metro" />
        <Readout id="spacing" label="Espaç. efetivo" />
        <Readout id="level" label="Nível LOD" />
      </div>

      <div className="actions">
        <button className="btn" onClick={exportPNG}>Exportar PNG</button>
      </div>
    </header>
  );
}
