// ACRÓPOLE · Centro de Comando do treinador
// Uma chamada ao banco (rpc centro_de_comando) e o resto é apresentação:
// moldes de frase, prioridade e ordem do feed.
import { html, useState, useEffect } from '../lib/preact-htm.js';
import { api, DEMO } from './api.js';
import { textoCiclo } from './motor.js';
import { abrirSelo } from './dossie.js';
import { Modal, Campo, toast, num, brl, dataBR, hoje, somaDias, diasEntre, linkWhats, semaforo } from './util.js';
import { Icone } from './icones.js';
import { ModalCompromisso, dataLocal } from './chronos.js';

const CACHE = 'nemesis-acropole';
const PESO = { critica: 100, atencao: 60, tarefa: 40, gloria: 20 };
const SINAL = { critica: '▲', atencao: '●', tarefa: '◆', gloria: '★' };
const FILTROS = [['todas', 'Todas'], ['critica', 'Críticas'], ['atencao', 'Atenção'], ['tarefa', 'Tarefas'], ['gloria', 'Façanhas']];
const pn = (n) => (n || '').split(' ')[0];
const dia10 = (s) => String(s || '').slice(0, 10);

// ---------- dados ----------
function useComando() {
  const [d, setD] = useState(() => { try { return JSON.parse(localStorage.getItem(CACHE)); } catch (e) { return null; } });
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await api.rpc('centro_de_comando', { p_dia: hoje() });
      const pacote = { ...r, _em: Date.now() };
      setD(pacote); setErro(null);
      try { localStorage.setItem(CACHE, JSON.stringify(pacote)); } catch (e) { /* sem espaço */ }
    } catch (e) { setErro(e.message); } finally { setCarregando(false); }
  };
  useEffect(() => {
    carregar();
    const desliga = api.aoInserir ? api.aoInserir(['alertas_coach', 'envios', 'checkins'], () => carregar()) : () => {};
    const foco = () => document.visibilityState === 'visible' && carregar();
    document.addEventListener('visibilitychange', foco);
    return () => { desliga(); document.removeEventListener('visibilitychange', foco); document.title = 'Nemesis'; };
  }, []);
  return { d, erro, carregando, recarregar: carregar };
}

// estado das visões (visto, resolvido, adiado, feito) guardado por chave
export async function marcarVisao(chave, status, dias) {
  const linha = { chave, status, ate: status === 'adiado' ? new Date(Date.now() + (dias || 3) * 86400000).toISOString() : null, updated_at: new Date().toISOString() };
  await api.ups('visoes_estado', linha, 'chave');
}
const tratada = (estados, chave) => (estados || []).some((v) => v.chave === chave && (['visto', 'resolvido', 'feito'].includes(v.status) || (v.status === 'adiado' && v.ate && new Date(v.ate) > new Date())));

