import { html, useState, useEffect, useRef } from '../lib/preact-htm.js';

// ---------- datas ----------
export const iso = (d = new Date()) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
export const hoje = () => iso(new Date());
export const segundaDe = (d = new Date()) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return iso(x); };
export const somaDias = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
export const somaMeses = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setMonth(d.getMonth() + n); return iso(d); };
export const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
export const dataBR = (s) => { if (!s) return '·'; const [y, m, d] = String(s).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
export const dataCurta = (s) => { if (!s) return ''; const [, m, d] = String(s).slice(0, 10).split('-'); return `${d}/${m}`; };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const mesNome = (ym) => { const [y, m] = ym.split('-'); return `${MESES[+m - 1]} ${y}`; };
export const idadeDe = (nasc) => { if (!nasc) return null; const n = new Date(nasc + 'T12:00:00'), h = new Date(); let i = h.getFullYear() - n.getFullYear(); if (h < new Date(h.getFullYear(), n.getMonth(), n.getDate())) i--; return i; };
export const relativo = (s) => {
  if (!s) return 'nunca';
  const d = diasEntre(String(s).slice(0, 10), hoje());
  if (d <= 0) return 'hoje'; if (d === 1) return 'ontem'; if (d < 30) return `há ${d} dias`;
  return dataBR(s);
};

// ---------- números ----------
export const num = (v, casas = 1) => (v == null || v === '' || isNaN(v) ? '·' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: casas }));
export const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const lerNum = (s) => {
  if (s == null || String(s).trim() === '') return null;
  let t = String(s).trim();
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t); return isNaN(n) ? null : n;
};
export const soDigitos = (s) => String(s || '').replace(/\D/g, '');
export const linkWhats = (tel, texto = '') => { let d = soDigitos(tel); if (d.length <= 11) d = '55' + d; return `https://wa.me/${d}${texto ? '?text=' + encodeURIComponent(texto) : ''}`; };

// ---------- avaliação física ----------
// 9 dobras (mm)
export const DOBRAS = [['triceps', 'Tríceps'], ['subescapular', 'Subescapular'], ['biceps', 'Bíceps'], ['peitoral', 'Peitoral'], ['axilar', 'Axilar média'],
  ['suprailiaca', 'Suprailíaca'], ['abdominal', 'Abdominal'], ['coxa', 'Coxa média'], ['panturrilha', 'Panturrilha medial']];
const DOBRAS_JP7 = ['peitoral', 'axilar', 'triceps', 'subescapular', 'abdominal', 'suprailiaca', 'coxa'];
export const DOBRAS_JP3 = { F: ['triceps', 'suprailiaca', 'coxa'], M: ['peitoral', 'abdominal', 'coxa'] };
// 17 perímetros (cm); os 3 antigos continuam aparecendo nas avaliações já feitas
export const MEDIDAS = [['braco_rel_d', 'Braço D relaxado'], ['braco_rel_e', 'Braço E relaxado'], ['braco_con_d', 'Braço D contraído'], ['braco_con_e', 'Braço E contraído'],
  ['ombros', 'Ombro a ombro'], ['torax', 'Tórax'], ['cintura', 'Cintura'], ['abdomen', 'Abdômen'], ['quadril', 'Quadril'],
  ['coxa_prox_d', 'Coxa proximal D'], ['coxa_prox_e', 'Coxa proximal E'], ['coxa_med_d', 'Coxa média D'], ['coxa_med_e', 'Coxa média E'],
  ['coxa_dist_d', 'Coxa distal D'], ['coxa_dist_e', 'Coxa distal E'], ['pant_d', 'Panturrilha D'], ['pant_e', 'Panturrilha E']];
export const MEDIDAS_TODAS = [...MEDIDAS, ['coxa', 'Coxa'], ['braco', 'Braço'], ['panturrilha', 'Panturrilha']];
// diâmetros ósseos (mm)
export const DIAMETROS = [['punho', 'Biestiloide (punho)'], ['umero', 'Biepicondiliano do úmero'], ['femur', 'Biepicondiliano do fêmur']];

