import { PATTERNS, MODES, WALL_STYLES_EN } from '../config.js';

/* Serializa o estado no schema da spec. Esta é a saída que atravessa a
   fronteira para a Unity — o playground existe para produzir isto. */
export function buildJSON(s) {
  return {
    id: `${PATTERNS[s.pattern].toLowerCase()}-ref`,
    pattern: {
      type: PATTERNS[s.pattern],
      scaleMode: MODES[s.mode].id,
      spacing: s.spacing,
      spacingUnit: s.mode === 0 ? 'meters' : 'pixels',
      lineWidth: s.lw,
      symbolSize: s.sym,
      rotation: s.rot,
      minPixelSpacing: s.minPx,
      maxPixelSpacing: s.maxPx,
    },
    appearance: {
      fillColor: s.baseColor, fillOpacity: s.baseA,
      patternColor: s.patColor, patternOpacity: s.patA, patternTintSymbol: s.tint,
      outlineColor: s.outColor, outlineWidthMeters: s.outW,
      outlineDashMeters: s.dash ? [s.dash, s.dash * 0.6] : [0, 0],
    },
    visibility: s.visOn ? { minZoom: s.minZ, maxZoom: s.maxZ, fadeRange: s.fadeR } : null,
    representation3d: {
      plane: s.repPlane ? { elevationMeters: s.planeY } : null,
      drape: s.repDrape,
      walls: s.repWalls
        ? { topMeters: s.wallH, style: WALL_STYLES_EN[s.wallStyle], animated: s.animOn, speed: s.animSpeed }
        : null,
      volume: s.repVolume ? { baseMeters: s.volBase, topMeters: s.volTop, pulse: s.volAnim } : null,
      scatter: s.repScatter,
    },
  };
}

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
