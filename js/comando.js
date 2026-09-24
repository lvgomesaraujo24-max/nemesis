// ACRÓPOLE · Centro de Comando do treinador
// Uma chamada ao banco (rpc centro_de_comando) e o resto é apresentação:
// moldes de frase, prioridade e ordem do feed.
import { html, useState, useEffect, useRef } from '../lib/preact-htm.js';
import { api, DEMO } from './api.js';
import { textoCiclo } from './motor.js';
import { abrirSelo } from './dossie.js';
import { Modal, Campo, Vazio, toast, num, brl, dataBR, hoje, somaDias, diasEntre, linkWhats } from './util.js';

const CACHE = 'nemesis-acropole';
const PESO = { critica: 100, atencao: 60, tarefa: 40, gloria: 20 };
const SINAL = { critica: '▲', atencao: '●', tarefa: '◆', gloria: '★' };
const FILTROS = [['todas', 'Todas'], ['critica', 'Críticas'], ['atencao', 'Atenção'], ['tarefa', 'Tarefas'], ['gloria', 'Façanhas']];
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
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
export function Acropole({ perfil, ir }) {
  const { d, erro, carregando, recarregar } = useComando();
  const [filtro, setFiltro] = useState('todas');
  const [novoComp, setNovoComp] = useState(false);
  const refVisoes = useRef();

  if (DEMO) return html`<div class="pilha"><h1 class="titulo">Acrópole</h1><${Vazio} titulo="Disponível com o banco ligado" texto="O Centro de Comando lê os dados direto do Supabase."/></div>`;
  if (!d && erro) return html`<div class="pilha"><h1 class="titulo">Acrópole</h1><div class="card vazio"><p>Não consegui carregar: ${erro}</p><p class="suave">Confira se a atualizacao-3.sql foi rodada no Supabase.</p><button class="btn" onClick=${recarregar}>Tentar de novo</button></div></div>`;
  if (!d) return html`<div class="carregando"><span class="spin"></span></div>`;

  const visoes = montarVisoes(d);
  const criticas = visoes.filter((v) => v.nivel === 'critica' && v.aluna_id);
  const nomesCrit = [...new Set(criticas.map((v) => pn(v.nome)))];
  const alunasCrit = new Set(criticas.map((v) => v.aluna_id)).size;
  document.title = nomesCrit.length ? `(${nomesCrit.length}) Nemesis` : 'Nemesis';

  const oraculos = d.oraculos || [];
  const maisAntigo = oraculos.length ? oraculos.reduce((a, b) => (a.desde < b.desde ? a : b)) : null;
  const fichas = d.fichas || [];
  const vencidas = fichas.filter((f) => f.dias < 0).length;
  const glorias = visoes.filter((v) => v.nivel === 'gloria').length;
  const dt = new Date();
  const resumo = [DIAS_SEMANA[dt.getDay()] + ', ' + dataBR(hoje()).slice(0, 5),
    nomesCrit.length ? `${nomesCrit.length} chamado(s) de Asclépio` : null, oraculos.length ? `${oraculos.length} Oráculo(s) a ler` : null,
    glorias ? `${glorias} façanha(s) para celebrar` : null].filter(Boolean).join(' · ');

  const lista = filtro === 'todas' ? visoes : visoes.filter((v) => v.nivel === filtro);
  const irFiltro = (f) => { setFiltro(f); setTimeout(() => refVisoes.current && refVisoes.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30); };

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
    <div class="ola"><p class="sobre">Acrópole</p><h1>Olá, ${pn(perfil.nome) || 'treinador'}</h1><p class="suave">${resumo}${carregando ? ' · atualizando…' : d._em ? '' : ''}</p></div>

    ${nomesCrit.length > 0 && html`<button class="lacre" onClick=${() => irFiltro('critica')}>
      <span class="lacre-ponto" aria-hidden="true"></span>
      <span><b>Chamado de Asclépio</b> · ${criticas.length} caso(s) crítico(s): ${nomesCrit.join(', ')}</span><span class="lacre-ver">Ver</span></button>`}

    <section class="barra-acao">
      <${Metrica} rotulo="Oráculos a ler" n=${oraculos.length} tom="ouro" sub=${maisAntigo ? `o mais antigo há ${Math.max(0, diasEntre(dia10(maisAntigo.desde), hoje()))} dia(s)` : 'Oráculo em dia'} onClick=${() => ir('checkins')}/>
      <${Metrica} rotulo="Fichas no limite" n=${fichas.length} tom="ouro" sub=${fichas.length ? `${vencidas} vencida(s) · ${fichas.length - vencidas} vencem em 7 dias` : d.sem_ficha ? `${d.sem_ficha} aluna(s) sem validade de ficha` : 'Nenhuma ficha vencendo'} onClick=${() => irFiltro('tarefa')}/>
      <${Metrica} rotulo="Alertas clínicos" n=${alunasCrit} tom="vermelho" sub=${alunasCrit ? 'alunas com sinal crítico' : 'Em dia'} onClick=${() => irFiltro('critica')}/>
    </section>

    <div class="comando-grade">
      <section class="card visoes" ref=${refVisoes}>
        <div class="card-topo"><h2 class="bloco">Visões do Oráculo</h2></div>
        <div class="chips">${FILTROS.map(([k, r]) => html`<button class=${filtro === k ? 'chip on' : 'chip'} onClick=${() => setFiltro(k)}>${r}${k !== 'todas' ? ` (${visoes.filter((v) => v.nivel === k).length})` : ''}</button>`)}</div>
        ${lista.length ? lista.map((v) => html`<${Visao} key=${v.chave} v=${v} executar=${executar}/>`)
          : html`<p class="suave vazio-texto">Nenhuma visão pendente. A pólis está em ordem.</p>`}
      </section>
      <aside class="comando-lado">
        <${AgendaDeChronos} d=${d} ir=${ir} onNovo=${() => setNovoComp(true)} executar=${executar} recarregar=${recarregar}/>
        <${Termometro} d=${d}/>
      </aside>
    </div>
    ${novoComp && html`<${ModalCompromisso} onFechar=${() => setNovoComp(false)} onFeito=${() => { setNovoComp(false); recarregar(); }}/>`}
  </div>`;
}

function Metrica({ rotulo, n, tom, sub, onClick }) {
  const cls = 'metrica' + (n > 0 ? ' ' + tom : ' zero');
  return html`<button class=${cls} onClick=${onClick}><b>${n > 0 ? n : '·'}</b><span class="metrica-rot">${rotulo}</span><small>${sub}</small></button>`;
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

// ---------- agenda ----------
function AgendaDeChronos({ d, ir, onNovo, executar, recarregar }) {
  const hj = hoje(); const am = somaDias(hj, 1);
  const itens = [];
  for (const g of d.agenda || []) {
    const dia = new Date(g.inicio); const k = dataLocal(dia);
    itens.push({ tipo: 'comp', dia: k, hora: dia.toTimeString().slice(0, 5), g });
  }
  for (const m of d.marcos || []) {
    if (m.tipo === 'plano_vence' || tratada(d.estados, m.chave)) continue;
    itens.push({ tipo: 'marco', dia: m.dia < hj ? hj : m.dia, hora: '', m });
  }
  itens.sort((a, b) => (a.dia + a.hora < b.dia + b.hora ? -1 : 1));
  const feito = async (g) => { try { await api.upd('agenda', g.id, { feito: !g.feito }); recarregar(); } catch (e) { toast(e.message, 'erro'); } };
  const bloco = (dia, titulo) => {
    const l = itens.filter((i) => i.dia === dia);
    return html`<div class="agenda-dia"><h4>${titulo}</h4>${l.length ? l.map((i) => (i.tipo === 'comp'
      ? html`<div class=${'agenda-item' + (i.g.feito ? ' feito' : '')}><span class="agenda-hora">${i.hora}</span><div><b>${i.g.titulo}</b>${i.g.nome ? html`<small>${i.g.nome}</small>` : null}</div>
          <div class="mini-acoes">${i.g.link && html`<a class="btn-texto" href=${i.g.link} target="_blank" rel="noopener">Link</a>`}<button class="check pequeno${i.g.feito ? ' on' : ''}" aria-label="Feito" onClick=${() => feito(i.g)}>✓</button></div></div>`
      : html`<div class="agenda-item marco"><span class="agenda-hora">★</span><div><b>${pn(i.m.nome)}</b><small>${textoMarco(i.m)}</small></div>
          <div class="mini-acoes">${i.m.telefone && html`<a class="btn-texto" target="_blank" rel="noopener" href=${linkWhats(i.m.telefone, msgParabens(i.m))}>WhatsApp</a>`}
          <button class="check pequeno" aria-label="Marcar como feito" onClick=${() => executar('feito', { chave: i.m.chave })}>✓</button></div></div>`))
      : html`<p class="suave">Nada marcado.</p>`}</div>`;
  };
  return html`<section class="card agenda">
    <div class="card-topo"><h2 class="bloco">Agenda de Chronos</h2><button class="btn-texto" onClick=${onNovo}>+ Compromisso</button></div>
    ${bloco(hj, 'Hoje')}${bloco(am, 'Amanhã')}
    <button class="btn-texto" onClick=${() => ir('agenda')}>Ver calendário ›</button>
  </section>`;
}
export const dataLocal = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };

export function ModalCompromisso({ inicial, onFechar, onFeito }) {
  const [alunas, setAlunas] = useState([]);
  useEffect(() => { api.q('profiles', { eq: { role: 'student', ativo: true }, order: 'nome' }).then(setAlunas).catch(() => {}); }, []);
  const g = inicial || {};
  const ini = g.inicio ? new Date(g.inicio) : null;
  const [f, setF] = useState({ titulo: g.titulo || '', tipo: g.tipo || 'video', aluna_id: g.aluna_id || '', dia: ini ? dataLocal(ini) : (g.dia || hoje()), hora: ini ? ini.toTimeString().slice(0, 5) : '18:00', link: g.link || '' });
  const salvar = async (ev) => {
    ev.preventDefault(); if (!f.titulo.trim()) { toast('Dê um título.', 'erro'); return; }
    const linha = { titulo: f.titulo.trim(), tipo: f.tipo, aluna_id: f.aluna_id || null, inicio: new Date(`${f.dia}T${f.hora || '00:00'}:00`).toISOString(), link: f.link || null };
    try { if (g.id) await api.upd('agenda', g.id, linha); else await api.ins('agenda', linha); onFeito(); } catch (e) { toast(e.message, 'erro'); }
  };
  const apagar = async () => { if (!confirm('Apagar este compromisso?')) return; try { await api.del('agenda', g.id); onFeito(); } catch (e) { toast(e.message, 'erro'); } };
  return html`<${Modal} titulo=${g.id ? 'Editar compromisso' : 'Novo compromisso'} onFechar=${onFechar}><form class="pilha" onSubmit=${salvar}>
    <div class="chips">${[['video', 'Vídeo'], ['avaliacao', 'Avaliação'], ['outro', 'Outro']].map(([k, r]) => html`<button type="button" class=${f.tipo === k ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, tipo: k })}>${r}</button>`)}</div>
    <${Campo} rotulo="Título"><input class="input" value=${f.titulo} placeholder="Ex.: Chamada de ajuste de ficha" onInput=${(ev) => setF({ ...f, titulo: ev.target.value })}/><//>
    <${Campo} rotulo="Aluna (opcional)"><select class="input" value=${f.aluna_id} onChange=${(ev) => setF({ ...f, aluna_id: ev.target.value })}><option value="">Compromisso meu</option>${alunas.map((a) => html`<option value=${a.id}>${a.nome}</option>`)}</select><//>
    <div class="grade2">
      <${Campo} rotulo="Dia"><input class="input" type="date" value=${f.dia} onInput=${(ev) => setF({ ...f, dia: ev.target.value })}/><//>
      <${Campo} rotulo="Hora"><input class="input" type="time" value=${f.hora} onInput=${(ev) => setF({ ...f, hora: ev.target.value })}/><//>
    </div>
    <${Campo} rotulo="Link (Meet, Zoom, WhatsApp)"><input class="input" type="url" placeholder="https://" value=${f.link} onInput=${(ev) => setF({ ...f, link: ev.target.value })}/><//>
    <button class="btn primario grande">Salvar</button>
    ${g.id && html`<button type="button" class="btn-texto perigo" onClick=${apagar}>Apagar</button>`}
  </form><//>`;
}

