/* Relevo costeiro determinístico.

   A mesma função roda na CPU para posicionar edifícios e assentar a base das
   paredes, e é amostrada na construção da malha — por isso precisa ser barata,
   estável e sem estado.

   As três primeiras parcelas dão a forma da costa; as octaves finais existem
   para o terreno ter detalhe geométrico real (e portanto normais reais) em vez
   de depender de normal map, o que rende sombreamento muito mais convincente
   nas encostas. */
export function terrainH(x, z) {
  return 14 - 0.075 * x
    + 6 * Math.sin(x * 0.011) * Math.sin(z * 0.013)
    + 3 * Math.sin((x + z) * 0.021)
    + 2 * Math.sin(z * 0.017)
    /* detalhe */
    + 0.9 * Math.sin(x * 0.047 + 1.7) * Math.sin(z * 0.053 - 0.4)
    + 0.45 * Math.sin((x * 0.7 - z) * 0.088 + 2.2)
    + 0.22 * Math.sin(x * 0.19 - 0.9) * Math.sin(z * 0.17 + 1.1);
}