// ---------- moldes: o JSON vira frases ----------
function montarVisoes(d) {
  const out = [];
  const hj = hoje();
  const push = (v) => { if (!tratada(d.estados, v.chave)) out.push(v); };

  for (const s of d.sinais || []) {
    const nivel = s.nivel === 'critico' ? 'critica' : 'atencao';
    const ctx = [textoCiclo(s.ciclo)];
    let texto;
    if (s.tipo === 'dor') {
      const x = s.dados || {};
      texto = x.antes != null && x.i > x.antes ? `dor em ${x.regiao} subiu de ${x.antes} para ${x.i} de 10` : `dor ${x.i} de 10 em ${x.regiao}`;
      if (x.antes != null && x.antes >= 3 && x.i >= 3) ctx.push('relato seguido na mesma região');
    } else {
      const x = s.dados || {};
      texto = x.horas != null && x.horas < 5 ? `menos de 5 h de sono e estresse ${num(x.estresse, 0)} de 10` : `sono ${num(x.sono, 0)} de 5 com estresse ${num(x.estresse, 0)} de 10`;
    }
    push({ chave: s.chave, nivel, aluna_id: s.aluna_id, nome: s.nome, telefone: s.telefone, texto, contexto: ctx.filter(Boolean).join(' · '),
      quando: s.quando, tipo: s.tipo, regiao: s.dados && s.dados.regiao,
      acoes: ['cronica', 'ficha', s.tipo === 'dor' ? 'selar' : 'selar_rec', 'whats', 'resolvido', 'adiar'] });
  }

  for (const a of d.alertas || []) {
    push({ chave: 'alerta|' + a.id, alerta_id: a.id, nivel: a.severidade === 'alerta' ? 'critica' : a.severidade === 'atencao' ? 'atencao' : 'tarefa',
      aluna_id: a.aluna_id, nome: a.nome, telefone: a.telefone, texto: a.titulo, contexto: a.texto, quando: a.created_at, acoes: ['cronica', 'whats', 'visto_alerta'] });
  }

  // queda sistêmica: última semana fechada contra a média das 4 anteriores
  const fechadas = (d.adesao || []).slice(0, -1).filter((x) => x.pct != null);
  if (fechadas.length >= 5) {
    const ult = fechadas[fechadas.length - 1];
    const ant = fechadas.slice(-5, -1); const media = ant.reduce((t, x) => t + Number(x.pct), 0) / ant.length;
    if (media - ult.pct >= 15) push({ chave: 'sistemica|' + ult.semana, nivel: 'critica', nome: 'Falha sistêmica', texto: `adesão caiu de ${num(media, 0)}% para ${num(ult.pct, 0)}%`,
      contexto: 'A média de todas caiu. Vale olhar feriado, ficha nova pesada demais ou problema no app.', quando: ult.semana, acoes: ['resolvido'] });
  }

  const semanaAtual = (d.adesao || []).slice(-1)[0];
  for (const a of d.adesao_alunas || []) {
    const sem = a.ultimo_treino ? diasEntre(a.ultimo_treino, hj) : null;
    if (a.abaixo60 >= 2 || (sem != null && sem >= 10)) {
      const texto = a.abaixo60 >= 2 ? `${a.abaixo60} semanas seguidas abaixo de 60% de adesão` : `sem treinar há ${sem} dias`;
      push({ chave: `adesao|${a.aluna_id}|${semanaAtual ? semanaAtual.semana : hj}`, nivel: 'atencao', aluna_id: a.aluna_id, nome: a.nome, telefone: a.telefone,
        texto, contexto: a.ultimo_treino ? `último treino em ${dataBR(a.ultimo_treino)}` : 'nenhum treino registrado', quando: a.ultimo_treino || hj,
        acoes: ['cronica', 'whats_falta', 'resolvido', 'adiar'] });
    }
  }

  for (const m of d.metas || []) {
    push({ chave: 'meta|' + m.id, nivel: 'atencao', aluna_id: m.aluna_id, nome: m.nome, texto: `meta "${m.titulo}" venceu${m.prazo ? ' em ' + dataBR(m.prazo) : ''} sem causa raiz`,
      contexto: 'A análise é obrigatória para encerrar a meta.', quando: m.prazo || hj, acoes: ['metas'] });
  }

  for (const o of d.oraculos || []) {
    const h = Math.round((Date.now() - new Date(o.desde).getTime()) / 3600000);
    if (h < 48) continue;
    out.push({ chave: 'oraculo|' + o.id, nivel: 'tarefa', aluna_id: o.aluna_id, nome: o.nome, texto: o.tipo === 'checkin' ? `Oráculo esperando resposta há ${h} h` : `${o.titulo || 'formulário'} sem leitura há ${h} h`,
      quando: o.desde, espera: h / 24, acoes: ['responder'] });
  }

  for (const f of d.fichas || []) {
    push({ chave: `ficha|${f.mesociclo_id}`, nivel: 'tarefa', aluna_id: f.aluna_id, nome: f.nome, telefone: f.telefone,
      texto: f.dias < 0 ? `ficha venceu há ${-f.dias} dia(s)` : f.dias === 0 ? 'ficha vence hoje' : `ficha vence em ${f.dias} dia(s)`, contexto: `fim do mesociclo: ${dataBR(f.fim)}`,
      quando: f.fim, espera: Math.max(0, -f.dias), acoes: ['ficha', 'adiar'] });
  }

  for (const m of d.marcos || []) {
    if (m.tipo === 'plano_vence') {
      push({ chave: m.chave, nivel: 'tarefa', aluna_id: m.aluna_id, nome: m.nome, telefone: m.telefone, texto: `plano ${m.extra && m.extra.plano ? m.extra.plano + ' ' : ''}vence em ${num(m.n, 0)} dia(s)`,
        contexto: m.extra && m.extra.fim ? `até ${dataBR(m.extra.fim)}` : '', quando: m.dia, acoes: ['financeiro', 'feito'] });
    } else if ((m.tipo === 'treino_redondo' && m.estado === 'completou') || m.tipo === 'volume_mes') {
      push({ chave: m.chave, nivel: 'gloria', aluna_id: m.aluna_id, nome: m.nome, telefone: m.telefone, texto: textoMarco(m), quando: m.dia, marco: m, acoes: ['parabenizar', 'feito'] });
    }
  }

  if (d.atrasadas && d.atrasadas.n > 0) {
    push({ chave: `atraso|${hj}`, nivel: 'tarefa', nome: 'Financeiro', texto: `${d.atrasadas.n} parcela(s) em atraso · ${brl(d.atrasadas.valor)}`, quando: hj, acoes: ['financeiro_geral', 'adiar'] });
  }

  for (const v of out) {
    const desde = v.quando ? Math.max(0, diasEntre(dia10(v.quando), hj)) : 0;
    v.prioridade = PESO[v.nivel] + (v.nivel === 'tarefa' ? 5 * (v.espera != null ? v.espera : desde) : 0) - (v.nivel === 'tarefa' ? 0 : 2 * desde);
  }
  return out.sort((a, b) => b.prioridade - a.prioridade).slice(0, 30);
}