const siri = (D) => Math.round((495 / D - 450) * 10) / 10;
const soma = (dobras, ks) => { const v = ks.map((k) => lerNum(dobras[k])); return v.some((x) => x == null) ? null : v.reduce((a, b) => a + b, 0); };
export function percentualJP7(dobras, idade, sexo = 'F') {
  const S = soma(dobras, DOBRAS_JP7); if (S == null || !idade) return null;
  return siri(sexo === 'M' ? 1.112 - 0.00043499 * S + 0.00000055 * S * S - 0.00028826 * idade : 1.097 - 0.00046971 * S + 0.00000056 * S * S - 0.00012828 * idade);
}
export function percentualJP3(dobras, idade, sexo = 'F') {
  const S = soma(dobras, DOBRAS_JP3[sexo === 'M' ? 'M' : 'F']); if (S == null || !idade) return null;
  return siri(sexo === 'M' ? 1.10938 - 0.0008267 * S + 0.0000016 * S * S - 0.0002574 * idade : 1.0994921 - 0.0009929 * S + 0.0000023 * S * S - 0.0001392 * idade);
}

// protocolos de composição: [chave, nome, o que pede, para quem]
export const PROTOCOLOS = [
  ['jp7', 'Pollock 7 dobras', 'peitoral, axilar, tríceps, subescapular, abdominal, suprailíaca e coxa', 'adultos'],
  ['jp3', 'Pollock 3 dobras', 'mulher: tríceps, suprailíaca e coxa · homem: peitoral, abdominal e coxa', 'adultos'],
  ['weltman', 'Weltman (sobrepeso)', 'perímetro do abdômen, peso e (mulher) estatura', 'sobrepeso · Weltman 1987 (homens) e 1988 (mulheres)'],
  ['tran', 'Tran & Weltman', 'abdômen, quadril, estatura e idade', 'mulheres acima de 51 anos · Tran e Weltman 1989'],
  ['slaughter', 'Slaughter (crianças)', 'dobras do tríceps e da panturrilha', 'crianças e adolescentes · Slaughter 1988'],
  ['perimetria', 'Só perimetria', 'perímetros, peso e fotos (sem adipômetro)', 'autoavaliação online'],
];
// campos que cada protocolo exige, para a tela mostrar só o necessário
export function camposProtocolo(p, sexo = 'F') {
  if (p === 'jp7') return { dobras: DOBRAS_JP7 };
  if (p === 'jp3') return { dobras: DOBRAS_JP3[sexo === 'M' ? 'M' : 'F'] };
  if (p === 'slaughter') return { dobras: ['triceps', 'panturrilha'] };
  if (p === 'weltman') return { medidas: ['abdomen'] };
  if (p === 'tran') return { medidas: ['abdomen', 'quadril'] };
  return {};
}
export function percentualGordura(p, { dobras = {}, medidas = {}, peso, altura, idade }, sexo = 'F') {
  const P = lerNum(peso), H = lerNum(altura), I = lerNum(idade), AB = lerNum(medidas.abdomen), QD = lerNum(medidas.quadril);
  const r1 = (x) => Math.round(x * 10) / 10;
  if (p === 'jp7') return percentualJP7(dobras, I, sexo);
  if (p === 'jp3') return percentualJP3(dobras, I, sexo);
  if (p === 'weltman') {
    if (!AB || !P) return null;
    if (sexo === 'M') return r1(0.31457 * AB - 0.10969 * P + 10.8336);
    return H ? r1(0.11077 * AB - 0.17666 * H + 0.14354 * P + 51.03301) : null;
  }
  if (p === 'tran') {
    if (!AB || !QD || !H || !I) return null;
    return siri(1.168297 - 0.002824 * AB + 0.0000122098 * AB * AB - 0.000733128 * QD + 0.000510477 * H - 0.000216161 * I);
  }
  if (p === 'slaughter') {
    const S = soma(dobras, ['triceps', 'panturrilha']); if (S == null) return null;
    return r1(sexo === 'M' ? 0.735 * S + 1.0 : 0.610 * S + 5.1);
  }
  return null;
}
// protocolo sugerido pelo cadastro (sexo e idade), para não abrir o errado
export const protocoloSugerido = (sexo, idade) => (idade && idade < 18 ? 'slaughter' : sexo !== 'M' && idade > 51 ? 'tran' : 'jp7');

