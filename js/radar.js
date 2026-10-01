// RADAR DA GUERREIRA · saúde da carteira.
// Engajamento (treinos das últimas 4 semanas contra a meta + check-ins), progressão de força
// (últimas 4 semanas contra as 4 anteriores) e risco de evasão, tudo calculado no aparelho.
import { html } from '../lib/preact-htm.js';
import { api } from './api.js';
import { hoje, somaDias, diasEntre, segundaDe, linkWhats, semaforo } from './util.js';

// 1RM estimado (Epley). Séries acima de 20 repetições não entram (a estimativa perde o sentido).
const e1rm = (s) => (s.carga == null || !s.reps || s.reps > 20 ? 0 : s.carga * (1 + s.reps / 30));
const ts = (dia) => new Date(dia + 'T00:00:00').toISOString();

// carrega o que o radar precisa (de uma aluna ou de todas)
export async function carregarRadar(alunaId) {
  const eq = alunaId ? { aluna_id: alunaId } : {};
  const hj = hoje();
  const pega = (t, o) => api.q(t, o).catch(() => []);
  const [sessoes, checkins, series, treinos, mesos, assinaturas, atribuicoes, envios, formularios] = await Promise.all([
    api.q('sessoes', { eq, gte: { data: somaDias(hj, -56) } }), api.q('checkins', { eq, gte: { semana: somaDias(segundaDe(), -56) } }),
    api.q('series', { eq, gte: { created_at: ts(somaDias(hj, -84)) } }),
    api.q('treinos', { eq }), pega('mesociclos', { eq: { ...eq, status: 'ativo' } }), api.q('assinaturas', { eq }),
    pega('atribuicoes', {}), pega('envios', { eq, gte: { enviado_em: ts(somaDias(hj, -70)) } }), pega('formularios', {})]);
  return { sessoes, checkins, series, treinos: treinos.filter((t) => t.aluna_id), mesos, assinaturas, atribuicoes, envios, formularios };
}

const mediana = (l) => { const x = l.slice().sort((a, b) => a - b); const m = Math.floor(x.length / 2); return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };
const tendencia = (agora, antes) => (agora == null || antes == null ? null : agora - antes >= 5 ? 'sobe' : antes - agora >= 5 ? 'desce' : 'estavel');
export const faixa = (v) => (v == null ? '' : v >= 80 ? 'bom' : v >= 50 ? 'medio' : 'ruim');

// ENGAJAMENTO de uma janela [ini, fim] (datas AAAA-MM-DD):
// 60% treinos feitos / previstos + 25% check-ins / previstos + 15% formulários respondidos no prazo / atribuídos.
// Componente que não se aplica (ex.: nenhum formulário) sai da conta e o peso é redistribuído.
function engajamentoJanela(a, d, ini, fim, ctx) {
  const inicioAluna = String(a.alistada_em || a.created_at || ini).slice(0, 10);
  const de = inicioAluna > ini ? inicioAluna : ini;
  const dias = diasEntre(de, fim) + 1;
  if (dias < 7) return null;
  const semanas = Math.min(4, dias / 7);
  const comp = [];
  if (ctx.freq) {
    const feitos = ctx.feitas.filter((s) => s.data >= de && s.data <= fim).length;
    const previstos = Math.round(ctx.freq * semanas);
    comp.push({ k: 'treinos', w: 0.6, v: Math.min(1, feitos / Math.max(1, previstos)), txt: `Treinos: ${feitos} de ${previstos}` });
  }
  const chkPrev = Math.max(1, Math.round(semanas));
  const chkFeitos = ctx.chk.filter((c) => c.semana >= somaDias(de, -6) && c.semana <= fim).length;
  comp.push({ k: 'checkins', w: 0.25, v: Math.min(1, chkFeitos / chkPrev), txt: `Check-ins: ${Math.min(chkFeitos, chkPrev)} de ${chkPrev}` });
  const forms = ctx.atribs.filter((t) => { const dia = String(t.agendado_para || t.created_at).slice(0, 10); return dia >= de && dia <= fim; });
  if (forms.length) {
    const noPrazo = forms.filter((t) => { const lim = t.prazo || somaDias(String(t.agendado_para || t.created_at).slice(0, 10), 3);
      return ctx.envios.some((x) => x.formulario_id === t.formulario_id && (x.atribuicao_id ? x.atribuicao_id === t.id : true) && String(x.enviado_em) >= String(t.agendado_para || t.created_at).slice(0, 10) && String(x.enviado_em).slice(0, 10) <= lim); }).length;
    comp.push({ k: 'formularios', w: 0.15, v: noPrazo / forms.length, txt: `Formulários no prazo: ${noPrazo} de ${forms.length}` });
  }
  const pesos = comp.reduce((t, c) => t + c.w, 0);
  return { valor: Math.round((comp.reduce((t, c) => t + c.w * c.v, 0) / pesos) * 100), partes: comp };
}

