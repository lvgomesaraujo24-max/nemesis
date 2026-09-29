// Ícones de linha (SVG), herdam a cor do texto.
import { html } from '../lib/preact-htm.js';

const P = {
  inicio: html`<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>`,
  alunas: html`<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4"/><path d="M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>`,
  agenda: html`<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>`,
  financeiro: html`<path d="M12 2.5v19"/><path d="M16.5 6.5c-.8-1.3-2.5-2-4.5-2-2.6 0-4.5 1.3-4.5 3.4 0 4.6 9.2 2.4 9.2 7.3 0 2.1-2 3.6-4.7 3.6-2.2 0-4-.8-4.8-2.3"/>`,
  oraculo: html`<path d="M4 4.5h16v11.5H9.5L4 20z"/><path d="m9 10.2 2 2 4-4"/>`,
  formularios: html`<path d="M6 2.5h8l4.5 4.5v14.5H6z"/><path d="M14 2.5V7h4.5M9 12h6M9 16h6"/>`,
  inscricoes: html`<path d="M3 13.5 5.5 5h13l2.5 8.5V19H3z"/><path d="M3 13.5h5l1.5 2.5h5l1.5-2.5h5"/>`,
  exercicios: html`<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>`,
  sair: html`<path d="M9.5 20.5h-5v-17h5"/><path d="m15.5 16.5 4.5-4.5-4.5-4.5M20 12H9"/>`,
  menu: html`<path d="M4 6.5h16M4 12h16M4 17.5h16"/>`,
  seta: html`<path d="m9 5 7 7-7 7"/>`,
  abaixo: html`<path d="m6 9 6 6 6-6"/>`,
  sino: html`<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>`,
  filtro: html`<path d="M3.5 5h17l-6.5 8v6l-4 1.5V13z"/>`,
  olho: html`<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`,
  olhoOff: html`<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/>`,
  raio: html`<path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z"/>`,
  relogio: html`<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/>`,
  trocar: html`<circle cx="10.5" cy="10.5" r="6"/><path d="m20.5 20.5-5.5-5.5"/><path d="M8 10.5h5M11 8.5l2 2-2 2"/>`,
  comentario: html`<path d="M4 4.5h16v11.5H9.5L4 20z"/><path d="M8 9h8M8 12.5h5"/>`,
  video: html`<rect x="2.5" y="5.5" width="19" height="13" rx="3"/><path d="m10 9 5 3-5 3z"/>`,
  lixeira: html`<path d="M4 6.5h16M9.5 6.5V4h5v2.5M6 6.5l1 14h10l1-14"/><path d="M10 10.5v6M14 10.5v6"/>`,
  grafico: html`<path d="M5 20V11M12 20V5M19 20v-7"/>`,
  girar: html`<path d="M4 8h13l-3-3M20 16H7l3 3"/>`,
  mais: html`<path d="M12 5v14M5 12h14"/>`,
  subir: html`<path d="m6 15 6-6 6 6"/>`,
  copiar: html`<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>`,
  relatorio: html`<path d="M4 20.5h16"/><path d="M7 17V11M12 17V6M17 17v-4"/>`,
};

export const Icone = ({ nome, tam = 20, class: c }) => html`<svg class=${'ico ' + (c || '')} width=${tam} height=${tam} viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[nome] || null}</svg>`;