// composição em 4 componentes: gordura, óssea (Von Döbeln/Rocha), residual (Würch) e muscular (o que sobra)
export function composicao(a, sexo = 'F') {
  const peso = lerNum(a.peso); const pct = a.percentual_gordura != null ? Number(a.percentual_gordura) : null;
  if (!peso) return {};
  const gorda = pct != null ? (peso * pct) / 100 : null;
  // diâmetros em mm (avaliações antigas em cm são convertidas: valor menor que 20 = cm)
  const mm = (v) => { const n = lerNum(v); return n == null ? null : n < 20 ? n * 10 : n; };
  const d = a.diametros || {}; const h = lerNum(a.altura); const r = mm(d.punho); const f = mm(d.femur);
  const ossea = h && r && f ? 3.02 * Math.pow((h / 100) ** 2 * (r / 1000) * (f / 1000) * 400, 0.712) : null;
  const residual = peso * (sexo === 'M' ? 0.241 : 0.209);
  const muscular = gorda != null && ossea != null ? peso - gorda - ossea - residual : null;
  const m = a.medidas || {};
  return { gorda, magra: gorda != null ? peso - gorda : null, ossea, residual, muscular,
    imc: h ? peso / (h / 100) ** 2 : null, rcq: m.cintura && m.quadril ? Number(m.cintura) / Number(m.quadril) : null };
}

// ---------- treino ----------
// ---------- semáforo do check-in ----------
// soma de 4 escalas de 1 a 5, todas no sentido "quanto maior, pior": (6 - sono) + (6 - energia) + estresse + dor
// 4 a 9 verde, 10 a 14 amarelo, 15 a 20 vermelho
export function semaforo(c) {
  if (!c) return null;
  const dor = c.dor != null ? c.dor : Math.max(c.dor_muscular || 0, c.dor_articular || 0) || null;
  if (c.sono == null || c.energia == null || c.estresse == null || dor == null) return null;
  const soma = (6 - c.sono) + (6 - c.energia) + c.estresse + dor;
  const cor = soma <= 9 ? 'verde' : soma <= 14 ? 'amarelo' : 'vermelho';
  return { soma, cor, rotulo: { verde: 'Recuperando bem', amarelo: 'Atenção', vermelho: 'Sinal vermelho' }[cor] };
}

export const tonelagem = (series) => series.reduce((t, s) => t + (s.aquecimento || s.carga == null || s.reps == null ? 0 : s.carga * s.reps), 0);
// 1RM estimado (Epley), só com séries de até 12 repetições para não inflar a estimativa
export const umRM = (carga, reps) => (carga == null || !reps || reps > 12 ? null : reps === 1 ? carga : carga * (1 + reps / 30));
// Olimpo: por exercício, a maior carga (desempate: mais reps nessa carga) e o maior 1RM estimado
export function recordes(series, exercicios) {
  const porEx = {};
  for (const s of series) {
    if (s.aquecimento || s.carga == null) continue;
    const r = porEx[s.exercicio_id] || (porEx[s.exercicio_id] = { max: null, rm: null, rmSerie: null, vezes: 0 });
    r.vezes++;
    if (!r.max || s.carga > r.max.carga || (s.carga === r.max.carga && (s.reps || 0) > (r.max.reps || 0))) r.max = s;
    const e = umRM(s.carga, s.reps);
    if (e != null && (r.rm == null || e > r.rm)) { r.rm = e; r.rmSerie = s; }
  }
  return Object.entries(porEx).map(([id, r]) => ({ ...r.max, rm: r.rm, rmSerie: r.rmSerie, vezes: r.vezes, nome: (exercicios.find((e) => e.id === id) || {}).nome || 'Exercício' }))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}
