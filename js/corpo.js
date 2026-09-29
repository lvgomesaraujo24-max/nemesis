// Mapa do corpo (vista frontal e posterior). Cada músculo pinta conforme o volume.
// Os desenhos são do lado esquerdo da figura; o direito é o espelho.
import { html } from '../lib/preact-htm.js';
import { MUSCULOS, REF_VOLUME } from './musculos.js';

// silhueta (base neutra), comum às duas vistas
const BASE = [
  'M100 12c-10 0-17 8-17 19 0 12 7 22 17 22z', // cabeça (metade)
  'M92 50h8v14h-9z', // pescoço
  'M100 62c-12 0-22 2-30 6-8 3-12 9-12 17l1 12 5 30c2 13 5 26 8 38l-2 14c-2 8-3 16-2 22h32z', // tronco
  'M60 76c-6 3-9 10-9 18l-2 24c-1 10-2 18-4 26l-6 26c-2 7-3 12-1 16l7 2 3-14 8-26c3-9 5-17 6-26l4-26z', // braço
  'M38 186c-4 3-6 8-5 13 1 4 5 5 8 3l4-6 1-11z', // mão
  'M68 190c-4 12-6 28-6 44 0 20 4 38 8 54l2 12c-2 12-2 26 0 38l3 34h14l2-34c1-14 1-26 0-38l3-14c3-16 4-34 4-52v-44z', // perna
  'M73 371c-5 4-8 9-6 13h24l-1-13z', // pé
];

// músculos: [chave, caminho] por vista
const FRENTE = [
  ['trapezio', 'M92 60 74 68l18-2z'],
  ['peitoral_maior', 'M99 72c-10-3-20-1-25 5-4 6-3 15 2 21 6 6 15 8 23 6z'],
  ['deltoide_anterior', 'M74 70c-7 1-12 6-12 13 0 5 2 9 5 12 5-4 8-10 9-17z'],
  ['deltoide_lateral', 'M64 74c-5 4-7 10-6 16l3 8c2-5 3-10 3-15z'],
  ['biceps', 'M59 100c-4 5-6 13-6 21 0 6 1 10 3 12 4-4 7-11 8-19 1-6 0-11-5-14z'],
  ['antebraco', 'M52 138c-4 8-7 18-9 28l-3 14 5 1c4-9 7-18 9-27 1-6 1-11-2-16z'],
  ['obliquos', 'M78 108c-3 8-4 18-2 28 1 10 4 20 8 28l4-2V110z'],
  ['reto_abdominal', 'M90 108h9v17h-9zM90 128h9v17h-9zM90 148h9v24h-8z'],
  ['quadriceps', 'M72 196c-4 16-5 34-2 52 2 12 6 22 12 28h8c3-14 4-30 3-46-1-14-3-26-6-36-4-2-10-2-15 2z'],
  ['adutores', 'M89 190c3 10 5 24 6 38l4 16v-54z'],
];
const COSTAS = [
  ['trapezio', 'M99 54 78 68l6 8 15 38z'],
  ['deltoide_posterior', 'M76 70c-8 0-13 5-14 12 0 4 1 8 4 11 5-3 9-9 10-16z'],
  ['deltoide_lateral', 'M64 74c-5 4-7 10-6 16l3 8c2-5 3-10 3-15z'],
  ['romboides', 'M98 76 86 80l4 22 9 6z'],
  ['latissimo', 'M84 94c-6 4-9 12-8 22 1 12 6 24 13 32l10 4v-38l-9-10z'],
  ['eretores', 'M92 132h7v44h-7z'],
  ['triceps', 'M58 98c-4 5-6 13-6 21 0 6 1 10 3 12 5-4 8-11 9-19 0-6-1-11-6-14z'],
  ['antebraco', 'M52 138c-4 8-7 18-9 28l-3 14 5 1c4-9 7-18 9-27 1-6 1-11-2-16z'],
  ['gluteo_medio', 'M76 176c-3 4-4 9-3 14l9 2 12-10c-5-5-11-7-18-6z'],
  ['gluteo_maximo', 'M74 192c-2 10 0 20 7 26 5 4 12 5 18 4v-38c-9 0-18 3-25 8z'],
  ['biceps_femoral', 'M72 226c-2 16-1 32 3 46l6 8h4c-1-18-2-36-4-54z'],
  ['semitendineo', 'M83 226c1 18 2 36 4 54h6c2-16 3-34 2-54z'],
  ['panturrilha', 'M72 296c-3 10-3 22 0 32 2 6 5 10 9 10s6-6 6-14c0-12-3-22-7-28z'],
];

// cor: cinza (0) até roxo (100% = referência de volume alto)
const mistura = (t) => {
  const a = [88, 88, 92], b = [176, 84, 230];
  const c = a.map((x, i) => Math.round(x + (b[i] - x) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};
export const corVolume = (v) => (v > 0 ? mistura(Math.min(1, v / REF_VOLUME)) : 'var(--corpo-musculo)');

export function MapaCorpo({ valores = {}, vista = 'frente', largura = 190, onMusculo }) {
  const lista = vista === 'frente' ? FRENTE : COSTAS;
  const lado = (espelho) => html`<g transform=${espelho ? 'translate(200 0) scale(-1 1)' : ''}>
    ${BASE.map((d) => html`<path d=${d} class="corpo-base"/>`)}
    ${lista.map(([k, d]) => { const v = valores[k] || 0;
      return html`<path d=${d} fill=${corVolume(v)} class=${'corpo-musculo' + (onMusculo ? ' clicavel' : '')} onClick=${onMusculo ? () => onMusculo(k) : undefined}><title>${MUSCULOS[k].nome}: ${String(Math.round(v * 10) / 10).replace('.', ',')} séries</title></path>`; })}
  </g>`;
  return html`<svg class="mapa-corpo" width=${largura} height=${largura * 1.95} viewBox="0 0 200 390" role="img" aria-label=${`Mapa muscular, vista ${vista === 'frente' ? 'frontal' : 'posterior'}`}>
    ${lado(false)}${lado(true)}
  </svg>`;
}
