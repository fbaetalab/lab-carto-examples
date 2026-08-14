import { useMemo } from 'react';
import Header from './ui/Header.jsx';
import Panel from './ui/Panel.jsx';
import Scene from './scene/Scene.jsx';
import { useStore } from './store.js';

export default function App() {
  const toast = useStore((s) => s.toast);
  const hint = useMemo(
    () => (typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches
      ? '1 dedo = orbitar · 2 dedos = zoom e pan'
      : 'arrastar = orbitar · botão direito = pan · scroll = zoom'),
    [],
  );

  return (
    <div id="app">
      <Header />
      <main>
        <div id="viewport">
          <Scene />
          <div id="hint">{hint}</div>
          <div id="toast" className={toast ? 'on' : ''}>{toast}</div>
        </div>
        <Panel />
      </main>
    </div>
  );
}