function textoMarco(m) {
  const x = m.extra || {};
  switch (m.tipo) {
    case 'treino_redondo': return m.estado === 'completou' ? `completou o ${m.n}º treino` : `está a 1 treino do ${m.n}º`;
    case 'volume_mes': return `passou de ${m.n} t levantadas no mês (${num((x.kg || 0) / 1000, 1)} t)`;
    case 'alistamento': return `${m.n} ${m.n > 1 ? 'meses' : 'mês'} de Alistamento`;
    case 'aniversario': return 'faz aniversário';
    case 'reavaliacao': return `reavaliação: ${num(m.n, 0)} dias desde a última`;
    case 'meta_prazo': return `prazo da meta "${x.titulo || ''}"`;
    case 'ficha_termina': return 'a ficha termina';
    case 'plano_vence': return `plano vence em ${num(m.n, 0)} dia(s)`;
    default: return m.tipo;
  }
}
function msgParabens(m) {
  const n = pn(m.nome); const x = m.extra || {};
  if (m.tipo === 'treino_redondo') return `${n}, você fechou o seu ${m.n}º treino comigo. ${m.n} vezes que você escolheu aparecer. Isso é constância de verdade. Orgulho de acompanhar essa jornada!`;
  if (m.tipo === 'volume_mes') return `${n}, você já moveu mais de ${m.n} toneladas neste mês. Olha o tamanho do trabalho que você está fazendo!`;
  if (m.tipo === 'alistamento') return `${n}, hoje faz ${m.n} ${m.n > 1 ? 'meses' : 'mês'} que a gente começou. Obrigado pela confiança. Bora para os próximos!`;
  if (m.tipo === 'aniversario') return `${n}, feliz aniversário! Que seja um ano forte, em todos os sentidos.`;
  if (m.tipo === 'reavaliacao') return `${n}, já faz ${num(m.n, 0)} dias da última avaliação. Bora marcar a reavaliação para ver o quanto você evoluiu?`;
  if (m.tipo === 'meta_prazo') return `${n}, hoje é o prazo da meta "${x.titulo || ''}". Me conta como você está se sentindo com ela.`;
  return `${n}, passando para falar de você!`;
}

