/* Os readouts mudam a cada frame. Passá-los pelo estado do React causaria um
   re-render a 60 fps na árvore inteira do painel — então eles são escritos
   direto no DOM, por referência. É a exceção deliberada ao fluxo de dados. */
export const readoutEls = { z: null, ppm: null, spacing: null, level: null };

export function writeReadouts(v) {
  if (readoutEls.z) readoutEls.z.textContent = v.z;
  if (readoutEls.ppm) readoutEls.ppm.textContent = v.ppm;
  if (readoutEls.spacing) readoutEls.spacing.textContent = v.spacing;
  if (readoutEls.level) readoutEls.level.textContent = v.level;
}