export function sequenciaSemanas(sessoes) {
  // semanas seguidas (até esta) com pelo menos 1 treino
  const semanas = new Set(sessoes.map((s) => segundaDe(new Date(s.data + 'T12:00:00'))));
  let n = 0; let s = segundaDe();
  if (!semanas.has(s)) s = somaDias(s, -7);
  while (semanas.has(s)) { n++; s = somaDias(s, -7); }
  return n;
}
export const equivalencia = (kg) => {
  const t = kg / 1000;
  if (t >= 12) return `o peso de ${num(t / 12, 1)} ${t / 12 < 2 ? 'ônibus' : 'ônibus'}, mais ou menos`;
  if (t >= 1.2) return `o peso de ${num(t / 1.2, 1)} carros populares, mais ou menos`;
  if (t >= 0.5) return `o peso de ${num(t / 0.5, 1)} pianos de cauda, mais ou menos`;
  return 'e contando';
};

// ---------- componentes ----------
export function useCarregar(fn, deps = []) {
  const [estado, set] = useState({ carregando: true, erro: null, dados: null });
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let vivo = true;
    set((e) => ({ ...e, carregando: true, erro: null }));
    fn().then((dados) => vivo && set({ carregando: false, erro: null, dados }))
      .catch((erro) => vivo && set({ carregando: false, erro: erro.message || String(erro), dados: null }));
    return () => { vivo = false; };
  }, [...deps, versao]);
  return { ...estado, recarregar: () => setVersao((v) => v + 1) };
}

export function Estado({ e, children }) {
  if (e.carregando && !e.dados) return html`<div class="carregando"><span class="spin"></span></div>`;
  if (e.erro) return html`<div class="card vazio"><p>Não consegui carregar: ${e.erro}</p><button class="btn" onClick=${e.recarregar}>Tentar de novo</button></div>`;
  return children(e.dados);
}

export const Vazio = ({ titulo, texto, children }) => html`<div class="card vazio"><h3>${titulo}</h3>${texto && html`<p>${texto}</p>`}${children}</div>`;

let avisar = () => {};
export const toast = (msg, tipo = '') => avisar(msg, tipo);
export function Toasts() {
  const [lista, set] = useState([]);
  useEffect(() => { avisar = (msg, tipo) => { const id = Math.random(); set((l) => [...l, { id, msg, tipo }]); setTimeout(() => set((l) => l.filter((x) => x.id !== id)), 3200); }; }, []);
  return html`<div class="toasts">${lista.map((t) => html`<div class=${'toast ' + t.tipo} key=${t.id}>${t.msg}</div>`)}</div>`;
}

export function Modal({ titulo, onFechar, children, largo }) {
  useEffect(() => { const f = (e) => e.key === 'Escape' && onFechar(); addEventListener('keydown', f); document.body.classList.add('travado'); return () => { removeEventListener('keydown', f); document.body.classList.remove('travado'); }; }, []);
  return html`<div class="modal-fundo" onClick=${(e) => e.target === e.currentTarget && onFechar()}>
    <div class=${'modal' + (largo ? ' largo' : '')} role="dialog" aria-label=${titulo}>
      <div class="modal-topo"><h2>${titulo}</h2><button class="icone" aria-label="Fechar" onClick=${onFechar}>✕</button></div>
      <div class="modal-corpo">${children}</div>
    </div></div>`;
}

export const Campo = ({ rotulo, dica, children, class: c }) => html`<label class=${'campo ' + (c || '')}><span class="rotulo">${rotulo}</span>${children}${dica && html`<small>${dica}</small>`}</label>`;

export function Escala({ valor, onMuda, min = 1, max = 5, rotulos }) {
  const ops = []; for (let i = min; i <= max; i++) ops.push(i);
  return html`<div class="escala">${ops.map((i) => html`<button type="button" class=${valor === i ? 'on' : ''} onClick=${() => onMuda(i)} aria-pressed=${valor === i}>${i}</button>`)}</div>
  ${rotulos && html`<div class="escala-rot"><span>${rotulos[0]}</span><span>${rotulos[1]}</span></div>`}`;
}

export function Abas({ abas, atual, onMuda }) {
  return html`<div class="abas" role="tablist">${abas.map(([k, r]) => html`<button role="tab" aria-selected=${atual === k} class=${atual === k ? 'on' : ''} onClick=${() => onMuda(k)}>${r}</button>`)}</div>`;
}

