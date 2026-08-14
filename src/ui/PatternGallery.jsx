import { useEffect, useRef } from 'react';
import { PATTERNS } from '../config.js';
import { drawThumb } from '../lib/thumbs.js';
import { useStore } from '../store.js';

function Thumb({ index }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) drawThumb(ref.current, index); }, [index]);
  return <canvas ref={ref} width={58} height={34} />;
}

export default function PatternGallery() {
  const pattern = useStore((s) => s.pattern);
  const setKey = useStore((s) => s.setKey);
  return (
    <div className="pgrid">
      {PATTERNS.map((n, i) => (
        <button
          key={n}
          className={`pcell${i === pattern ? ' on' : ''}`}
          title={n}
          onClick={() => setKey('pattern', i)}
        >
          <Thumb index={i} />
          <i>{i === 0 ? 'Solid ∅' : n}</i>
        </button>
      ))}
    </div>
  );
}