// ---------- termômetro ----------
function Termometro({ d }) {
  const semanas = d.adesao || [];
  const atual = semanas[semanas.length - 1];
  const fechadas = semanas.slice(0, -1).filter((x) => x.pct != null && x.alunas > 0);
  const ult = fechadas[fechadas.length - 1];
  const alunas = (d.adesao_alunas || []).filter((a) => a.media4 != null);
  const coroa = [...alunas].filter((a) => a.media4 >= 70).sort((a, b) => b.media4 - a.media4 || b.sequencia - a.sequencia).slice(0, 3);
  const precisam = [...alunas].sort((a, b) => a.media4 - b.media4).filter((a) => a.media4 < 85 && !coroa.includes(a)).slice(0, 3);
  if (!ult) return html`<section class="card termometro"><h2 class="bloco">Termômetro da Pólis</h2><p class="suave">Ainda sem semana fechada para medir.</p></section>`;
  const pct = Number(ult.pct);
  const tom = pct >= 85 ? 'ouro' : pct >= 70 ? 'neutro' : 'ambar';
  return html`<section class="card termometro">
    <h2 class="bloco">Termômetro da Pólis</h2>
    <div class="gauge-linha"><${Gauge} pct=${pct} tom=${tom}/>
      <div><small>última semana fechada</small>${atual && atual.esperado_pct != null && html`<p class="ritmo">No ritmo desta semana: <b>${num(atual.esperado_pct, 0)}%</b></p>`}
        <small>${ult.alunas} aluna(s) na conta</small></div></div>
    <${Sparkline} valores=${fechadas.slice(-8).map((x) => Number(x.pct))}/>
    ${pct < 70 && precisam.length > 0 && html`<p class="suave">Puxaram para baixo: ${precisam.map((a) => pn(a.nome)).join(', ')}</p>`}
    ${coroa.length > 0 && html`<div class="coroa"><h4>Coroa de Louros</h4>${coroa.map((a) => html`<div class="coroa-linha"><span>${pn(a.nome)}</span><small>${num(a.media4, 0)}% · ${a.sequencia} sem. seguidas</small>
      ${a.telefone && html`<a class="btn-texto" target="_blank" rel="noopener" href=${linkWhats(a.telefone, `${pn(a.nome)}, olhei a sua constância nas últimas semanas e preciso dizer: você está entre as mais firmes do time. Orgulho!`)}>Parabenizar</a>`}</div>`)}</div>`}
    ${precisam.length > 0 && html`<div class="coroa"><h4>Precisam de você</h4>${precisam.map((a) => html`<div class="coroa-linha"><span>${pn(a.nome)}</span><small>${num(a.media4, 0)}% nas 4 últimas semanas</small></div>`)}</div>`}
  </section>`;
}