// ---------- tela ----------
const FERRAMENTAS = [['exercicios', 'exercicios', 'Exercícios', 'Biblioteca de exercícios e vídeos'], ['formularios', 'formularios', 'Formulários', 'Criar e vincular formulários'],
  ['checkins', 'oraculo', 'Oráculo', 'Check-ins da semana'], ['leads', 'inscricoes', 'Inscrições', 'Formulário da bio'], ['financeiro', 'financeiro', 'Financeiro', 'Planos, parcelas e despesas']];
const CHAVE_OCULTO = 'nemesis-valor-oculto';

export function Acropole({ perfil, ir }) {
  const { d: dRpc, erro, carregando, recarregar } = useComando();
  const [filtro, setFiltro] = useState('todas');
  const [verFiltros, setVerFiltros] = useState(false);
  const [novoComp, setNovoComp] = useState(false);
  const [oculto, setOculto] = useState(() => { try { return localStorage.getItem(CHAVE_OCULTO) === '1'; } catch (e) { return false; } });
  const [extra, setExtra] = useState(null);
  const [fila, setFila] = useState(null);
  useEffect(() => {
    const desde = somaDias(hoje(), -30);
    Promise.all([api.q('profiles', { eq: { role: 'student', ativo: true } }), api.q('lancamentos', { eq: { tipo: 'receita' }, gte: { pago_em: desde } }),
      api.q('checkins', { eq: { resposta: null } })])
      .then(([alunas, receitas, checkins]) => setExtra({ alunas: alunas.length, receita: receitas.reduce((t, l) => t + Number(l.valor), 0), checkins: checkins.length }))
      .catch(() => setExtra({ alunas: null, receita: null, checkins: 0 }));
    carregarFila().then(setFila).catch(() => setFila(null));
  }, []);

  // sem banco (demonstração) a Acrópole abre com os blocos vazios
  const d = dRpc || (DEMO || erro ? {} : null);
  if (!d) return html`<div class="carregando"><span class="spin"></span></div>`;

  const visoes = montarVisoes(d);
  const criticas = visoes.filter((v) => v.nivel === 'critica' && v.aluna_id);
  const nomesCrit = [...new Set(criticas.map((v) => pn(v.nome)))];
  document.title = nomesCrit.length ? `(${nomesCrit.length}) Nemesis` : 'Nemesis';
  const oraculos = dRpc ? (d.oraculos || []).length : extra ? extra.checkins : 0;
  const lista = filtro === 'todas' ? visoes : visoes.filter((v) => v.nivel === filtro);
  const alternarOculto = (ev) => { ev.stopPropagation(); const v = !oculto; setOculto(v); try { localStorage.setItem(CHAVE_OCULTO, v ? '1' : '0'); } catch (e) { /* */ } };

  const executar = async (acao, v) => {
    try {
      if (acao === 'cronica') return ir(`aluna/${v.aluna_id}/evolucao`);
      if (acao === 'ficha') return ir(`aluna/${v.aluna_id}/ficha`);
      if (acao === 'metas') return ir(`aluna/${v.aluna_id}/metas`);
      if (acao === 'financeiro') return ir(`aluna/${v.aluna_id}/financeiro`);
      if (acao === 'financeiro_geral') return ir('financeiro');
      if (acao === 'responder') return ir('checkins');
      if (acao === 'selar') return abrirSelo({ aluna_id: v.aluna_id, nome: v.nome, tag: 'lesao', regiao: v.regiao, texto: `Relato no Oráculo: ${v.texto}.` });
      if (acao === 'selar_rec') return abrirSelo({ aluna_id: v.aluna_id, nome: v.nome, tag: 'ajuste_rota', texto: `Recuperação: ${v.texto}.` });
      if (acao === 'visto_alerta') { await api.upd('alertas_coach', v.alerta_id, { visto_em: new Date().toISOString() }); }
      else if (acao === 'resolvido') await marcarVisao(v.chave, 'resolvido');
      else if (acao === 'adiar') { await marcarVisao(v.chave, 'adiado', 3); toast('Volta em 3 dias'); }
      else if (acao === 'feito') await marcarVisao(v.chave, 'feito');
      recarregar();
    } catch (e) { toast(e.message, 'erro'); }
  };

  return html`<div class="comando">
    ${nomesCrit.length > 0 && html`<button class="lacre" onClick=${() => { setFiltro('critica'); setVerFiltros(true); }}>
      <span class="lacre-ponto" aria-hidden="true"></span>
      <span><b>Chamado de Asclépio</b> · ${criticas.length} caso(s) crítico(s): ${nomesCrit.join(', ')}</span><span class="lacre-ver">Ver</span></button>`}
    ${erro && !DEMO && html`<p class="suave">Não consegui atualizar as notificações: ${erro}</p>`}

    <section class="kpis">
      <${Kpi} n=${extra && extra.alunas != null ? extra.alunas : '·'} rotulo="Alunas" icone="alunas" onClick=${() => ir('alunas')}/>
      <${Kpi} n=${oraculos} rotulo="Oráculos a ler" icone="oraculo" onClick=${() => ir('checkins')}/>
      <${Kpi} n=${extra && extra.receita != null ? (oculto ? 'R$ •••' : brl(extra.receita)) : '·'} icone="financeiro" onClick=${() => ir('financeiro')}
        rotulo=${html`30 dias <span class="kpi-olho" role="button" tabindex="0" aria-label=${oculto ? 'Mostrar valor' : 'Esconder valor'} onClick=${alternarOculto}><${Icone} nome=${oculto ? 'olhoOff' : 'olho'} tam=${15}/></span>`}/>
    </section>

    ${fila && html`<${FilaDoDia} f=${fila} ir=${ir}/>`}

    <div class="paineis">
      <section class="painel">
        <div class="painel-topo"><h2 class="bloco">Ferramentas de Consultoria</h2></div>
        <div class="ferramentas">${FERRAMENTAS.map(([rota, ic, t, sub]) => html`<a class="ferramenta" href=${'#/' + rota}>
          <span class="ferramenta-ico"><${Icone} nome=${ic} tam=${18}/></span><span class="ferramenta-txt"><b>${t}</b><small>${sub}</small></span><${Icone} nome="seta" tam=${16} class="suave-ico"/></a>`)}</div>
      </section>

      <section class="painel">
        <div class="painel-topo"><div><h2 class="bloco">Notificações</h2><small>${visoes.length ? `${visoes.length} pendente(s)${carregando && dRpc ? ' · atualizando…' : ''}` : 'Tudo resolvido'}</small></div>
          <button class=${'icone redondo' + (verFiltros ? ' on' : '')} aria-label="Filtrar" onClick=${() => { setVerFiltros(!verFiltros); if (verFiltros) setFiltro('todas'); }}><${Icone} nome="filtro" tam=${17}/></button></div>
        ${verFiltros && html`<div class="chips">${FILTROS.map(([k, r]) => html`<button class=${filtro === k ? 'chip on' : 'chip'} onClick=${() => setFiltro(k)}>${r}${k !== 'todas' ? ` (${visoes.filter((v) => v.nivel === k).length})` : ''}</button>`)}</div>`}
        ${lista.length ? html`<div class="notificacoes">${lista.map((v) => html`<${Visao} key=${v.chave} v=${v} executar=${executar}/>`)}</div>`
          : html`<div class="painel-vazio"><${Icone} nome="sino" tam=${26}/><p>Sem notificações!</p></div>`}
      </section>

      <${AgendaHoje} d=${d} ir=${ir} onNovo=${() => setNovoComp(true)} executar=${executar} recarregar=${recarregar}/>
    </div>
    ${novoComp && html`<${ModalCompromisso} onFechar=${() => setNovoComp(false)} onFeito=${() => { setNovoComp(false); recarregar(); }}/>`}
  </div>`;
}

