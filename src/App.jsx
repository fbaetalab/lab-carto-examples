import { useMemo } from 'react';
import Header from './ui/Header.jsx';
import LayersPanel from './ui/LayersPanel.jsx';
import Editor from './ui/Editor.jsx';
import SpecPanel from './ui/SpecPanel.jsx';
import Scene from './scene/Scene.jsx';
import { useStore } from './store.js';

/* Três colunas, que é a forma de um configurador: o que existe (camadas),
   o resultado (cena), e o que se edita + o que sai (inspetor + spec). */
export default function App() {
  const toast = useStore((s) => s.toast);
  const hint = useMemo(
    () => (typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches
      ? '1 dedo orbita · 2 dedos zoom e pan'
      : 'arrastar orbita · botão direito faz pan · scroll dá zoom'),
    [],
  );

  return (
    <div id="app">
      <Header />
      <main>
        <LayersPanel />
        <div id="viewport">
          <Scene />
          <div id="hint">{hint}</div>
          <div id="toast" className={toast ? 'on' : ''}>{toast}</div>
        </div>
        <aside className="inspector">
          <Editor />
          <SpecPanel />
        </aside>
      </main>
    </div>
  );
}