// Gráfico de linha simples em SVG
export function Linha({ pontos, sufixo = '', altura = 150 }) {
  const ref = useRef();
  const [larg, setLarg] = useState(320);
  useEffect(() => { const f = () => ref.current && setLarg(ref.current.clientWidth || 320); f(); addEventListener('resize', f); return () => removeEventListener('resize', f); }, []);
  const [ativo, setAtivo] = useState(null);
  if (!pontos || pontos.length < 2) return html`<div ref=${ref} class="grafico-vazio">Precisa de pelo menos 2 registros para desenhar a linha.</div>`;
  const P = { t: 18, r: 14, b: 24, l: 38 };
  const ys = pontos.map((p) => p.y); let mn = Math.min(...ys), mx = Math.max(...ys);
  if (mn === mx) { mn -= 1; mx += 1; } const pad = (mx - mn) * 0.12; mn -= pad; mx += pad;
  const W = larg, H = altura, iw = W - P.l - P.r, ih = H - P.t - P.b;
  const X = (i) => P.l + (pontos.length === 1 ? iw / 2 : (i * iw) / (pontos.length - 1));
  const Y = (v) => P.t + ih - ((v - mn) / (mx - mn)) * ih;
  const d = pontos.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  const area = `${d} L${X(pontos.length - 1).toFixed(1)},${P.t + ih} L${P.l},${P.t + ih} Z`;
  const ticks = [mn + pad, (mn + mx) / 2, mx - pad];
  const passo = Math.max(1, Math.ceil(pontos.length / 6));
  const a = ativo != null ? pontos[ativo] : pontos[pontos.length - 1];
  const ai = ativo != null ? ativo : pontos.length - 1;
  return html`<div ref=${ref} class="grafico">
    <svg width=${W} height=${H} viewBox=${`0 0 ${W} ${H}`} onMouseLeave=${() => setAtivo(null)}>
      <defs><linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--roxo)" stop-opacity=".28"/><stop offset="1" stop-color="var(--roxo)" stop-opacity="0"/></linearGradient></defs>
      ${ticks.map((t) => html`<g><line x1=${P.l} x2=${W - P.r} y1=${Y(t)} y2=${Y(t)} class="grade"/><text x=${P.l - 6} y=${Y(t) + 4} text-anchor="end" class="eixo">${num(t, 1)}</text></g>`)}
      <path d=${area} fill="url(#gA)"/>
      <path d=${d} fill="none" stroke="var(--roxo-claro)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${pontos.map((p, i) => html`<g>
        ${i % passo === 0 || i === pontos.length - 1 ? html`<text x=${X(i)} y=${H - 6} text-anchor="middle" class="eixo">${p.x}</text>` : null}
        <circle cx=${X(i)} cy=${Y(p.y)} r=${i === ai ? 5 : 3} class=${i === ai ? 'ponto on' : 'ponto'}/>
        <rect x=${X(i) - iw / pontos.length / 2} y=${P.t} width=${Math.max(8, iw / pontos.length)} height=${ih} fill="transparent" onMouseEnter=${() => setAtivo(i)} onClick=${() => setAtivo(i)}/>
      </g>`)}
      <text x=${Math.min(Math.max(X(ai), P.l + 30), W - P.r - 30)} y=${Math.max(Y(a.y) - 10, 12)} text-anchor="middle" class="rotulo-ponto">${num(a.y, 1)}${sufixo}</text>
    </svg></div>`;
}

// Barras simples (financeiro)
export function Barras({ dados, formato = brl }) {
  const mx = Math.max(1, ...dados.map((d) => d.v));
  return html`<div class="barras">${dados.map((d) => html`<div class="barra-col" title=${`${d.x}: ${formato(d.v)}`}>
    <span class="barra-val">${d.v ? formato(d.v).replace(',00', '') : ''}</span>
    <div class="barra" style=${`height:${Math.max(2, (d.v / mx) * 100)}%`}></div>
    <span class="barra-x">${d.x}</span></div>`)}</div>`;
}

export const copiar = async (texto) => {
  try { await navigator.clipboard.writeText(texto); toast('Copiado'); }
  catch (e) { prompt('Copie o texto:', texto); }
};