// PROGRESSÃO: melhor 1RM estimado por exercício numa janela contra a janela anterior;
// índice = mediana das variações, +5% ou mais = 100, 0% = 50, -5% ou menos = 0. Pede 3 exercícios com dados.
function progressaoJanela(series, iniA, fimA, iniB, fimB) {
  const melhor = (ini, fim) => { const m = {}; series.forEach((s) => { const dia = String(s.created_at).slice(0, 10); if (dia < ini || dia > fim) return;
    const v = e1rm(s); if (v > 0) m[s.exercicio_id] = Math.max(m[s.exercicio_id] || 0, v); }); return m; };
  const a = melhor(iniA, fimA), b = melhor(iniB, fimB);
  const vars = Object.keys(a).filter((k) => b[k]).map((k) => a[k] / b[k] - 1);
  if (vars.length < 3) return { variacao: vars.length ? mediana(vars) : null, indice: null, n: vars.length };
  const v = mediana(vars);
  return { variacao: v, indice: Math.round(Math.max(0, Math.min(100, 50 + v * 1000))), n: vars.length };
}

export function saudeDa(a, d) {
  const hj = hoje();
  const sess = d.sessoes.filter((s) => s.aluna_id === a.id);
  const minhas = d.series.filter((s) => s.aluna_id === a.id && !s.aquecimento && s.carga != null);
  const temSerie = new Set(d.series.filter((s) => s.aluna_id === a.id).map((s) => s.sessao_id));
  const feitas = sess.filter((s) => s.concluida_em || temSerie.has(s.id));
  const ts_ = d.treinos.filter((t) => t.aluna_id === a.id && t.ativo);
  const alvo = a.treinos_semana_alvo || ts_.filter((t) => !t.opcional).length || 0;
  const ult28 = feitas.filter((s) => s.data > somaDias(hj, -28)).length;
  const aderencia = Math.min(1, ult28 / ((alvo || 3) * 4));
  const chk = d.checkins.filter((c) => c.aluna_id === a.id);
  const oraculos = new Set((d.formularios || []).filter((f) => f.tipo === 'oraculo').map((f) => f.id));
  const ctx = { freq: alvo, feitas, chk, envios: (d.envios || []).filter((x) => x.aluna_id === a.id),
    atribs: (d.atribuicoes || []).filter((t) => (t.aluna_id === a.id || !t.aluna_id) && t.quando !== 'recorrente' && !oraculos.has(t.formulario_id)) };
  const engAtual = engajamentoJanela(a, d, somaDias(hj, -27), hj, ctx);
  const engAntes = engajamentoJanela(a, d, somaDias(hj, -55), somaDias(hj, -28), ctx);
  const engajamento = engAtual ? engAtual.valor : null;
  const prog = progressaoJanela(minhas, somaDias(hj, -27), hj, somaDias(hj, -55), somaDias(hj, -28));
  const progAntes = progressaoJanela(minhas, somaDias(hj, -55), somaDias(hj, -28), somaDias(hj, -83), somaDias(hj, -56));
  const progressao = prog.variacao;
  const ultimo = feitas.map((s) => s.data).sort().pop() || null;
  const semTreinar = ultimo ? diasEntre(ultimo, hj) : null;
  const semCheckinSemana = !chk.some((c) => c.semana === segundaDe());
  const ultimoCheckin = chk.slice().sort((x, y) => (x.semana < y.semana ? 1 : -1))[0];
  const sinal = semaforo(ultimoCheckin);
  const inicioFicha = [...d.mesos.filter((m) => m.aluna_id === a.id).map((m) => m.inicio), ...ts_.map((t) => String(t.created_at || '').slice(0, 10))].filter(Boolean).sort().pop();
  const fichaDias = inicioFicha ? diasEntre(inicioFicha, hj) : null;
  const plano = d.assinaturas.filter((s) => s.aluna_id === a.id).sort((x, y) => (x.fim < y.fim ? 1 : -1))[0];
  const planoDias = plano ? diasEntre(hj, plano.fim) : null;
  let risco = 0;
  if (aderencia < 0.5) risco += 35; else if (aderencia < 0.75) risco += 15;
  if (semTreinar == null || semTreinar >= 7) risco += 20;
  if (semTreinar != null && semTreinar >= 14) risco += 10;
  if (!chk.some((c) => c.semana >= somaDias(segundaDe(), -7))) risco += 15;
  if (planoDias != null && planoDias <= 7) risco += 15;
  if (progressao != null && progressao < 0) risco += 10;
  if (!ts_.length) risco += 15;
  if (sinal && sinal.cor === 'vermelho') risco += 10;
  risco = Math.min(100, risco);
  return { engajamento, engTend: tendencia(engajamento, engAntes && engAntes.valor), engPartes: engAtual ? engAtual.partes : [],
    progIndice: prog.indice, progTend: tendencia(prog.indice, progAntes.indice), progN: prog.n,
    aderencia, progressao, semTreinar, ultimo, semCheckinSemana, sinal, fichaDias, semFicha: !ts_.length, plano, planoDias, risco,
    nivelRisco: risco >= 50 ? ['alto', 'Risco alto'] : risco >= 25 ? ['medio', 'Risco médio'] : ['baixo', 'Risco baixo'] };
}

