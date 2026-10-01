// Páginas do relatório de evolução que vão além dos números do período:
// deusa do mês, visão macro, comparativo com o período anterior, mapa do corpo,
// bem-estar × desempenho, metas e conquistas, jornada, missão e card para Stories.
// Tudo aqui é calculado a partir do que a aluna já registra; nada é inventado.
import { html } from '../lib/preact-htm.js';
import { num, dataBR, dataCurta, somaDias, diasEntre, segundaDe, tonelagem, iso } from './util.js';
import { MapaCorpo } from './corpo.js';
import { MUSCULOS, musculosDe, nivelVolume } from './musculos.js';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const mesDe = (ym) => MESES[Number(ym.slice(5, 7)) - 1];
export const fimDoMes = (ym) => { const [y, m] = ym.split('-').map(Number); return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`; };
export const somaMesYM = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const maiuscula = (s) => String(s || '').replace(/^./, (c) => c.toUpperCase());
const plural = (n, um, varios) => `${num(n, 0)} ${n === 1 ? um : varios}`;
const pctTxt = (v) => `${v > 0 ? '+' : ''}${num(v * 100, 0)}%`;
const serieTxt = (s) => (s ? `${num(s.carga, 1)} kg × ${s.reps || '·'}` : '·');
const semAcento = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// letra do treino: "A · Inferior posterior" → "A"
export const letraTreino = (nome) => { const m = /^\s*([A-Za-z0-9]{1,2})\b/.exec(nome || ''); return m ? m[1].toUpperCase() : String(nome || '·').trim().slice(0, 1).toUpperCase(); };

// ---------- peças comuns das folhas ----------
export const Cab = ({ sobre, titulo }) => html`<header class="rf-cab"><p class="rf-sobre">${sobre}</p><h2>${titulo}</h2></header>`;
export const Rodape = ({ aluna, n }) => html`<footer class="rf-rodape"><span>NEMESIS · ${aluna.nome}</span><span>${n}</span></footer>`;
export const Dado = ({ rot, val, sub, destaque }) => html`<div class="rf-dado"><span class="rf-rot">${rot}</span><b class=${destaque ? 'rf-acento' : ''}>${val}</b>${sub && html`<small>${sub}</small>`}</div>`;

// seta de variação. dir: 'mais' (subir é bom), 'menos' (cair é bom) ou null (só informa)
export function variacao(a, b, { modo = 'abs', casas = 1, un = '', dir = null } = {}) {
  if (a == null || b == null || isNaN(a) || isNaN(b)) return null;
  const d = b - a;
  const igual = Math.abs(d) < 1e-9 || (modo === 'pct' && a !== 0 && Math.abs(d / a) < 0.005);
  const seta = igual ? '=' : d > 0 ? '▲' : '▼';
  let txt;
  if (igual) txt = 'igual';
  else if (modo === 'pct') txt = a ? `${num(Math.abs(d / a) * 100, 0)}%` : `${num(Math.abs(d), casas)}${un}`;
  else if (modo === 'pp') txt = `${num(Math.abs(d) * 100, 0)} ${Math.round(Math.abs(d) * 100) === 1 ? 'ponto' : 'pontos'}`;
  else txt = `${num(Math.abs(d), casas)}${un}`;
  const bom = igual || !dir ? null : (d > 0) === (dir === 'mais');
  return { txt: igual ? txt : `${seta} ${txt}`, bom, d };
}
export const Seta = ({ v, sufixo = '' }) => (v ? html`<span class=${'rx-seta ' + (v.bom == null ? 'rx-neutro' : v.bom ? 'rx-bom' : 'rx-ruim')}>${v.txt}${sufixo}</span>` : null);

// direção boa para o peso e as medidas, de acordo com o objetivo escrito
function direcoes(objetivo) {
  const o = semAcento(objetivo);
  const perder = /emagrec|perder|secar|defini|gordura|reduzir/.test(o);
  const ganhar = /massa|hipertrof|ganhar peso|ganho de peso|engordar/.test(o);
  const gluteo = /gluteo|bumbum|perna|massa|hipertrof|volume/.test(o);
  return { peso: perder && !ganhar ? 'menos' : ganhar && !perder ? 'mais' : null, quadril: gluteo ? 'mais' : null };
}

// ============================================================
// DEUSA DO MÊS
// ============================================================
export const DEUSAS = {
  nike: { nome: 'Nike', lema: 'a vitória em forma de recorde', eixo: 'Vitória' },
  artemis: { nome: 'Ártemis', lema: 'a caçadora que não perde o alvo', eixo: 'Constância' },
  sekhmet: { nome: 'Sekhmet', lema: 'a força que não pede licença', eixo: 'Força' },
  atena: { nome: 'Atena', lema: 'a estratégia antes da força', eixo: 'Estratégia' },
  hestia: { nome: 'Héstia', lema: 'a chama que se mantém acesa', eixo: 'Chama acesa' },
};
// a primeira regra que a aluna cumpre escolhe a deusa
export function deusaDe(r) {
  const n = r.feitas.length, pr = r.recordes.length, ad = r.aderencia, top = r.destaques[0];
  const chk = r.checkinsFeitos ? ` e mandou ${plural(r.checkinsFeitos, 'check-in', 'check-ins')}` : '';
  const pega = (id, motivo, curto) => ({ id, ...DEUSAS[id], motivo, curto });
  if (n && pr >= 5 && ad >= 0.75) return pega('nike', `${plural(pr, 'recorde pessoal', 'recordes pessoais')} em ${plural(n, 'treino', 'treinos')}. A carga não parou de subir.`, `${pr} recordes`);
  if (n >= 4 && ad >= 0.9) return pega('artemis', `Você treinou ${n} vezes, ${num(ad * 100, 0)}% do previsto${chk}.`, `${n} treinos, ${num(ad * 100, 0)}%`);
  if (n && top && top.ganho >= 0.08) return pega('sekhmet', `${top.nome} subiu ${pctTxt(top.ganho)} de força estimada. A força respondeu ao treino.`, `${top.nome} ${pctTxt(top.ganho)}`);
  if (n && ad >= 0.7) return pega('atena', `${plural(n, 'treino', 'treinos')}, ${num(ad * 100, 0)}% do previsto${r.esforcoMedio != null ? `, com esforço médio de ${num(r.esforcoMedio, 1)}` : ''}. Constância com a cabeça no lugar.`, `${n} treinos, ${num(ad * 100, 0)}%`);
  return pega('hestia', n ? `${plural(n, 'treino', 'treinos')} num período mais difícil. O que importa agora é manter a chama acesa.` : 'Nenhum treino registrado no período. O próximo treino reacende a chama.', n ? `${n} treinos` : 'recomeço');
}

// emblema desenhado para cada deusa (SVG, sem imagem externa)
export function Emblema({ id, tam = 200, cor = '#7b1fa2', fundo = '#fff' }) {
  const moldura = html`<circle cx="100" cy="100" r="92" fill="none" stroke=${cor} stroke-width="1.5" opacity=".35"/><circle cx="100" cy="100" r="80" fill="none" stroke=${cor} stroke-width="1" stroke-dasharray="2 5" opacity=".5"/>`;
  let d;
  if (id === 'artemis') d = html`<circle cx="92" cy="96" r="58" fill=${cor}/><circle cx="116" cy="84" r="52" fill=${fundo}/>
    <line x1="34" y1="166" x2="160" y2="40" stroke=${cor} stroke-width="4" stroke-linecap="round"/><path d="M160 40 l-4 18 l-14 -14 z" fill=${cor}/>
    <path d="M40 160 l-12 2 l4 -8 M46 154 l-12 2 l4 -8" stroke=${cor} stroke-width="3" fill="none" stroke-linecap="round"/>`;
  else if (id === 'nike') {
    const folhas = [128, 146, 164, 182, 200, 218, 236].map((a) => { const r = (a * Math.PI) / 180; const x = 100 + 56 * Math.cos(r), y = 104 + 56 * Math.sin(r);
      return html`<ellipse cx=${x} cy=${y} rx="13" ry="5.5" fill=${cor} transform=${`rotate(${a + 60} ${x} ${y})`}/>`; });
    d = html`<g>${folhas}</g><g transform="translate(200 0) scale(-1 1)">${folhas}</g>
      <path d="M100 62 l9 20 22 2 -17 14 5 21 -19 -11 -19 11 5 -21 -17 -14 22 -2z" fill=${cor}/>`;
  } else if (id === 'sekhmet') {
    const raios = [...Array(12)].map((_, i) => { const r = (i * 30 * Math.PI) / 180; return html`<line x1=${100 + 46 * Math.cos(r)} y1=${100 + 46 * Math.sin(r)} x2=${100 + 66 * Math.cos(r)} y2=${100 + 66 * Math.sin(r)} stroke=${cor} stroke-width="6" stroke-linecap="round"/>`; });
    d = html`${raios}<circle cx="100" cy="100" r="36" fill=${cor}/><circle cx="100" cy="100" r="18" fill=${fundo}/><circle cx="100" cy="100" r="9" fill=${cor}/>`;
  } else if (id === 'atena') d = html`<path d="M58 70 l14 16 M142 70 l-14 16" stroke=${cor} stroke-width="6" stroke-linecap="round"/>
    <circle cx="76" cy="102" r="24" fill="none" stroke=${cor} stroke-width="7"/><circle cx="124" cy="102" r="24" fill="none" stroke=${cor} stroke-width="7"/>
    <circle cx="76" cy="102" r="9" fill=${cor}/><circle cx="124" cy="102" r="9" fill=${cor}/><path d="M100 120 l-9 12 h18z" fill=${cor}/>
    <path d="M64 146 q36 16 72 0" stroke=${cor} stroke-width="5" fill="none" stroke-linecap="round"/>`;
  else d = html`<path d="M100 36 C120 66 142 84 140 118 C138 150 118 168 100 168 C82 168 62 150 60 120 C58 96 76 86 84 66 C90 88 96 94 100 94 C104 78 96 58 100 36 Z" fill=${cor}/>
    <path d="M100 104 C110 118 118 128 116 142 C114 154 108 160 100 160 C92 160 86 154 84 142 C83 130 94 122 100 104 Z" fill=${fundo}/>`;
  return html`<svg viewBox="0 0 200 200" width=${tam} height=${tam} aria-hidden="true">${moldura}${d}</svg>`;
}

// ============================================================
// CÁLCULOS AUXILIARES
// ============================================================
// semana a semana do período: treinos, volume, sono, energia e recordes
export function semanal(r, checkins) {
  const linhas = r.semanasGrade.map((s) => {
    const seg = segundaDe(new Date(s.inicio + 'T12:00:00'));
    const ate = somaDias(seg, 6) < r.fim ? somaDias(seg, 6) : r.fim;
    const idsSem = new Set(r.feitas.filter((x) => x.data >= s.inicio && x.data <= ate).map((x) => x.id));
    const c = checkins.find((k) => k.semana === seg);
    return { inicio: s.inicio, fim: ate, seg, feitos: s.feitos, meta: s.meta, vol: tonelagem(r.seriesPeriodo.filter((x) => idsSem.has(x.sessao_id))) / 1000,
      sono: c && c.sono != null ? c.sono : null, energia: c && c.energia != null ? c.energia : null, pr: r.recordes.filter((x) => x.data >= s.inicio && x.data <= ate) };
  });
  const maxVol = Math.max(0, ...linhas.map((l) => l.vol));
  linhas.forEach((l) => { l.top = maxVol > 0 && l.vol === maxVol && linhas.length > 1; });
  return linhas;
}

// séries por semana em cada músculo (principal 1, auxiliar 0,5), na média do período
export function volumeMuscular(r, exercicios) {
  const v = {};
  r.seriesPeriodo.forEach((s) => {
    const { primarios, secundarios } = musculosDe(exercicios.find((e) => e.id === s.exercicio_id));
    primarios.forEach((m) => { v[m] = (v[m] || 0) + 1; });
    secundarios.forEach((m) => { if (!primarios.includes(m)) v[m] = (v[m] || 0) + 0.5; });
  });
  Object.keys(v).forEach((k) => { v[k] /= r.semanas; });
  return v;
}

// o peso levantado, traduzido em coisas do mundo
const REFERENCIAS = [[1.2, 'carro popular', 'carros populares', 'Um carro popular pesa cerca de 1,2 tonelada.'], [6, 'elefante', 'elefantes', 'Um elefante-africano adulto pesa cerca de 6 toneladas.'],
  [30, 'baleia-jubarte', 'baleias-jubarte', 'Uma baleia-jubarte adulta pesa cerca de 30 toneladas.']];
export function traduzirPeso(t) {
  const ref = [...REFERENCIAS].reverse().find(([p]) => t / p >= 3) || REFERENCIAS[0];
  const n = t / ref[0];
  return { curto: `${num(n, n < 10 ? 1 : 0)} ${n < 2 ? ref[1] : ref[2]}`, nota: ref[3] };
}
export function traduzirAcumulado(t) {
  const c = t / 635; // Cristo Redentor: 635 toneladas
  if (c >= 1) return { curto: `${num(c, 1)} Cristo${c >= 2 ? 's' : ''} Redentor${c >= 2 ? 'es' : ''}`, nota: 'O Cristo Redentor pesa 635 toneladas.' };
  if (c >= 0.05) return { curto: `${num(c * 100, 0)}% do Cristo`, nota: `É ${num(c * 100, 0)}% do peso do Cristo Redentor (635 toneladas).` };
  return traduzirPeso(t);
}

// valor atual de uma meta
function valorAtualMeta(m, r, d) {
  if (m.tipo === 'carga') { const l = r.validas.filter((s) => s.exercicio_id === m.exercicio_id && s.carga != null && r.dataSessao[s.sessao_id] <= r.fim); return l.length ? Math.max(...l.map((s) => Number(s.carga))) : null; }
  if (m.tipo === 'peso') return r.pesoAtual ? r.pesoAtual.peso : null;
  if (m.tipo === 'gordura') return r.avAtual && r.avAtual.percentual_gordura != null ? Number(r.avAtual.percentual_gordura) : null;
  if (m.tipo === 'medida') { const k = semAcento(m.medida).trim(); const v = r.avAtual && (r.avAtual.medidas || {})[k]; return v != null && v !== '' ? Number(v) : null; }
  if (m.tipo === 'vo2') { const t = (d.testes || []).filter((x) => x.vo2max != null && x.data <= r.fim).sort((a, b) => (a.data < b.data ? 1 : -1))[0]; return t ? Number(t.vo2max) : null; }
  return null;
}
const UNIDADE_META = { carga: 'kg', peso: 'kg', gordura: '%', medida: 'cm', vo2: 'ml/kg/min', livre: '' };
export function metasDoPeriodo(r, d) {
  return (d.metas || []).filter((m) => m.status === 'ativa' || (m.status === 'batida' && m.concluida_em && m.concluida_em >= r.ini && m.concluida_em <= r.fim))
    .slice(0, 4).map((m) => {
      const atual = valorAtualMeta(m, r, d);
      const ini = m.valor_inicial != null ? Number(m.valor_inicial) : null, alvo = m.valor_alvo != null ? Number(m.valor_alvo) : null;
      let p = m.status === 'batida' ? 1 : ini != null && alvo != null && atual != null && alvo !== ini ? Math.max(0, Math.min(1, (atual - ini) / (alvo - ini))) : null;
      let status = 'em andamento';
      if (m.status === 'batida') status = 'batida';
      else if (m.prazo && m.prazo < r.fim) status = 'prazo vencido';
      else if (p != null && m.prazo) {
        const criada = String(m.created_at || r.ini).slice(0, 10);
        const esperado = Math.max(0, Math.min(1, diasEntre(criada, r.fim) / Math.max(1, diasEntre(criada, m.prazo))));
        status = p >= esperado + 0.1 ? 'adiantada' : p < esperado - 0.2 ? 'atenção' : 'no ritmo';
      }
      if (p === 1 && m.status !== 'batida') status = 'alvo alcançado';
      const nomeEx = m.exercicio_id ? (d.exercicios.find((e) => e.id === m.exercicio_id) || {}).nome : '';
      return { m, titulo: m.titulo || [maiuscula(m.tipo), nomeEx, m.medida].filter(Boolean).join(' · '), atual, ini, alvo, p, status, un: UNIDADE_META[m.tipo] || '' };
    });
}

// ============================================================
// CONQUISTAS (calculadas do histórico inteiro, nada é guardado)
// ============================================================
export function conquistas(r, meses, avaliacoes) {
  const l = [];
  const add = (id, marca, titulo, sub, data, falta) => l.push({ id, marca, titulo, sub, data: data && data <= r.fim ? data : null, falta });
  const sessoes = r.todasFeitas.filter((s) => s.data <= r.fim);
  add('primeiro-treino', 'I', 'Primeiro treino', 'o começo de tudo', sessoes[0] && sessoes[0].data);
  [10, 25, 50, 100, 150, 200, 300].forEach((n) => add('treinos-' + n, String(n), `${n} treinos`, 'treinos concluídos', sessoes[n - 1] && sessoes[n - 1].data, `faltam ${n - sessoes.length}`));
  // toneladas acumuladas
  const porData = {};
  r.validas.forEach((s) => { const dt = r.dataSessao[s.sessao_id]; if (dt && dt <= r.fim && s.carga != null && s.reps != null) porData[dt] = (porData[dt] || 0) + s.carga * s.reps; });
  const datas = Object.keys(porData).sort();
  let acum = 0; const cruzou = {};
  datas.forEach((dt) => { acum += porData[dt] / 1000; [10, 50, 100, 250, 500, 1000].forEach((t) => { if (acum >= t && !cruzou[t]) cruzou[t] = dt; }); });
  [10, 50, 100, 250, 500, 1000].forEach((t) => add('ton-' + t, `${t}t`, `Clube ${t} t`, 'toneladas acumuladas', cruzou[t], `faltam ${num(Math.max(0, t - acum), 0)} t`));
  const prs = r.recordesTodos.filter((x) => x.data <= r.fim);
  add('primeiro-recorde', '★', 'Primeiro recorde', prs[0] ? prs[0].nome : 'de carga', prs[0] && prs[0].data);
  [10, 25, 50].forEach((n) => add('recordes-' + n, `${n}★`, `${n} recordes`, 'recordes pessoais', prs[n - 1] && prs[n - 1].data, `faltam ${n - prs.length}`));
  const av = [...avaliacoes].filter((a) => a.data <= r.fim).sort((a, b) => (a.data < b.data ? -1 : 1));
  add('primeira-avaliacao', 'Av', 'Primeira avaliação', 'o ponto de partida', av[0] && av[0].data);
  // meses completos
  const fechados = meses.filter((m) => m.fim <= r.ate); // mês em andamento não conta
  const perfeito = fechados.find((m) => m.r.aderencia >= 1 && m.r.feitas.length >= 4);
  add('mes-perfeito', '100%', 'Mês perfeito', 'nenhuma falta no mês', perfeito && perfeito.fim, 'nenhuma falta num mês');
  const oraculo = fechados.find((m) => m.r.checkinsFeitos >= 4 && m.r.checkinsFeitos >= m.r.semanasGrade.length - 1);
  add('oraculo', '✓', 'Oráculo em dia', 'todos os check-ins do mês', oraculo && oraculo.fim, 'todos os check-ins de um mês');
  const nike = meses.map((m) => ({ m, prs: prs.filter((x) => x.data >= m.ini && x.data <= m.fim) })).find((x) => x.prs.length >= 5);
  add('mes-nike', 'Nike', 'Mês de Nike', '5 recordes no mesmo mês', nike && nike.prs[4].data, '5 recordes no mesmo mês');
  // semanas seguidas batendo a meta
  const porSemana = {};
  sessoes.forEach((s) => { const k = segundaDe(new Date(s.data + 'T12:00:00')); porSemana[k] = (porSemana[k] || 0) + 1; });
  if (sessoes.length) {
    let seq = 0; const bateu = {};
    for (let s = segundaDe(new Date(sessoes[0].data + 'T12:00:00')); s <= r.fim; s = somaDias(s, 7)) {
      if (somaDias(s, 6) > r.ate) break; // semana ainda aberta não conta
      seq = (porSemana[s] || 0) >= r.alvo ? seq + 1 : 0;
      [4, 8, 12].forEach((n) => { if (seq >= n && !bateu[n]) bateu[n] = somaDias(s, 6); });
    }
    [4, 8, 12].forEach((n) => add('seq-' + n, `${n}×`, `${n} semanas sem furar`, 'meta semanal batida', bateu[n], `${n} semanas seguidas na meta`));
  }
  return l;
}

// ============================================================
// MOMENTOS DO PERÍODO (linha do tempo da visão macro)
// ============================================================
function momentos(r, extras, desbloqueadas, tipo) {
  const l = [];
  // marcos de carga (passou dos 30, 40, 50 kg...): só a partir de 10 kg, no máximo os 3 mais pesados
  r.recordes.filter((x) => x.carga >= 10 && x.antes && x.antes.carga != null)
    .filter((x) => { const passo = x.carga >= 20 ? 10 : 5; return Math.floor(x.carga / passo) > Math.floor(x.antes.carga / passo); })
    .sort((a, b) => b.carga - a.carga).slice(0, 3)
    .forEach((x) => { const passo = x.carga >= 20 ? 10 : 5; l.push({ data: x.data, cls: 'ouro', t: `${x.nome} passou dos ${num(Math.floor(x.carga / passo) * passo, 0)} kg pela primeira vez.`, peso: 3, id: x.id }); });
  const primeiro = [...r.recordes].sort((a, b) => (a.data < b.data ? -1 : 1))[0];
  if (primeiro && !l.some((m) => m.id === primeiro.id)) l.push({ data: primeiro.data, t: `Primeiro recorde do ${tipo}: ${primeiro.nome}, ${serieTxt(primeiro)}.`, peso: 2 });
  r.semanasGrade.filter((s) => s.feitos < s.meta && somaDias(segundaDe(new Date(s.inicio + 'T12:00:00')), 6) <= r.ate)
    .forEach((s) => l.push({ data: s.inicio, cls: 'alerta', t: `Semana de ${dataCurta(s.inicio)}: ${s.feitos} de ${s.meta} ${s.meta === 1 ? 'treino' : 'treinos'}.`, peso: 2 }));
  extras.slice(0, 2).forEach((s) => l.push({ data: s.data, t: `Treino extra (${letraTreino(s.treino_nome)}) por conta própria.`, peso: 1 }));
  if (r.avAtual && r.avAtual.data >= r.ini && r.avAtual.data <= r.fim) {
    const partes = [];
    if (r.avAnterior) {
      const ci = (r.avAtual.medidas || {}).cintura, ca = (r.avAnterior.medidas || {}).cintura;
      if (ci != null && ca != null && ci !== '' && ca !== '' && Number(ci) !== Number(ca)) partes.push(`cintura ${Number(ci) < Number(ca) ? '−' : '+'}${num(Math.abs(ci - ca), 1)} cm`);
      const gi = r.avAtual.percentual_gordura, ga = r.avAnterior.percentual_gordura;
      if (gi != null && ga != null && Number(gi) !== Number(ga)) partes.push(`gordura ${Number(gi) < Number(ga) ? '−' : '+'}${num(Math.abs(gi - ga), 1)} p.p.`);
    }
    l.push({ data: r.avAtual.data, cls: 'ouro', t: `Avaliação física${partes.length ? ': ' + partes.join(', ') : ''}.`, peso: 3 });
  }
  desbloqueadas.forEach((c) => l.push({ data: c.data, cls: 'ouro', t: `Conquista desbloqueada: ${c.titulo}.`, peso: 1 }));
  // os 7 mais importantes, em ordem de data
  return l.map((m, i) => ({ ...m, i })).sort((a, b) => b.peso - a.peso || a.i - b.i).slice(0, 7).sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

// ============================================================
// FOLHAS
// ============================================================
export function Capa({ r, aluna, coachNome, periodo, deusa }) {
  return html`<section class="folha rf-capa">
    <div class="rf-marca"><span class="rf-logo">NEMESIS</span>${coachNome && html`<small>${coachNome}</small>`}</div>
    <div class="rf-capa-meio">
      <p class="rf-sobre">${periodo}</p>
      <h1>Relatório de <em>Evolução</em></h1>
      <p class="rf-aluna">${aluna.nome}</p>
    </div>
    <div class="rx-deusa">
      <${Emblema} id=${deusa.id} tam=${210}/>
      <p class="rf-sobre">Sua deusa do período</p>
      <h3>${deusa.nome}</h3>
      <p><b>${maiuscula(deusa.lema)}.</b> ${deusa.motivo}</p>
    </div>
    <div class="rf-capa-pe">
      <${Dado} rot="Período" val=${`${dataCurta(r.ini)} a ${dataCurta(r.fim)}`} sub=${r.fim.slice(0, 4)}/>
      <${Dado} rot="Treinos" val=${r.feitas.length} sub=${`${num(r.aderencia * 100, 0)}% de aderência`}/>
      ${coachNome && html`<${Dado} rot="Profissional" val=${coachNome}/>`}
    </div>
  </section>`;
}

function Calendario({ r, d, extrasIds }) {
  const inicio = segundaDe(new Date(r.ini + 'T12:00:00'));
  const semanas = [];
  for (let s = inicio; s <= r.fim; s = somaDias(s, 7)) semanas.push(s);
  const compacto = semanas.length > 6;
  const porDia = {}; r.feitas.forEach((s) => { (porDia[s.data] = porDia[s.data] || []).push(s); });
  const prDia = new Set(r.recordes.map((x) => x.data));
  const chkDia = new Set(d.checkins.map((c) => c.created_at && iso(new Date(c.created_at))).filter(Boolean));
  const avDia = new Set(d.avaliacoes.map((a) => a.data));
  const grade = Object.fromEntries(r.semanasGrade.map((s) => [segundaDe(new Date(s.inicio + 'T12:00:00')), s]));
  return html`<div>
    <div class=${'rx-cal' + (compacto ? ' compacto' : '')}>
      ${['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM', ''].map((t) => html`<div class="dia-s">${t}</div>`)}
      ${semanas.map((s) => html`${[...Array(7)].map((_, i) => {
        const dia = somaDias(s, i);
        if (dia < r.ini || dia > r.fim) return html`<div class="d fora"></div>`;
        const ses = porDia[dia] || [];
        const extra = ses.length && ses.every((x) => extrasIds.has(x.id));
        return html`<div class=${'d' + (ses.length ? ' t' : '') + (extra ? ' extra' : '') + (dia > r.ate ? ' futuro' : '') + (avDia.has(dia) ? ' aval' : '')} title=${`${dataBR(dia)}${ses.length ? ': ' + ses.map((x) => x.treino_nome).join(', ') : ''}`}>
          <span>${Number(dia.slice(8))}</span>
          ${ses.length > 0 && !compacto && html`<span class="l">${ses.map((x) => letraTreino(x.treino_nome)).join('+')}</span>`}
          ${prDia.has(dia) && html`<span class="pr">★</span>`}${chkDia.has(dia) && html`<span class="ck"></span>`}</div>`; })}
        ${grade[s] ? html`<div class=${'sem' + (grade[s].feitos < grade[s].meta && somaDias(s, 6) <= r.ate ? ' abaixo' : '')}>${grade[s].feitos}/${grade[s].meta}</div>` : html`<div class="sem"></div>`}`)}
    </div>
    <div class="rx-leg"><span><i class="lt"></i>Treino</span><span><i class="le"></i>Extra</span><span class="lpr">★ Recorde</span><span><i class="lc"></i>Check-in</span><span><i class="la"></i>Avaliação</span><span>n/n treinos na semana</span></div>
  </div>`;
}

export function Macro({ r, ant, d, aluna, n, tipo, rotulo, objetivo, desbloqueadas, obrigIds }) {
  const dir = direcoes(objetivo);
  const extras = r.feitas.filter((s) => !obrigIds.has(s.treino_id));
  const extrasIds = new Set(extras.map((s) => s.id));
  const sono = r.bemEstar.find((b) => b.k === 'sono'), sonoAnt = ant.bemEstar.find((b) => b.k === 'sono');
  const vs = rotulo.anterior;
  const kpis = [
    ['Treinos', num(r.feitas.length, 0), variacao(ant.feitas.length, r.feitas.length, { casas: 0, dir: 'mais' }), true],
    ['Aderência', `${num(r.aderencia * 100, 0)}%`, variacao(ant.aderencia, r.aderencia, { modo: 'pp', dir: 'mais' }), true],
    ['Recordes', num(r.recordes.length, 0), variacao(ant.recordes.length, r.recordes.length, { casas: 0, dir: 'mais' }), true],
    ['Volume', `${num(r.volume / 1000, 1)} t`, ant.volume > 0 ? variacao(ant.volume, r.volume, { modo: 'pct', dir: 'mais' }) : null],
    ['Peso', r.pesoAtual ? `${num(r.pesoAtual.peso, 1)} kg` : '·', r.pesoAtual && ant.pesoAtual && r.pesoAtual.data !== ant.pesoAtual.data ? variacao(ant.pesoAtual.peso, r.pesoAtual.peso, { un: ' kg', dir: dir.peso }) : null],
    ['Sono (check-in)', sono ? `${num(sono.v, 1)} de 5` : '·', sono && sonoAnt ? variacao(sonoAnt.v, sono.v, { dir: 'mais' }) : null],
  ];
  const sem = semanal(r, d.checkins);
  const mom = momentos(r, extras, desbloqueadas, tipo.toLowerCase());
  const f1 = (v) => (v == null ? '·' : num(v, 1));
  return html`<section class="folha">
    <${Cab} sobre="Visão macro" titulo=${`O ${tipo === 'Mês' ? 'mês' : tipo === 'Ciclo' ? 'ciclo' : 'período'} em uma página`}/>
    <div class="rx-kpis">${kpis.map(([rot, val, v, esc]) => html`<div class=${esc ? 'esc' : ''}><span class="rf-rot">${rot}</span><b>${val}</b>${v ? html`<${Seta} v=${v} sufixo=${v.txt === 'igual' ? ` a ${vs}` : ` vs ${vs}`}/>` : html`<span class="rx-seta rx-neutro">sem comparação</span>`}</div>`)}</div>
    <div class=${'rx-macro' + (mom.length ? '' : ' so')}>
      <div><p class="rf-sobre rx-mb">${rotulo.diaADia}</p><${Calendario} r=${r} d=${d} extrasIds=${extrasIds}/></div>
      ${mom.length > 0 && html`<div><p class="rf-sobre rx-mb">Momentos do ${tipo.toLowerCase()}</p>
        <ul class="rx-mom">${mom.map((m) => html`<li class=${m.cls || ''}><b>${dataCurta(m.data)}</b>${m.t}</li>`)}</ul></div>`}
    </div>
    ${sem.length > 1 && sem.length <= 6 && html`<p class="rf-sobre">Semana a semana</p>
      <div class="rx-semanas" style=${`grid-template-columns:repeat(${sem.length},1fr)`}>${sem.map((s) => html`<div class=${s.top ? 'top' : ''}>
        <span class="rf-rot">${dataCurta(s.inicio)} a ${dataCurta(s.fim)}</span>
        <span class="rx-pontos">${[...Array(Math.max(s.meta, s.feitos))].map((_, i) => html`<i class=${i < s.feitos ? (i < s.meta ? '' : 'x') : 'f'}></i>`)}</span>
        <b>${num(s.vol, 1)} t</b>
        <div class="rx-mini"><i style=${`width:${Math.max(2, (s.vol / Math.max(0.01, ...sem.map((x) => x.vol))) * 100)}%`}></i></div>
        <small>${s.sono == null && s.energia == null ? 'Sem check-in' : `Sono ${f1(s.sono)} · Energia ${f1(s.energia)}`}</small>
        <small>${s.pr.length ? `${'★'.repeat(Math.min(3, s.pr.length))} ${s.pr.length === 1 ? 'Recorde: ' + s.pr[0].nome : s.pr.length + ' recordes'}` : s.top ? 'Maior volume do período' : s.feitos < s.meta && s.fim <= r.ate ? 'Abaixo da meta' : ''}</small>
      </div>`)}</div>`}
    <${Rodape} aluna=${aluna} n=${n}/>
  </section>`;
}

// comparativo: linhas [grupo] ou [rótulo, antes, agora, variação]
export function comparar(r, ant, objetivo) {
  const dir = direcoes(objetivo);
  const L = [];
  const lin = (rot, a, b, fmt, opts) => { if (a == null || b == null) return; const v = variacao(a, b, opts); if (v) L.push({ rot, a: fmt(a), b: fmt(b), v, dir: opts.dir }); };
  const kg = (x) => `${num(x, 1)} kg`, t = (x) => `${num(x / 1000, 1)} t`, int = (x) => num(x, 0), p = (x) => `${num(x * 100, 0)}%`;
  L.push({ grupo: 'Treino' });
  lin('Treinos realizados', ant.feitas.length, r.feitas.length, int, { casas: 0, dir: 'mais' });
  lin('Aderência', ant.aderencia, r.aderencia, p, { modo: 'pp', dir: 'mais' });
  if (ant.volume > 0) lin('Volume total', ant.volume, r.volume, t, { modo: 'pct', dir: 'mais' });
  lin('Recordes pessoais', ant.recordes.length, r.recordes.length, int, { casas: 0, dir: 'mais' });
  if (ant.seriesEfetivas > 0) lin('Séries válidas', ant.seriesEfetivas, r.seriesEfetivas, int, { modo: 'pct', dir: 'mais' });
  lin('Esforço médio (RPE)', ant.esforcoMedio, r.esforcoMedio, (x) => num(x, 1), {});
  lin('Duração média', ant.duracaoMedia, r.duracaoMedia, (x) => `${num(x, 0)} min`, { casas: 0, un: ' min' });
  const n0 = L.length;
  L.push({ grupo: 'Corpo' });
  if (r.pesoAtual && ant.pesoAtual && r.pesoAtual.data !== ant.pesoAtual.data) lin('Peso', ant.pesoAtual.peso, r.pesoAtual.peso, kg, { un: ' kg', dir: dir.peso });
  if (r.avAtual && ant.avAtual && r.avAtual.id !== ant.avAtual.id) {
    const m = (a, k) => { const v = (a.medidas || {})[k]; return v == null || v === '' ? null : Number(v); };
    lin('% de gordura', ant.avAtual.percentual_gordura != null ? Number(ant.avAtual.percentual_gordura) : null, r.avAtual.percentual_gordura != null ? Number(r.avAtual.percentual_gordura) : null, (x) => `${num(x, 1)}%`, { un: ' p.p.', dir: 'menos' });
    [['cintura', 'Cintura', 'menos'], ['abdomen', 'Abdômen', 'menos'], ['quadril', 'Quadril', dir.quadril], ['coxa', 'Coxa', dir.quadril], ['braco', 'Braço', null]]
      .forEach(([k, rot, dd]) => lin(rot, m(ant.avAtual, k), m(r.avAtual, k), (x) => `${num(x, 1)} cm`, { un: ' cm', dir: dd }));
  }
  if (L.length === n0 + 1) L.pop();
  const n1 = L.length;
  L.push({ grupo: 'Bem-estar (check-ins, de 1 a 5)' });
  [['sono', 'mais'], ['energia', 'mais'], ['dieta', 'mais'], ['estresse', 'menos'], ['fome', null], ['dor', 'menos']].forEach(([k, dd]) => {
    const a = ant.bemEstar.find((b) => b.k === k), b = r.bemEstar.find((x) => x.k === k);
    if (a && b) lin(b.r, a.v, b.v, (x) => num(x, 1), { dir: dd });
  });
  if (ant.checkinsFeitos || r.checkinsFeitos) lin('Check-ins enviados', ant.checkinsFeitos, r.checkinsFeitos, int, { casas: 0, dir: 'mais' });
  if (L.length === n1 + 1) L.pop();
  return L;
}

export function Comparativo({ r, ant, aluna, n, rotulo, objetivo }) {
  const L = comparar(r, ant, objetivo);
  const comDir = L.filter((l) => l.v && l.dir);
  const melhores = comDir.filter((l) => l.v.bom);
  const piores = comDir.filter((l) => l.v.bom === false);
  const leitura = [melhores.length ? `Subiram na direção certa: ${melhores.slice(0, 3).map((l) => l.rot.toLowerCase()).join(', ')}.` : '',
    piores.length ? `Pedem atenção: ${piores.slice(0, 2).map((l) => l.rot.toLowerCase()).join(' e ')}.` : 'Nenhum indicador andou para trás.'].filter(Boolean).join(' ');
  return html`<section class="folha">
    <${Cab} sobre="Comparativo" titulo=${rotulo.comparativo}/>
    <p class="rx-sub">Cada número deste período ao lado do anterior (${dataCurta(ant.ini)} a ${dataCurta(ant.fim)}). A seta roxa mostra o que mudou na direção do seu objetivo${objetivo ? ` (${objetivo.toLowerCase()})` : ''}; a cinza só informa.</p>
    ${comDir.length > 0 && html`<div class="rx-placar"><b class="n">${melhores.length}<small> de ${comDir.length}</small></b>
      <p><b>indicadores melhoraram em relação ao período anterior.</b> ${leitura}</p></div>`}
    ${L.length > 0 ? html`<table class="rf-tabela rx-comp">
      <thead><tr><th>Indicador</th><th>Antes</th><th>Agora</th><th>Variação</th></tr></thead>
      <tbody>${L.map((l) => (l.grupo ? html`<tr class="grupo"><td colspan="4">${l.grupo}</td></tr>`
        : html`<tr><td>${l.rot}</td><td>${l.a}</td><td>${l.b}</td><td><${Seta} v=${l.v}/></td></tr>`))}</tbody></table>`
    : html`<p class="rf-leve">Ainda não há um período anterior com dados para comparar.</p>`}
    <${Rodape} aluna=${aluna} n=${n}/>
  </section>`;
}

const INFERIORES = ['quadriceps', 'adutores', 'gluteo_maximo', 'gluteo_medio', 'biceps_femoral', 'semitendineo', 'panturrilha'];
const PRINCIPAIS = ['gluteo_maximo', 'gluteo_medio', 'quadriceps', 'biceps_femoral', 'latissimo', 'peitoral_maior', 'deltoide_lateral', 'deltoide_posterior', 'panturrilha', 'reto_abdominal'];
export function MapaDoCorpo({ r, d, aluna, n, objetivo }) {
  const v = volumeMuscular(r, d.exercicios);
  const lista = Object.keys(MUSCULOS).map((k) => ({ k, nome: MUSCULOS[k].nome, v: v[k] || 0 })).sort((a, b) => b.v - a.v);
  const max = Math.max(1, lista[0] ? lista[0].v : 1);
  const total = lista.reduce((t, x) => t + x.v, 0);
  const inf = lista.filter((x) => INFERIORES.includes(x.k)).reduce((t, x) => t + x.v, 0);
  const semSeries = PRINCIPAIS.filter((k) => !v[k]).map((k) => MUSCULOS[k].nome.toLowerCase());
  const [a, b] = lista;
  const gluteoNoTopo = /gluteo|bumbum/.test(semAcento(objetivo)) && [a, b].some((x) => x && /gluteo/.test(x.k));
  const mostrar = lista.filter((x) => x.v > 0).slice(0, 12);
  return html`<section class="folha">
    <${Cab} sobre="Onde foi o seu treino" titulo="Mapa do Corpo"/>
    <p class="rx-sub">Séries por semana em cada músculo, na média do período. O músculo principal do exercício conta 1 série; o auxiliar, meia. Quanto mais roxo, mais estímulo.</p>
    <div class="rx-corpo">
      <figure><${MapaCorpo} valores=${v} vista="frente" largura=${150}/><figcaption>Frente</figcaption></figure>
      <figure><${MapaCorpo} valores=${v} vista="costas" largura=${150}/><figcaption>Costas</figcaption></figure>
      <div class="rx-musc">
        <div class="rx-escala"><span>pouco</span><i></i><span>muito</span></div>
        ${mostrar.map((x, i) => html`<div class="rf-barra-linha"><span class="rf-barra-nome">${x.nome}<span class="rx-nivel">${nivelVolume(x.v)[1]}</span></span>
          <span class="rf-barra-trilho fundo"><i class=${i < 2 ? 'on' : ''} style=${`width:${Math.max(2, (x.v / max) * 100)}%`}></i></span><b>${num(x.v, 1)}</b></div>`)}
      </div>
    </div>
    ${total > 0 && html`<div class="rx-insights">
      <div><b class="n">${num(a.v + (b ? b.v : 0), 0)}</b>séries por semana em ${a.nome.toLowerCase()}${b && b.v ? ` e ${b.nome.toLowerCase()}` : ''}: os mais treinados do período${gluteoNoTopo ? ', exatamente onde está o seu objetivo' : ''}.</div>
      <div><b class="n">${num((inf / total) * 100, 0)}%</b>do estímulo foi para pernas e glúteos; ${num(((total - inf) / total) * 100, 0)}% para tronco, braços e core.</div>
      <div><b class="n">${semSeries.length || '✓'}</b>${semSeries.length ? `${semSeries.length === 1 ? 'músculo importante ficou' : 'músculos importantes ficaram'} sem séries: ${semSeries.slice(0, 3).join(', ')}.` : 'Todos os músculos importantes receberam estímulo no período.'}</div>
    </div>`}
    <${Rodape} aluna=${aluna} n=${n}/>
  </section>`;
}

// gráfico semana a semana: barras de volume em cima, linha de sono embaixo (mesmo eixo de semanas)
function GrafBemEstar({ sem }) {
  const W = 700, x0 = 44, larg = (W - x0 - 10) / sem.length;
  const cx = (i) => x0 + larg * i + larg / 2;
  const maxV = Math.max(1, ...sem.map((s) => s.vol));
  const topoV = Math.ceil(maxV / 5) * 5;
  const yv = (v) => 150 - (v / topoV) * 118;
  const ys = (v) => 300 - ((v - 1) / 4) * 104;
  const barra = Math.min(56, larg * 0.62);
  const passo = sem.length > 10 ? 2 : 1;
  const comSono = sem.map((s, i) => ({ s, i })).filter((x) => x.s.sono != null);
  return html`<svg class="rx-graf" viewBox="0 0 ${W} 322" role="img" aria-label="Volume por semana e nota de sono do check-in">
    <text x="0" y="16" class="rx-g-rot">VOLUME (t)</text>
    ${[0, topoV / 2, topoV].map((v) => html`<line x1=${x0} x2=${W - 10} y1=${yv(v)} y2=${yv(v)} class="rx-g-grade"/><text x=${x0 - 8} y=${yv(v) + 4} class="rx-g-eixo" text-anchor="end">${num(v, 0)}</text>`)}
    ${sem.map((s, i) => html`<g>
      <rect x=${cx(i) - barra / 2} y=${yv(s.vol)} width=${barra} height=${Math.max(0, 150 - yv(s.vol))} rx="3" class=${s.sono != null && s.sono >= 4 ? 'rx-g-barra on' : 'rx-g-barra'}><title>${dataCurta(s.inicio)}: ${num(s.vol, 1)} t</title></rect>
      ${sem.length <= 10 && html`<text x=${cx(i)} y=${yv(s.vol) - 6} class="rx-g-val" text-anchor="middle">${num(s.vol, 1)}</text>`}
      ${i % passo === 0 && html`<text x=${cx(i)} y="168" class="rx-g-eixo" text-anchor="middle">${dataCurta(s.inicio)}</text>`}
      ${s.pr.length > 0 && html`<text x=${cx(i)} y="184" class="rx-g-pr" text-anchor="middle">${'★'.repeat(Math.min(3, s.pr.length))}</text>`}</g>`)}
    <text x="0" y="206" class="rx-g-rot">SONO NO CHECK-IN (1 a 5)</text>
    <line x1=${x0} x2=${W - 10} y1=${ys(4)} y2=${ys(4)} class="rx-g-meta"/>
    <text x=${x0 + 4} y=${ys(4) - 6} class="rx-g-meta-t">nota 4 = dormiu bem</text>
    ${[1, 3, 5].map((v) => html`<text x=${x0 - 8} y=${ys(v) + 4} class="rx-g-eixo" text-anchor="end">${v}</text>`)}
    <line x1=${x0} x2=${W - 10} y1=${ys(1)} y2=${ys(1)} class="rx-g-grade"/>
    ${comSono.length > 1 && html`<polyline points=${comSono.map(({ s, i }) => `${cx(i)},${ys(s.sono)}`).join(' ')} class="rx-g-linha"/>`}
    ${comSono.map(({ s, i }) => html`<g><circle cx=${cx(i)} cy=${ys(s.sono)} r="5" class=${s.sono >= 4 ? 'rx-g-ponto on' : 'rx-g-ponto'}/>
      <text x=${cx(i)} y=${ys(s.sono) - 10} class="rx-g-val" text-anchor="middle">${num(s.sono, 1)}</text></g>`)}
  </svg>`;
}

const LADO = { E: 'lado esquerdo', D: 'lado direito', centro: '' };
function doresDoPeriodo(r, dores, sem) {
  const desde = somaDias(r.ini, -28);
  const rel = (dores || []).map((x) => ({ ...x, dia: iso(new Date(x.created_at)) })).filter((x) => x.dia >= desde && x.dia <= r.fim);
  const grupos = {};
  rel.forEach((x) => { const k = x.regiao + '|' + (x.lado || ''); (grupos[k] = grupos[k] || []).push(x); });
  return Object.entries(grupos).map(([k, l]) => {
    l.sort((a, b) => (a.dia < b.dia ? -1 : 1));
    const [regiao, lado] = k.split('|');
    const antes = l.filter((x) => x.dia < r.ini);
    const barras = [{ rot: 'antes', v: antes.length ? Math.max(...antes.map((x) => x.intensidade)) : null },
      ...sem.map((s) => { const w = l.filter((x) => x.dia >= s.inicio && x.dia <= s.fim); return { rot: dataCurta(s.inicio), v: w.length ? Math.max(...w.map((x) => x.intensidade)) : null }; })];
    const ult = l[l.length - 1];
    const prim = l[0];
    const nota = ult.intensidade <= 1 ? `Último relato em ${dataCurta(ult.dia)}: ${ult.intensidade} de 10.` : prim !== ult && ult.intensidade < prim.intensidade
      ? `Caiu de ${prim.intensidade} para ${ult.intensidade} de 10 desde ${dataCurta(prim.dia)}.` : `Último relato em ${dataCurta(ult.dia)}: ${ult.intensidade} de 10. Estamos de olho.`;
    return { nome: [maiuscula(String(regiao).replace(/_/g, ' ')), LADO[lado] || ''].filter(Boolean).join(', '), barras, nota, ult: ult.dia };
  }).sort((a, b) => (a.ult < b.ult ? 1 : -1)).slice(0, 2);
}

export function BemEstar({ r, ant, d, aluna, n }) {
  const sem = semanal(r, d.checkins);
  const bons = sem.filter((s) => s.sono != null && s.sono >= 4), ruins = sem.filter((s) => s.sono != null && s.sono < 4);
  const insights = [];
  const prBons = bons.reduce((t, s) => t + s.pr.length, 0), prTot = sem.reduce((t, s) => t + s.pr.length, 0);
  if (bons.length && ruins.length && prTot) insights.push([`${prBons} de ${prTot}`, `recordes vieram de semanas em que você dormiu bem (nota 4 ou mais).`]);
  else if (bons.length && ruins.length) {
    const med = (l) => l.reduce((t, s) => t + s.vol, 0) / l.length;
    const dv = med(ruins) > 0 ? med(bons) / med(ruins) - 1 : 0;
    if (Math.abs(dv) >= 0.05) insights.push([pctTxt(dv), `de volume nas semanas bem dormidas, comparadas às outras.`]);
  }
  const comSono = sem.filter((s) => s.sono != null);
  if (comSono.length > 1) {
    const pior = comSono.reduce((m, s) => (s.sono < m.sono ? s : m), comSono[0]);
    const faltou = pior.feitos < pior.meta && pior.fim <= r.ate;
    insights.push([num(pior.sono, 1), `foi o pior sono do período, na semana de ${dataCurta(pior.inicio)}.${faltou ? ' Foi também uma semana abaixo da meta de treinos.' : ''}`]);
  }
  const en = r.bemEstar.find((b) => b.k === 'energia'), enA = ant.bemEstar.find((b) => b.k === 'energia');
  if (en && enA && Math.abs(en.v - enA.v) >= 0.1) insights.push([`${en.v > enA.v ? '+' : '−'}${num(Math.abs(en.v - enA.v), 1)}`, `de energia em relação ao período anterior (${num(enA.v, 1)} → ${num(en.v, 1)}).`]);
  else if (en) insights.push([num(en.v, 1), 'de energia média nos check-ins, de 1 a 5.']);
  const dores = doresDoPeriodo(r, d.dores, sem);
  const maxDor = Math.max(1, ...dores.flatMap((x) => x.barras.map((b) => b.v || 0)));
  return html`<section class="folha">
    <${Cab} sobre="O que o check-in revela" titulo="Bem-estar × Desempenho"/>
    <p class="rx-sub">O seu check-in cruzado com o treino, semana a semana. As barras roxas são as semanas em que você dormiu bem.</p>
    <${GrafBemEstar} sem=${sem}/>
    ${insights.length > 0 && html`<div class="rx-insights">${insights.slice(0, 3).map(([nn, t]) => html`<div><b class="n">${nn}</b>${t}</div>`)}</div>`}
    ${dores.length > 0 && html`<p class="rf-sobre">Dor e desconforto</p>
      <div class="rx-dor">${dores.map((x) => html`<div><b>${x.nome}</b><small>Maior intensidade relatada por semana, de 0 a 10</small>
        <div class="rx-dorbar">${x.barras.map((b) => html`<span><i class=${b.v == null ? 'vazio' : b.v <= 2 ? 'ok' : ''} style=${`height:${b.v == null ? 2 : Math.max(3, (b.v / maxDor) * 52)}px`}></i>${b.v == null ? '·' : b.v}<br/>${b.rot}</span>`)}</div>
        <small>${x.nota}</small></div>`)}</div>`}
    <${Rodape} aluna=${aluna} n=${n}/>
  </section>`;
}

export function MetasConquistas({ r, d, aluna, n, todas }) {
  const metas = metasDoPeriodo(r, d);
  const desbloq = todas.filter((c) => c.data && c.data >= r.ini).sort((a, b) => (a.data < b.data ? -1 : 1));
  const antigas = todas.filter((c) => c.data && c.data < r.ini).sort((a, b) => (a.data < b.data ? 1 : -1));
  const proximas = [];
  const vistas = new Set();
  todas.filter((c) => !c.data).forEach((c) => { const fam = c.id.replace(/-\d+$/, ''); if (!vistas.has(fam)) { vistas.add(fam); proximas.push(c); } });
  const ganhas = todas.filter((c) => c.data).length;
  const Selo = ({ c, cls, sub }) => html`<div class=${'rx-selo ' + (cls || '')}><span class="m">${c.marca}</span><b>${c.titulo}</b><small>${sub}</small></div>`;
  const colecao = [...antigas.slice(0, Math.max(0, 5 - Math.min(2, proximas.length))), ...proximas].slice(0, 5);
  return html`<section class="folha">
    <${Cab} sobre="Para onde você está indo" titulo=${metas.length ? 'Metas e Conquistas' : 'Conquistas'}/>
    ${metas.length > 0 && html`<div class="rx-metas">${metas.map((x) => html`<div class="rx-meta">
      <div><h4>${x.titulo}<span class=${'rx-status' + (['adiantada', 'batida', 'alvo alcançado'].includes(x.status) ? ' ad' : x.status === 'atenção' || x.status === 'prazo vencido' ? ' at' : '')}>${x.status}</span></h4>
        <small>${x.m.prazo ? `prazo ${dataBR(x.m.prazo)}` : 'sem prazo'}</small></div>
      <b class="pct">${x.p != null ? `${num(x.p * 100, 0)}%` : ''}</b>
      ${x.p != null ? html`<div><div class="rx-trilho"><i style=${`width:${x.p * 100}%`}></i></div>
        <div class="rx-trilho-rot"><span>início ${num(x.ini, 1)} ${x.un}</span><span><b>hoje ${num(x.atual, 1)} ${x.un}</b></span><span>alvo ${num(x.alvo, 1)} ${x.un}</span></div></div>`
      : html`<small>${x.atual != null ? `Hoje: ${num(x.atual, 1)} ${x.un}` : 'Acompanhada nas conversas com o treinador.'}</small>`}
    </div>`)}</div>`}
    <p class="rf-sobre">Conquistas desbloqueadas no período</p>
    ${desbloq.length ? html`<div class="rx-selos">${desbloq.slice(0, 5).map((c) => html`<${Selo} c=${c} sub=${dataBR(c.data)}/>`)}</div>`
      : html`<p class="rf-leve">Nenhuma conquista nova neste período. A próxima está logo abaixo.</p>`}
    <p class="rf-sobre">Sua coleção <span class="rf-leve">${ganhas} de ${todas.length} conquistas</span></p>
    <div class="rx-selos">${colecao.map((c) => (c.data ? html`<${Selo} c=${c} cls="velho" sub=${dataBR(c.data)}/>` : html`<${Selo} c=${c} cls="trancado" sub=${c.falta || 'em breve'}/>`))}</div>
    <${Rodape} aluna=${aluna} n=${n}/>
  </section>`;
}

// minigráfico de linha
function Linha({ vals, rots, fmt, escuro }) {
  const W = 300, H = 92, p = 18;
  const ok = vals.map((v, i) => ({ v, i })).filter((x) => x.v != null);
  if (ok.length < 2) return html`<p class="rf-leve">Ainda sem dados suficientes.</p>`;
  const lo = Math.min(...ok.map((x) => x.v)), hi = Math.max(...ok.map((x) => x.v));
  const x = (i) => p + (i * (W - 2 * p)) / Math.max(1, vals.length - 1);
  const y = (v) => H - 22 - ((v - lo) / (hi - lo || 1)) * (H - 46);
  const ult = ok[ok.length - 1].i;
  return html`<svg class=${'rx-graf rx-linha' + (escuro ? ' escuro' : '')} viewBox="0 0 ${W} ${H}">
    <polyline points=${ok.map((o) => `${x(o.i)},${y(o.v)}`).join(' ')}/>
    ${ok.map((o) => html`<g><circle cx=${x(o.i)} cy=${y(o.v)} r=${o.i === ult ? 5 : 3.5} class=${o.i === ult ? 'ult' : ''}/>
      <text x=${x(o.i)} y=${y(o.v) - 9} class="rx-g-val" text-anchor="middle">${fmt(o.v)}</text></g>`)}
    ${rots.map((rt, i) => html`<text x=${x(i)} y=${H - 3} class="rx-g-eixo" text-anchor="middle">${rt}</text>`)}
  </svg>`;
}

export function Jornada({ r, d, aluna, n, meses }) {
  const ult = meses.slice(-6);
  const rots = ult.map((m) => mesDe(m.ym).slice(0, 3));
  // exercício principal: o da meta de carga ativa; senão o que apareceu em mais sessões (empate: o mais pesado)
  const cont = {};
  r.validas.filter((s) => s.carga != null && r.dataSessao[s.sessao_id] <= r.fim).forEach((s) => {
    const c = (cont[s.exercicio_id] = cont[s.exercicio_id] || { ses: new Set(), max: 0 });
    c.ses.add(s.sessao_id); c.max = Math.max(c.max, Number(s.carga));
  });
  const daMeta = (d.metas || []).find((m) => m.tipo === 'carga' && m.status === 'ativa' && cont[m.exercicio_id]);
  const principal = daMeta ? [daMeta.exercicio_id] : Object.entries(cont).sort((a, b) => b[1].ses.size - a[1].ses.size || b[1].max - a[1].max)[0];
  const nomeP = principal ? (d.exercicios.find((e) => e.id === principal[0]) || {}).nome : null;
  const cargaMes = ult.map((m) => { const l = r.validas.filter((s) => principal && s.exercicio_id === principal[0] && s.carga != null && r.dataSessao[s.sessao_id] >= m.ini && r.dataSessao[s.sessao_id] <= m.fim); return l.length ? Math.max(...l.map((s) => Number(s.carga))) : null; });
  const pesoMes = ult.map((m) => (m.r.pesoAtual && m.r.pesoAtual.data >= somaDias(m.ini, -45) ? m.r.pesoAtual.peso : null));
  const adMes = ult.map((m) => (m.r.feitas.length ? m.r.aderencia * 100 : null));
  const volMes = ult.map((m) => m.r.volume / 1000);
  const delta = (vals, fmt, dir, desde) => { const ok = vals.filter((v) => v != null); if (ok.length < 2) return null; const v = variacao(ok[0], ok[ok.length - 1], { ...fmt, dir }); return v && { ...v, txt: v.txt === 'igual' ? 'igual' : `${v.txt} desde ${desde}` }; };
  const desde = mesDe(ult[0].ym);
  const acumulado = r.validas.filter((s) => r.dataSessao[s.sessao_id] <= r.fim).reduce((t, s) => t + (s.carga != null && s.reps != null ? s.carga * s.reps : 0), 0) / 1000;
  const noPeriodo = traduzirPeso(r.volume / 1000), noTotal = traduzirAcumulado(acumulado);
  const ultV = (l) => [...l].reverse().find((v) => v != null);
  return html`<section class="folha">
    <${Cab} sobre="Desde o começo" titulo="Sua Jornada"/>
    <p class="rx-sub">Cada mês ganhou uma deusa do Panteão, de acordo com o que mais se destacou nos seus números.</p>
    <div class="rx-panteao" style=${`grid-template-columns:repeat(${ult.length},1fr)`}>${ult.map((m, i) => { const g = deusaDe(m.r); return html`<div class=${i === ult.length - 1 ? 'on' : ''}>
      <span class="rf-rot">${maiuscula(mesDe(m.ym))}</span><h5>${g.nome}</h5><p>${g.eixo}: ${g.curto}</p></div>`; })}</div>
    <div class="rx-linhas">
      ${nomeP && html`<div><span class="rf-rot">${nomeP} · melhor carga</span><div class="v"><b>${num(ultV(cargaMes), 1)} kg</b><${Seta} v=${delta(cargaMes, { un: ' kg' }, 'mais', desde)}/></div>
        <${Linha} vals=${cargaMes} rots=${rots} fmt=${(v) => num(v, 1)}/></div>`}
      ${pesoMes.filter((v) => v != null).length > 1 && html`<div><span class="rf-rot">Peso corporal</span><div class="v"><b>${num(ultV(pesoMes), 1)} kg</b><${Seta} v=${delta(pesoMes, { un: ' kg' }, direcoes(aluna.objetivo || '').peso, desde)}/></div>
        <${Linha} vals=${pesoMes} rots=${rots} fmt=${(v) => num(v, 1)} escuro/></div>`}
      <div><span class="rf-rot">Aderência</span><div class="v"><b>${num(ultV(adMes), 0)}%</b><${Seta} v=${delta(adMes.map((v) => (v == null ? null : v / 100)), { modo: 'pp' }, 'mais', desde)}/></div>
        <${Linha} vals=${adMes} rots=${rots} fmt=${(v) => `${num(v, 0)}%`}/></div>
      <div><span class="rf-rot">Volume por mês</span><div class="v"><b>${num(volMes[volMes.length - 1], 1)} t</b><${Seta} v=${volMes[0] > 0 ? delta(volMes, { modo: 'pct' }, 'mais', desde) : null}/></div>
        <${Linha} vals=${volMes} rots=${rots} fmt=${(v) => num(v, 1)} escuro/></div>
    </div>
    <p class="rf-sobre">O seu peso levantado, traduzido</p>
    <div class="rx-equiv">
      <div><b class="n">${noPeriodo.curto}</b><p>${num(r.volume / 1000, 1)} toneladas neste período. ${noPeriodo.nota}</p></div>
      <div><b class="n">${noTotal.curto}</b><p>${num(acumulado, 0)} toneladas desde o primeiro treino. ${noTotal.nota}</p></div>
    </div>
    <${Rodape} aluna=${aluna} n=${n}/>
  </section>`;
}

// semanas do mesociclo que caem no próximo período
export function proximoMeso(mesociclos, fim) {
  const ini = somaDias(fim, 1), ate = somaDias(fim, 35);
  const m = mesociclos.filter((x) => x.status !== 'encerrado' && x.progressao && x.progressao.length && x.fim >= ini && x.inicio <= ate).sort((a, b) => (a.inicio < b.inicio ? -1 : 1))[0];
  if (!m) return [];
  return m.progressao.map((w, i) => ({ w, n: i + 1, de: somaDias(m.inicio, i * 7), ate: somaDias(m.inicio, i * 7 + 6) }))
    .filter((x) => x.ate >= ini && x.de <= ate).slice(0, 5)
    .map((x) => ({ ...x, rot: x.w.deload ? 'Deload' : x.w.rir != null ? `RIR ${x.w.rir}` : 'Livre',
      txt: x.w.deload ? 'Menos volume para recuperar' : x.w.rir != null && x.w.rir <= 1 ? 'Perto do limite: hora dos recordes' : 'Consolidar as cargas' }));
}

export function Missao({ aluna, n, titulo, missao, msg, coachNome, meso, datas }) {
  const focos = (missao || []).filter((f) => f && (f.titulo || f.texto));
  return html`<section class="folha">
    <${Cab} sobre="O próximo capítulo" titulo=${titulo}/>
    ${focos.length > 0 && html`<div class="rx-missoes">${focos.map((f, i) => html`<div class="rx-missao"><span class="num">${i + 1}</span>
      <div><h4>${f.titulo}</h4>${f.texto && html`<p>${f.texto}</p>`}</div><div class="alvo">${f.alvo && html`<span class="rf-rot">alvo</span><b>${f.alvo}</b>`}</div></div>`)}</div>`}
    ${meso.length > 0 && html`<p class="rf-sobre">O que muda na sua ficha</p>
      <div class="rx-meso" style=${`grid-template-columns:repeat(${meso.length},1fr)`}>${meso.map((s) => html`<div class=${s.w.deload ? 'deload' : s.w.rir != null && s.w.rir <= 1 ? 'pico' : ''}>
        <span class="rf-rot">Semana ${s.n} · ${dataCurta(s.de)}</span><b>${s.rot}</b>${s.txt}</div>`)}</div>`}
    ${datas.length > 0 && html`<div class="rx-agenda" style=${`grid-template-columns:repeat(${datas.length},1fr)`}>${datas.map(([rot, val, sub]) => html`<${Dado} rot=${rot} val=${val} sub=${sub}/>`)}</div>`}
    ${msg && html`<p class="rf-sobre">Palavra do treinador</p><div class="rx-carta">${msg}${coachNome && html`<i>${coachNome} · seu treinador</i>`}</div>`}
    <${Rodape} aluna=${aluna} n=${n}/>
  </section>`;
}

export function CardStories({ r, aluna, deusa, rotuloPeriodo, assinatura }) {
  const dias = diasEntre(r.ini, r.fim) + 1;
  const porDia = new Set(r.feitas.map((s) => s.data));
  const quadros = dias <= 45 ? [...Array(dias)].map((_, i) => porDia.has(somaDias(r.ini, i))) : r.semanasGrade.map((s) => s.feitos >= s.meta);
  const peso = traduzirPeso(r.volume / 1000);
  return html`<section class="folha rx-stories">
    <div class="st-topo"><b>NEMESIS</b><span>${rotuloPeriodo}</span></div>
    <div><h2>Meu ${r.semanas > 6 ? 'ciclo' : 'mês'} de <em>Evolução</em></h2><p class="st-nome">${aluna.nome}</p></div>
    <div class="st-nums">
      <div><b>${r.feitas.length}</b><span>${r.feitas.length === 1 ? 'treino' : 'treinos'}<br/>no período</span></div>
      <div><b>${num(r.volume / 1000, 1)}<small>t</small></b><span>levantadas<br/>(${peso.curto})</span></div>
      <div><b>${r.recordes.length}</b><span>${r.recordes.length === 1 ? 'recorde' : 'recordes'}<br/>${r.recordes.length === 1 ? 'pessoal' : 'pessoais'}</span></div>
    </div>
    <div class="st-cal" style=${`grid-template-columns:repeat(${Math.min(15, quadros.length)},1fr)`}>${quadros.map((q) => html`<i class=${q ? 't' : ''}></i>`)}</div>
    <div class="st-deusa"><${Emblema} id=${deusa.id} tam=${56} cor="#e2b4fa" fundo="#3d1257"/><div><small>Deusa do período</small><h4>${deusa.nome}</h4><small>${deusa.lema}</small></div></div>
    <div class="st-pe"><span>${assinatura || ''}</span><span>NEMESIS</span></div>
  </section>`;
}