// ---------- Templo: fila do dia (o que precisa de você antes de qualquer outra coisa) ----------
async function carregarFila() {
  const pega = (t, o) => api.q(t, o).catch(() => []);
  const [alunas, checkins, videos, aguardando] = await Promise.all([pega('profiles', { eq: { role: 'student', ativo: true } }),
    pega('checkins', { gte: { semana: somaDias(hoje(), -14) } }), pega('videos_execucao', { order: 'created_at' }),
    pega('profiles', { eq: { role: 'student', aguardando: true } })]);
  const ativas = new Set(alunas.map((a) => a.id));
  const ultimo = {};
  checkins.filter((c) => ativas.has(c.aluna_id)).forEach((c) => { if (!ultimo[c.aluna_id] || ultimo[c.aluna_id].semana < c.semana) ultimo[c.aluna_id] = c; });
  const vermelhas = alunas.filter((a) => { const x = semaforo(ultimo[a.id]); return x && x.cor === 'vermelho'; });
  const dow = new Date().getDay();
  return {
    semResposta: checkins.filter((c) => ativas.has(c.aluna_id) && !c.resposta).length,
    videos: videos.filter((v) => !v.correcao && ativas.has(v.aluna_id)),
    vermelhas,
    revisao: alunas.filter((a) => a.dia_revisao === dow),
    aguardando: aguardando.filter((a) => !a.ativo),
  };
}
function FilaDoDia({ f, ir }) {
  const total = f.semResposta + f.videos.length + f.vermelhas.length + f.revisao.length;
  const item = (n, rot, sub, onClick, cls = '') => html`<button class=${'templo-item' + (n ? ' ' + cls : ' zerado')} onClick=${onClick}><b>${n}</b><span>${rot}</span>${sub && html`<small>${sub}</small>`}</button>`;
  const nomes = (l) => (l.length ? l.slice(0, 3).map((a) => pn(a.nome)).join(', ') + (l.length > 3 ? ` +${l.length - 3}` : '') : null);
  const umaSo = (l, aba) => (l.length === 1 ? () => ir(`aluna/${l[0].aluna_id || l[0].id}/${aba}`) : null);
  return html`<section class="templo">
    ${f.aguardando.length > 0 && html`<button class="lacre aguardando-aviso" onClick=${() => ir('alunas')}><span class="lacre-ponto" aria-hidden="true"></span>
      <span><b>${f.aguardando.length} cadastro(s) aguardando aprovação</b> · ${nomes(f.aguardando)}</span><span class="lacre-ver">Ver</span></button>`}
    <div class="templo-cab"><h2 class="bloco">Fila do dia</h2><small>${total ? `${total} coisa(s) esperando você` : 'Nada na fila. Dia limpo.'}</small></div>
    <div class="templo-itens">
      ${item(f.semResposta, 'check-ins sem resposta', null, () => ir('checkins'), 'atencao')}
      ${item(f.videos.length, 'vídeos para corrigir', null, umaSo(f.videos, 'videos') || (() => ir('alunas')), 'atencao')}
      ${item(f.vermelhas.length, 'alunas no vermelho', nomes(f.vermelhas), umaSo(f.vermelhas, 'checkins') || (() => ir('alunas')), 'perigo')}
      ${item(f.revisao.length, 'revisões de hoje', nomes(f.revisao), umaSo(f.revisao, 'ficha') || (() => ir('agenda')), 'roxo')}
    </div>
  </section>`;
}

