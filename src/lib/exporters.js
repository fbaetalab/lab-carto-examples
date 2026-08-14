import { PATTERNS, MODES, WALL_STYLES_EN, ARRANGEMENTS_EN, CELLULAR_PATTERNS, LINE_STYLES_EN, SYMBOL_KINDS_EN } from '../config.js';

/* A spec é o produto desta ferramenta. O que atravessa a fronteira para a
   Unity é este objeto, não um screenshot — daí a estrutura espelhar os três
   componentes da camada em vez de achatar tudo num nível só. */
export function layerSpec(l) {
  /* Linha e ponto são primitivas de componente único — a spec reflete isso em
     vez de emitir campos de polígono vazios. */
  if (l.kind === 'line') {
    return {
      id: l.id, name: l.name, code: l.code, kind: 'line',
      line: l.line.on ? {
        style: LINE_STYLES_EN[l.line.style],
        color: l.line.color, opacity: l.line.opacity,
        widthMeters: l.line.width,
        dashMeters: l.line.style === 0 ? null : [l.line.dash, l.line.gap],
        surface: l.line.surface,
        elevationMeters: l.line.elevation,
      } : null,
      visibility: l.vis.on ? { minZoom: l.vis.minZ, maxZoom: l.vis.maxZ, fadeRange: l.vis.fadeR } : null,
    };
  }
  if (l.kind === 'point') {
    return {
      id: l.id, name: l.name, code: l.code, kind: 'point',
      point: l.point.on ? {
        symbol: SYMBOL_KINDS_EN[l.point.kind],
        color: l.point.color, opacity: l.point.opacity,
        sizePixels: l.point.size,
        labels: l.point.labels,
      } : null,
      visibility: l.vis.on ? { minZoom: l.vis.minZ, maxZoom: l.vis.maxZ, fadeRange: l.vis.fadeR } : null,
    };
  }

  const f = l.fill, s = l.stroke, v = l.volume;
  const cellular = CELLULAR_PATTERNS.includes(f.pattern);

  return {
    id: l.id,
    name: l.name,
    code: l.code,
    kind: 'polygon',
    fill: f.on ? {
      surface: f.surface,
      elevationMeters: f.surface === 'plane' ? f.elevation : null,
      pattern: {
        type: PATTERNS[f.pattern],
        scaleMode: MODES[f.mode].id,
        spacing: f.spacing,
        spacingUnit: f.mode === 0 ? 'meters' : 'pixels',
        lineWidth: f.lw,
        symbolSize: f.pattern === 8 ? f.sym : null,
        rotation: f.rot,
        arrangement: cellular ? ARRANGEMENTS_EN[f.arrange] : null,
        randomSeed: cellular && f.arrange === 2 ? f.seed : null,
        brickOffsetRatio: f.pattern === 9 ? f.brickOff : null,
        shapeburstWidthMeters: f.pattern === 10 ? f.shapeW : null,
        minPixelSpacing: f.mode === 2 ? f.minPx : null,
        maxPixelSpacing: f.mode === 2 ? f.maxPx : null,
      },
      color: f.color,
      opacity: f.opacity,
      patternColor: f.pattern === 0 ? null : f.patternColor,
      patternOpacity: f.pattern === 0 ? null : f.patternOpacity,
    } : null,
    stroke: s.on ? {
      color: s.color,
      widthMeters: s.width,
      dashMeters: s.dash ? [s.dash, s.dash * 0.6] : [0, 0],
      casingColor: s.casingWidth > 0 ? s.casingColor : null,
      casingWidthMeters: s.casingWidth,
    } : null,
    volume: v.on ? {
      kind: v.kind,
      color: v.color,
      opacity: v.opacity,
      baseMeters: v.kind === 'walls' ? null : v.base,
      topMeters: v.top,
      wallStyle: v.kind === 'walls' ? WALL_STYLES_EN[v.wallStyle] : null,
      animated: v.kind === 'walls' ? v.animate : null,
      speed: v.kind === 'walls' && v.animate ? v.speed : null,
      pulse: v.kind === 'prism' ? v.pulse : null,
    } : null,
    visibility: l.vis.on ? { minZoom: l.vis.minZ, maxZoom: l.vis.maxZ, fadeRange: l.vis.fadeR } : null,
  };
}

export const documentSpec = (layers) => ({
  schema: 'labsecreto.cartography/1.1',
  layers: layers.map(layerSpec),
});

export async function copyText(txt) {
  try {
    await navigator.clipboard.writeText(txt);
    return true;
  } catch {
    const t = document.createElement('textarea');
    t.value = txt;
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  }
}

export function downloadCanvasPNG(canvas, filename) {
  const a = document.createElement('a');
  a.download = filename;
  a.href = canvas.toDataURL('image/png');
  a.click();
}