export const pct = (v) => (v == null ? '·' : `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`);

const SETA = { sobe: '↑', desce: '↓', estavel: '→' };
const TXT_TEND = { sobe: 'Subiu em relação às 4 semanas anteriores', desce: 'Caiu em relação às 4 semanas anteriores', estavel: 'Estável em relação às 4 semanas anteriores' };
export const dicaEngajamento = (s) => (s.engajamento == null ? 'Sem dados suficientes: precisa de pelo menos 7 dias de acompanhamento.'
  : `Últimos 28 dias. ${s.engPartes.map((p) => `${p.txt} (peso ${Math.round(p.w * 100)}%)`).join(' · ')}.${s.engPartes.length < 3 ? ' O que não se aplica sai da conta e o peso é redistribuído.' : ''}${s.engTend ? ' ' + TXT_TEND[s.engTend] + '.' : ''}`);
export const dicaProgressao = (s) => (s.progIndice == null ? `Sem dados suficientes: precisa de 3 exercícios com carga nas últimas 4 semanas e nas 4 anteriores (hoje: ${s.progN}).`
  : `Mediana de ${pct(s.progressao)} no 1RM estimado (Epley) em ${s.progN} exercícios, últimas 4 semanas contra as 4 anteriores. +5% = 100, 0% = 50, -5% = 0.${s.progTend ? ' ' + TXT_TEND[s.progTend] + '.' : ''}`);