function Kpi({ n, rotulo, icone, onClick }) {
  return html`<button class="kpi" onClick=${onClick}>
    <span class="kpi-txt"><b>${n}</b><span class="kpi-rot">${rotulo}</span></span>
    <${Icone} nome=${icone} tam=${34} class="kpi-ico"/><${Icone} nome="seta" tam=${18} class="suave-ico"/></button>`;
}

const ROTULO = { cronica: 'Abrir aluna', ficha: 'Ajustar ficha', selar: 'Selar no Dossiê', selar_rec: 'Registrar no Dossiê', whats: 'WhatsApp', whats_falta: 'WhatsApp',
  resolvido: 'Resolvido', adiar: 'Lembrar em 3 dias', visto_alerta: 'Visto', metas: 'Analisar causa', responder: 'Responder', financeiro: 'Abrir financeiro',
  financeiro_geral: 'Abrir financeiro', parabenizar: 'Parabenizar', feito: 'Feito' };

function Visao({ v, executar }) {
  const zap = (texto) => html`<a class="btn mini" target="_blank" rel="noopener" href=${linkWhats(v.telefone, texto)}>WhatsApp</a>`;
  return html`<article class=${'visao ' + v.nivel}>
    <span class="visao-sinal" aria-label=${v.nivel}>${SINAL[v.nivel]}</span>
    <div class="visao-corpo">
      <p><b>${v.nome}</b>: ${v.texto}</p>
      ${v.contexto && html`<small>${v.contexto}</small>`}
      <div class="acoes">${v.acoes.map((a) => {
        if ((a === 'whats' || a === 'whats_falta' || a === 'parabenizar') && !v.telefone) return null;
        if (a === 'whats') return zap(`Oi, ${pn(v.nome)}! Vi o seu Oráculo. Me conta melhor como você está?`);
        if (a === 'whats_falta') return zap(`Oi, ${pn(v.nome)}! Senti sua falta nos treinos. Tá tudo bem? Se a rotina apertou, me fala que eu ajusto a ficha pra caber.`);
        if (a === 'parabenizar') return html`<a class="btn mini ouro" target="_blank" rel="noopener" href=${linkWhats(v.telefone, msgParabens(v.marco || { nome: v.nome }))}>Parabenizar</a>`;
        return html`<button class=${'btn mini' + (['resolvido', 'feito', 'visto_alerta', 'adiar'].includes(a) ? ' fantasma' : '')} onClick=${() => executar(a, v)}>${ROTULO[a]}</button>`;
      })}</div>
    </div>
  </article>`;
}