function Gauge({ pct, tom }) {
  const r = 34, c = Math.PI * r; const p = Math.max(0, Math.min(100, pct)) / 100;
  return html`<svg class=${'gauge ' + tom} width="96" height="60" viewBox="0 0 96 60" role="img" aria-label=${`Adesão ${num(pct, 0)}%`}>
    <path d="M14 52 A34 34 0 0 1 82 52" class="gauge-fundo"/>
    <path d="M14 52 A34 34 0 0 1 82 52" class="gauge-valor" stroke-dasharray=${`${c * p} ${c}`}/>
    <text x="48" y="50" text-anchor="middle">${num(pct, 0)}%</text></svg>`;
}

export function Sparkline({ valores, largura = 220, altura = 36 }) {
  if (!valores || valores.length < 2) return null;
  const mn = Math.min(...valores), mx = Math.max(...valores); const amp = mx - mn || 1;
  const X = (i) => 3 + (i * (largura - 6)) / (valores.length - 1);
  const Y = (v) => altura - 4 - ((v - mn) / amp) * (altura - 8);
  const d = valores.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  return html`<svg class="sparkline" width="100%" height=${altura} viewBox=${`0 0 ${largura} ${altura}`} preserveAspectRatio="none" aria-hidden="true">
    <path d=${d} fill="none" vector-effect="non-scaling-stroke"/><circle cx=${X(valores.length - 1)} cy=${Y(valores[valores.length - 1])} r="3"/></svg>`;
}