// selos do score (cabeçalho da ficha e lista)
export function Score({ s, compacto }) {
  const val = (v, t) => html`${v == null ? '--' : v}${v != null && t ? html`<i class=${'tend ' + t}>${SETA[t]}</i>` : null}`;
  return html`<div class=${'score' + (compacto ? ' compacto' : '')}>
    <span class=${'score-item ' + faixa(s.engajamento)} title=${dicaEngajamento(s)}>
      ${!compacto ? html`<small>Engajamento</small>` : null}<b>${compacto ? 'E ' : ''}${val(s.engajamento, s.engTend)}</b></span>
    <span class=${'score-item ' + faixa(s.progIndice)} title=${dicaProgressao(s)}>
      ${!compacto ? html`<small>Progressão</small>` : null}<b>${compacto ? 'P ' : ''}${val(s.progIndice, s.progTend)}</b></span>
    <span class=${'score-item risco ' + s.nivelRisco[0]} title=${`Risco de evasão: ${s.risco} de 100`}>${!compacto ? html`<small>Evasão</small>` : null}<b>${compacto ? s.nivelRisco[1].replace('Risco ', '') : s.nivelRisco[1]}</b></span>
  </div>`;
}

// quem precisa de você hoje
export function Radar({ alunas, saude, ir }) {
  const pn = (n) => (n || '').split(' ')[0];
  const grupos = [
    ['Sinal vermelho no Oráculo', alunas.filter((a) => saude[a.id].sinal && saude[a.id].sinal.cor === 'vermelho'), (a) => `${pn(a.nome)}, vi seu check-in: sono, energia, estresse e dor pesaram essa semana. Vamos ajustar juntas? Me conta como você está.`],
    ['Sem check-in esta semana', alunas.filter((a) => saude[a.id].semCheckinSemana), (a) => `${pn(a.nome)}, passando para lembrar do check-in da semana. Leva 2 minutos e é com ele que eu ajusto o seu treino.`],
    ['Sem treinar há 7 dias ou mais', alunas.filter((a) => saude[a.id].semTreinar == null || saude[a.id].semTreinar >= 7), (a) => `Oi, ${pn(a.nome)}! Senti sua falta nos treinos. Tá tudo bem? Se a rotina apertou, me fala que eu ajusto a ficha pra caber.`],
    ['Ficha há mais de 4 semanas', alunas.filter((a) => saude[a.id].semFicha || (saude[a.id].fichaDias != null && saude[a.id].fichaDias > 28)), null],
    ['Plano vence em até 7 dias', alunas.filter((a) => saude[a.id].planoDias != null && saude[a.id].planoDias <= 7), (a) => `${pn(a.nome)}, seu plano está chegando no fim. Bora conversar sobre o próximo ciclo? Tenho umas ideias pra sua evolução.`],
  ];
  const total = new Set(grupos.flatMap(([, l]) => l.map((a) => a.id))).size;
  return html`<section class="card radar">
    <div class="card-topo"><h3>Radar da Guerreira</h3><span class="tag">${total ? `${total} aluna(s) pedindo atenção` : 'Tudo em dia'}</span></div>
    <div class="radar-grade">${grupos.map(([t, l, msg]) => html`<div class="radar-col"><div class="radar-cab"><b>${t}</b><span>${l.length}</span></div>
      ${l.length ? l.slice(0, 6).map((a) => html`<div class="radar-item"><button onClick=${() => ir(t.startsWith('Ficha') ? `aluna/${a.id}/ficha` : t.startsWith('Plano') ? `aluna/${a.id}/financeiro` : t.startsWith('Sinal') ? `aluna/${a.id}/checkins` : `aluna/${a.id}/evolucao`)}>${a.nome}</button>
        ${msg && a.telefone && html`<a class="btn-texto mini" target="_blank" rel="noopener" href=${linkWhats(a.telefone, msg(a))}>WhatsApp</a>`}</div>`)
        : html`<small>Ninguém.</small>`}
      ${l.length > 6 && html`<small>e mais ${l.length - 6}</small>`}</div>`)}</div>
  </section>`;
}