// ---------- agenda de hoje ----------
function AgendaHoje({ d, ir, onNovo, executar, recarregar }) {
  const hj = hoje();
  const itens = [];
  for (const g of d.agenda || []) {
    const dia = new Date(g.inicio);
    if (dataLocal(dia) === hj) itens.push({ tipo: 'comp', hora: dia.toTimeString().slice(0, 5), g });
  }
  for (const m of d.marcos || []) {
    if (m.tipo === 'plano_vence' || tratada(d.estados, m.chave) || m.dia > hj) continue;
    itens.push({ tipo: 'marco', hora: '', m });
  }
  itens.sort((a, b) => (a.hora < b.hora ? -1 : 1));
  const feito = async (g) => { try { await api.upd('agenda', g.id, { feito: !g.feito }); recarregar(); } catch (e) { toast(e.message, 'erro'); } };
  return html`<section class="painel">
    <div class="painel-topo"><h2 class="bloco com-ico"><${Icone} nome="agenda" tam=${18}/>Agenda de Hoje</h2><button class="btn-texto" onClick=${() => ir('agenda')}>Ver calendário →</button></div>
    ${itens.length ? html`<div class="agenda-dia">${itens.map((i) => (i.tipo === 'comp'
      ? html`<div class=${'agenda-item' + (i.g.feito ? ' feito' : '')}><span class="agenda-hora">${i.hora}</span><div><b>${i.g.titulo}</b>${i.g.nome ? html`<small>${i.g.nome}</small>` : null}</div>
          <div class="mini-acoes">${i.g.link && html`<a class="btn-texto" href=${i.g.link} target="_blank" rel="noopener">Link</a>`}<button class="check pequeno${i.g.feito ? ' on' : ''}" aria-label="Feito" onClick=${() => feito(i.g)}>✓</button></div></div>`
      : html`<div class="agenda-item marco"><span class="agenda-hora">★</span><div><b>${pn(i.m.nome)}</b><small>${textoMarco(i.m)}</small></div>
          <div class="mini-acoes">${i.m.telefone && html`<a class="btn-texto" target="_blank" rel="noopener" href=${linkWhats(i.m.telefone, msgParabens(i.m))}>WhatsApp</a>`}
          <button class="check pequeno" aria-label="Marcar como feito" onClick=${() => executar('feito', { chave: i.m.chave })}>✓</button></div></div>`))}
        <button class="btn-texto" onClick=${onNovo}>+ Agendar novo</button></div>`
      : html`<div class="painel-vazio"><${Icone} nome="agenda" tam=${28}/><p>Nenhum compromisso hoje</p><button class="btn-texto" onClick=${onNovo}>Agendar novo</button></div>`}
  </section>`;
}
