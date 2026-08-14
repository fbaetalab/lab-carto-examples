import { useMemo } from 'react';
import { layerSpec, documentSpec, copyText } from '../lib/exporters.js';
import { useStore, useSelected } from '../store.js';

/* A spec viva. Era um botão que copiava para a área de transferência — ou
   seja, invisível. Num configurador o entregável tem que estar à vista,
   mudando enquanto se mexe: é ele que vai para o dev da Unity. */

/* Colorização mínima; nulos ficam apagados de propósito, para "não
   configurado" se distinguir de "configurado como zero". */
function highlight(json) {
  return json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/"([^"]+)":/g, '<span class="k">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="v">"$1"</span>')
    .replace(/: (-?\d+\.?\d*)/g, ': <span class="n">$1</span>');
}

export default function SpecPanel() {
  const layer = useSelected();
  const layers = useStore((s) => s.layers);
  const showToast = useStore((s) => s.showToast);

  const json = useMemo(() => (layer ? JSON.stringify(layerSpec(layer), null, 2) : ''), [layer]);

  const copyOne = async () => {
    showToast(await copyText(json) ? `Spec de ${layer.name} copiada` : 'Não consegui copiar');
  };
  const copyAll = async () => {
    const txt = JSON.stringify(documentSpec(layers), null, 2);
    showToast(await copyText(txt) ? `${layers.length} camadas copiadas` : 'Não consegui copiar');
  };

  return (
    <div className="spec">
      <div className="spec-head">
        <span className="kicker">Spec da camada</span>
        <span style={{ display: 'flex', gap: 14 }}>
          <button className="link" onClick={copyOne}>Copiar</button>
          <button className="link" onClick={copyAll}>Copiar tudo</button>
        </span>
      </div>
      <pre dangerouslySetInnerHTML={{ __html: highlight(json) }} />
    </div>
  );
}
