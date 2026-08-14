import { useStore } from '../store.js';
import { layerSwatch } from '../layers.js';

/* Lista de camadas — a espinha do configurador. Cada linha mostra, sem clique:
   se está visível, a cor dominante, o código da camada e quais dos três
   componentes estão ligados (os três pontinhos). */
export default function LayersPanel() {
  const layers = useStore((s) => s.layers);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const toggleVisible = useStore((s) => s.toggleVisible);

  const visibles = layers.filter((l) => l.visible).length;

  return (
    <aside className="rail">
      <div className="pane-head">
        <span className="kicker">Camadas</span>
        <span className="count">{visibles}/{layers.length}</span>
      </div>
      <div className="scroll">
        {layers.map((l) => (
          <div
            key={l.id}
            className={`layer${l.id === selectedId ? ' on' : ''}`}
            onClick={() => select(l.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(l.id); } }}
          >
            <span
              className={`eye${l.visible ? ' vis' : ''}`}
              title={l.visible ? 'Ocultar camada' : 'Mostrar camada'}
              onClick={(e) => { e.stopPropagation(); toggleVisible(l.id); }}
            />
            <span className="dot" style={{ background: layerSwatch(l) }} />
            <span className="txt">
              <b>{l.name}</b>
              <i>{l.code}</i>
            </span>
            {/* Os pontinhos resumem quais componentes estão ligados. Linha e
                ponto são primitivas de componente único, então mostram um só. */}
            <span className="parts" title={l.kind === 'polygon' ? 'preenchimento · borda · volume' : l.kind}>
              {l.kind === 'polygon' ? (
                <>
                  <span className={l.fill.on ? 'act' : ''} />
                  <span className={l.stroke.on ? 'act' : ''} />
                  <span className={l.volume.on ? 'act' : ''} />
                </>
              ) : (
                <span className={l[l.kind].on ? 'act' : ''} />
              )}
            </span>
          </div>
        ))}
      </div>
      <div className="build">LAB CARTOGRÁFICO · v0.4 · REF UNITY 6.3</div>
    </aside>
  );
}
