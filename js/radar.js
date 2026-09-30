// RADAR DA GUERREIRA · saúde da carteira.
// Engajamento (treinos das últimas 4 semanas contra a meta + check-ins), progressão de força
// (últimas 4 semanas contra as 4 anteriores) e risco de evasão, tudo calculado no aparelho.
import { html } from '../lib/preact-htm.js';
import { api } from './api.js';
import { hoje, somaDias, diasEntre, segundaDe, linkWhats, semaforo } from './util.js';

const e1rm = (s) => (s.carga == null ? 0 : s.carga * (1 + Math.min(s.reps || 1, 12) / 30));

// carrega o que o radar precisa (de uma aluna ou de todas)
export async function carregarRadar(alunaId) {
  const eq = alunaId ? { aluna_id: alunaId } : {};
  const desde = somaDias(hoje(), -56);
  const [sessoes, checkins, series, treinos, mesos, assinaturas] = await Promise.all([
    api.q('sessoes', { eq, gte: { data: desde } }), api.q('checkins', { eq, gte: { semana: somaDias(segundaDe(), -28) } }),
    api.q('series', { eq, gte: { created_at: new Date(desde + 'T00:00:00').toISOString() } }),
    api.q('treinos', { eq }), api.q('mesociclos', { eq: { ...eq, status: 'ativo' } }).catch(() => []), api.q('assinaturas', { eq })]);
  return { sessoes, checkins, series, treinos: treinos.filter((t) => t.aluna_id), mesos, assinaturas };
}

export function saudeDa(a, d) {
  const hj = hoje();
  const sess = d.sessoes.filter((s) => s.aluna_id === a.id);
  const temSerie = new Set(d.series.filter((s) => s.aluna_id === a.id).map((s) => s.sessao_id));
  const feitas = sess.filter((s) => s.concluida_em || temSerie.has(s.id));
  const ts = d.treinos.filter((t) => t.aluna_id === a.id && t.ativo);
  const alvo = a.treinos_semana_alvo || ts.filter((t) => !t.opcional).length || 3;
  const ult28 = feitas.filter((s) => s.data > somaDias(hj, -28)).length;
  const aderencia = Math.min(1, ult28 / (alvo * 4));
  const chk = d.checkins.filter((c) => c.aluna_id === a.id);
  const checkinTaxa = Math.min(1, chk.filter((c) => c.semana >= somaDias(segundaDe(), -21)).length / 4);
  const engajamento = Math.round((aderencia * 0.7 + checkinTaxa * 0.3) * 100);
  // progressão: melhor força estimada por exercício, últimas 4 semanas x 4 anteriores
  const corte = new Date(somaDias(hj, -28) + 'T00:00:00').toISOString();
  const melhor = { rec: {}, ant: {} };
  d.series.filter((s) => s.aluna_id === a.id && !s.aquecimento && s.carga != null).forEach((s) => {
    const b = s.created_at >= corte ? melhor.rec : melhor.ant;
    b[s.exercicio_id] = Math.max(b[s.exercicio_id] || 0, e1rm(s));
  });
  const ganhos = Object.keys(melhor.rec).filter((k) => melhor.ant[k]).map((k) => melhor.rec[k] / melhor.ant[k] - 1);
  const progressao = ganhos.length ? ganhos.reduce((x, y) => x + y, 0) / ganhos.length : null;
  const ultimo = feitas.map((s) => s.data).sort().pop() || null;
  const semTreinar = ultimo ? diasEntre(ultimo, hj) : null;
  const semCheckinSemana = !chk.some((c) => c.semana === segundaDe());
  const ultimoCheckin = chk.slice().sort((x, y) => (x.semana < y.semana ? 1 : -1))[0];
  const sinal = semaforo(ultimoCheckin);
  const inicioFicha = [...d.mesos.filter((m) => m.aluna_id === a.id).map((m) => m.inicio), ...ts.map((t) => String(t.created_at || '').slice(0, 10))].filter(Boolean).sort().pop();
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
  if (!ts.length) risco += 15;
  if (sinal && sinal.cor === 'vermelho') risco += 10;
  risco = Math.min(100, risco);
  return { engajamento, aderencia, progressao, semTreinar, ultimo, semCheckinSemana, sinal, fichaDias, semFicha: !ts.length, plano, planoDias, risco,
    nivelRisco: risco >= 50 ? ['alto', 'Risco alto'] : risco >= 25 ? ['medio', 'Risco médio'] : ['baixo', 'Risco baixo'] };
}

export const pct = (v) => (v == null ? '·' : `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`);

// selos do score (perfil da aluna e lista)
export function Score({ s, compacto }) {
  return html`<div class=${'score' + (compacto ? ' compacto' : '')}>
    <span class=${'score-item ' + (s.engajamento >= 75 ? 'bom' : s.engajamento >= 50 ? 'medio' : 'ruim')} title="Treinos das últimas 4 semanas contra a meta (70%) e check-ins (30%)">
      ${!compacto && html`<small>Engajamento</small>`}<b>${s.engajamento}%</b></span>
    <span class=${'score-item ' + (s.progressao == null ? '' : s.progressao > 0.005 ? 'bom' : s.progressao < -0.005 ? 'ruim' : 'medio')} title="Força estimada: últimas 4 semanas contra as 4 anteriores">
      ${!compacto && html`<small>Progressão</small>`}<b>${compacto ? '↗ ' : ''}${pct(s.progressao)}</b></span>
    <span class=${'score-item risco ' + s.nivelRisco[0]} title=${`Risco de evasão: ${s.risco} de 100`}>${!compacto && html`<small>Evasão</small>`}<b>${compacto ? s.nivelRisco[1].replace('Risco ', '') : s.nivelRisco[1]}</b></span>
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
